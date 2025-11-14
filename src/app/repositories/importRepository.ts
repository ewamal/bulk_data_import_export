import prisma from '../../prisma/prisma-client';

/**
 * Import Job Repository
 * Handles all database operations for import jobs
 */

export async function updateJobStatus(
  jobId: number,
  status: string,
  data?: { startedAt?: Date; completedAt?: Date }
) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: { status, ...data },
  });
}

export async function updateJobCounts(jobId: number, counts: {
  totalRecords?: number;
  successCount?: number | { increment: number };
  errorCount?: number | { increment: number };
}) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: counts,
  });
}

export async function getJob(jobId: number) {
  return prisma.importJob.findUnique({
    where: { id: jobId },
  });
}

export async function createImportError(data: {
  importJobId: number;
  recordIndex: number;
  recordData: any;
  errorMessage: string;
  errorType: string;
}) {
  return prisma.importError.create({ data });
}

/**
 * Record Repository
 * Handles upsert operations for users, articles, comments
 */

export async function upsertUser(record: any) {
  // Generate username from name or email if not provided
  const username = record.username || record.name?.toLowerCase().replace(/\s+/g, '') || record.email.split('@')[0];
  
  // Use a default password for imported users (they can reset later)
  const password = record.password || 'imported-user-change-me';
  
  // Get role from record, default to 'reader' if not provided
  const role = record.role || 'reader';
  
  // Get active status, default to true if not provided
  const active = record.active !== undefined ? record.active : true;
  
  // Store UUID in externalId if provided (for FK lookups in articles/comments)
  const externalId = typeof record.id === 'string' && record.id.includes('-') ? record.id : null;
  
  // Use email as the unique identifier for upserts since email is required as per doc
  return prisma.user.upsert({
    where: { email: record.email },
    update: { username, password, role, active, externalId },
    create: { email: record.email, username, password, role, active, externalId },
  });
}

export async function upsertArticle(record: any) {
  // Handle both author_id (snake_case) and authorId (camelCase)
  const authorId = record.author_id || record.authorId;
  
  let authorIdInt: number;
  
  // If it's a UUID, look up user by externalId
  if (typeof authorId === 'string' && authorId.includes('-')) {
    const user = await prisma.user.findUnique({
      where: { externalId: authorId },
      select: { id: true },
    });
    
    if (!user) {
      throw new Error(`Foreign key violation: author_id "${authorId}" does not exist (user with externalId not found)`);
    }
    
    authorIdInt = user.id;
  } else {
    // It's an integer ID
    authorIdInt = typeof authorId === 'number' ? authorId : parseInt(authorId);
    if (isNaN(authorIdInt)) {
      throw new Error(`Invalid author_id: ${authorId}`);
    }
  }

  // Store UUID in externalId if provided (for FK lookups in comments)
  const externalId = typeof record.id === 'string' && record.id.includes('-') ? record.id : null;

  return prisma.article.upsert({
    where: { slug: record.slug },
    update: {
      title: record.title,
      description: record.description || record.title, // Use title if description missing
      body: record.body,
      externalId,
      author: { connect: { id: authorIdInt } },
    },
    create: {
      slug: record.slug,
      title: record.title,
      description: record.description || record.title,
      body: record.body,
      externalId,
      author: { connect: { id: authorIdInt } },
    },
  });
}

export async function upsertComment(record: any) {
  const articleId = record.article_id;
  const userId = record.user_id; // Schema uses user_id (maps to authorId in DB model)
  
  let articleIdInt: number;
  let userIdInt: number;
  
  // Handle article_id - if it's a UUID, look up article by externalId
  if (typeof articleId === 'string' && articleId.includes('-')) {
    const article = await prisma.article.findUnique({
      where: { externalId: articleId },
      select: { id: true },
    });
    
    if (!article) {
      throw new Error(`Foreign key violation: article_id "${articleId}" does not exist (article with externalId not found)`);
    }
    
    articleIdInt = article.id;
  } else {
    articleIdInt = typeof articleId === 'number' ? articleId : parseInt(articleId);
    if (isNaN(articleIdInt)) {
      throw new Error(`Invalid article_id: ${articleId}`);
    }
  }
  
  // Handle user_id - if it's a UUID, look up by externalId
  if (typeof userId === 'string' && userId.includes('-')) {
    const user = await prisma.user.findUnique({
      where: { externalId: userId },
      select: { id: true },
    });
    
    if (!user) {
      throw new Error(`Foreign key violation: user_id "${userId}" does not exist (user with externalId not found)`);
    }
    
    userIdInt = user.id;
  } else {
    userIdInt = typeof userId === 'number' ? userId : parseInt(userId);
    if (isNaN(userIdInt)) {
      throw new Error(`Invalid user_id: ${userId}`);
    }
  }

  // Comments don't have natural keys, just create new ones
  return prisma.comment.create({
    data: { 
      body: record.body,
      articleId: articleIdInt,
      authorId: userIdInt,
    },
  });
}

