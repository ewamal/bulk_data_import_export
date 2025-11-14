import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../../prisma/prisma-client';
import * as repo from '../repositories/exportRepository';
import { metricsTracker } from './importMetrics';
import { ResourceType, FormatType, UserFilters, ArticleFilters, CommentFilters, FormattedRecord, CursorRecord } from '../types';

/**
 * Stream export data directly to response (for GET /v1/exports)
 */
export async function streamExport(
  res: Response,
  resource: ResourceType,
  format: FormatType
): Promise<void> {
  let recordCount = 0;

  try {
    const cursor = getResourceCursor(resource);

    if (format === 'ndjson') {
      // Stream NDJSON (one JSON object per line)
      for await (const record of cursor) {
        res.write(JSON.stringify(formatRecord(resource, record)) + '\n');
        recordCount++;
      }
    } else {
      // Stream JSON array
      res.write('[\n');
      let first = true;

      for await (const record of cursor) {
        if (!first) {
          res.write(',\n');
        }
        first = false;
        res.write(JSON.stringify(formatRecord(resource, record)));
        recordCount++;
      }

      res.write('\n]');
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed' });
    }
    throw error;
  }
}

/**
 * Process export job in background (for POST /v1/exports)
 */
export async function processExportJob(jobId: number): Promise<void> {
  metricsTracker.startTracking(jobId);

  const job = await repo.updateJobStatus(jobId, 'processing', { startedAt: new Date() });

  let filePath: string | null = null;

  try {
    const fileName = `export-${jobId}-${Date.now()}.${job.format}`;
    filePath = path.join('exports', fileName);

    // Ensure exports directory exists
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports', { recursive: true });
    }

    const fileStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
    let recordCount = 0;

    const cursor = getResourceCursor(job.resource as ResourceType, job.filters as any);

    if (job.format === 'ndjson') {
      // Write NDJSON format
      for await (const record of cursor) {
        const formatted = formatRecord(job.resource as ResourceType, record, job.fields as string[] | undefined);
        fileStream.write(JSON.stringify(formatted) + '\n');
        recordCount++;
        
        // Update metrics periodically
        if (recordCount % 5000 === 0) {
          metricsTracker.updateProgress(jobId, recordCount, 0);
        }
      }
    } else {
      // Write JSON array format
      fileStream.write('[\n');
      let first = true;

      for await (const record of cursor) {
        if (!first) {
          fileStream.write(',\n');
        }
        first = false;
        const formatted = formatRecord(job.resource as ResourceType, record, job.fields as string[] | undefined);
        fileStream.write(JSON.stringify(formatted));
        recordCount++;
        
        // Update metrics periodically
        if (recordCount % 5000 === 0) {
          metricsTracker.updateProgress(jobId, recordCount, 0);
        }
      }

      fileStream.write('\n]');
    }

    fileStream.end();

    // Wait for file to be written
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    const downloadUrl = `/api/v1/exports/${jobId}/download`;

    await repo.updateJobStatus(jobId, 'completed', {
      completedAt: new Date(),
      filePath,
      downloadUrl,
      totalRecords: recordCount,
    });

    metricsTracker.finishTracking(jobId);
  } catch (error) {
    console.error(`Export job ${jobId} failed:`, error);
    await repo.updateJobStatus(jobId, 'failed', { completedAt: new Date() });
    metricsTracker.finishTracking(jobId);
    throw error;
  }
}

/**
 * Get cursor for resource data
 */
function getResourceCursor(resource: ResourceType, filters?: UserFilters | ArticleFilters | CommentFilters): AsyncGenerator<CursorRecord, void, unknown> {
  switch (resource) {
    case 'users':
      return getUserCursor(filters as UserFilters);
    case 'articles':
      return getArticleCursor(filters as ArticleFilters);
    case 'comments':
      return getCommentCursor(filters as CommentFilters);
    default:
      throw new Error(`Unknown resource: ${resource}`);
  }
}

/**
 * Get user cursor with optional filters (streaming with batching)
 */
async function* getUserCursor(filters?: UserFilters): AsyncGenerator<CursorRecord, void, unknown> {
  const where: { active?: boolean; role?: string } = {};
  
  if (filters?.active !== undefined) {
    where.active = filters.active === 'true' || filters.active === true;
  }
  if (filters?.role) {
    where.role = filters.role;
  }

  const BATCH_SIZE = 1000;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const users = await prisma.user.findMany({
      where,
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      skip,
    });

    for (const user of users) {
      yield user;
    }

    hasMore = users.length === BATCH_SIZE;
    skip += BATCH_SIZE;
  }
}

/**
 * Get article cursor with optional filters (streaming with batching)
 */
async function* getArticleCursor(filters?: ArticleFilters): AsyncGenerator<CursorRecord, void, unknown> {
  const where: { status?: string; authorId?: number } = {};
  
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.authorId) {
    where.authorId = typeof filters.authorId === 'number' ? filters.authorId : parseInt(String(filters.authorId));
  }

  const BATCH_SIZE = 1000;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const articles = await prisma.article.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            externalId: true,
            username: true,
            email: true,
          },
        },
        tagList: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      skip,
    });

    for (const article of articles) {
      yield article;
    }

    hasMore = articles.length === BATCH_SIZE;
    skip += BATCH_SIZE;
  }
}

/**
 * Get comment cursor with optional filters (streaming with batching)
 */
async function* getCommentCursor(filters?: CommentFilters): AsyncGenerator<CursorRecord, void, unknown> {
  const where: { articleId?: number; authorId?: number } = {};
  
  if (filters?.articleId) {
    where.articleId = typeof filters.articleId === 'number' ? filters.articleId : parseInt(String(filters.articleId));
  }
  if (filters?.authorId) {
    where.authorId = typeof filters.authorId === 'number' ? filters.authorId : parseInt(String(filters.authorId));
  }

  const BATCH_SIZE = 1000;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const comments = await prisma.comment.findMany({
      where,
      include: {
        article: {
          select: {
            id: true,
            externalId: true,
            slug: true,
          },
        },
        author: {
          select: {
            id: true,
            externalId: true,
            username: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      skip,
    });

    for (const comment of comments) {
      yield comment;
    }

    hasMore = comments.length === BATCH_SIZE;
    skip += BATCH_SIZE;
  }
}

/**
 * Format record according to export schema
 */
function formatRecord(resource: ResourceType, record: CursorRecord, fields?: string[]): FormattedRecord {
  switch (resource) {
    case 'users':
      return formatUserRecord(record, fields);
    case 'articles':
      return formatArticleRecord(record, fields);
    case 'comments':
      return formatCommentRecord(record, fields);
    default:
      return record;
  }
}

/**
 * Format user record for export
 */
function formatUserRecord(user: CursorRecord, fields?: string[]): FormattedRecord {
  const formatted: FormattedRecord = {
    id: user.externalId || user.id,
    email: user.email,
    name: user.username, // Export uses 'name' field
    role: user.role || 'user',
    active: user.active ?? true,
    created_at: user.createdAt?.toISOString(),
    updated_at: user.updatedAt?.toISOString(),
  };

  if (fields) {
    const filtered: any = {};
    for (const field of fields) {
      if (formatted[field] !== undefined) {
        filtered[field] = formatted[field];
      }
    }
    return filtered;
  }

  return formatted;
}

/**
 * Format article record for export
 */
function formatArticleRecord(article: CursorRecord, fields?: string[]): FormattedRecord {
  const formatted: FormattedRecord = {
    id: article.externalId || article.id,
    slug: article.slug,
    title: article.title,
    body: article.body,
    // Use externalId for author_id if available, otherwise use integer id
    author_id: article.author?.externalId || article.authorId,
    tags: article.tagList?.map((tag: any) => tag.name) || [],
    // Note: status and published_at may not exist in DB schema
    // but are part of export schema per assignment
    status: article.status || 'published',
    published_at: article.publishedAt?.toISOString() || article.createdAt?.toISOString() || null,
  };

  if (fields) {
    const filtered: FormattedRecord = {};
    for (const field of fields) {
      if (formatted[field] !== undefined) {
        filtered[field] = formatted[field];
      }
    }
    return filtered;
  }

  return formatted;
}

/**
 * Format comment record for export
 */
function formatCommentRecord(comment: CursorRecord, fields?: string[]): FormattedRecord {
  const formatted: FormattedRecord = {
    id: comment.externalId || comment.id,
    // Use externalId for foreign keys if available, otherwise use integer id
    article_id: comment.article?.externalId || comment.articleId,
    user_id: comment.author?.externalId || comment.authorId, // Export uses user_id
    body: comment.body,
    created_at: comment.createdAt?.toISOString(),
  };

  if (fields) {
    const filtered: any = {};
    for (const field of fields) {
      if (formatted[field] !== undefined) {
        filtered[field] = formatted[field];
      }
    }
    return filtered;
  }

  return formatted;
}

