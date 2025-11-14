import { z } from 'zod';
import { userRecordSchema, articleRecordSchema, commentRecordSchema } from '../schemas/importSchemas';
import { Prisma } from '@prisma/client';

// Resource types
export type ResourceType = 'users' | 'articles' | 'comments';
export type FormatType = 'ndjson' | 'json';

// Record types from schemas
export type UserRecord = z.infer<typeof userRecordSchema>;
export type ArticleRecord = z.infer<typeof articleRecordSchema>;
export type CommentRecord = z.infer<typeof commentRecordSchema>;

// Union type for all records
export type ImportRecord = UserRecord | ArticleRecord | CommentRecord;

// Batch item with record index
export interface BatchItem<T = ImportRecord> {
  recordIndex: number;
  [key: string]: unknown;
}

// Filter types for exports
export interface UserFilters {
  active?: boolean | string;
  role?: string;
}

export interface ArticleFilters {
  status?: string;
  authorId?: string | number;
}

export interface CommentFilters {
  articleId?: string | number;
  authorId?: string | number;
}

export type ExportFilters = UserFilters | ArticleFilters | CommentFilters;

// Export job parameters
export interface CreateExportJobParams {
  resource: ResourceType;
  format: FormatType;
  idempotencyKey: string;
  filters?: ExportFilters;
  fields?: string[];
}

// Export job status response
export interface ExportJobStatus {
  job_id: string;
  status: string;
  resource: ResourceType;
  format: FormatType;
  totalRecords: number;
  filePath: string | null;
  downloadUrl: string | null;
  filters: Prisma.JsonValue | null;
  fields: Prisma.JsonValue | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

// Process batch result
export interface ProcessBatchResult {
  success: number;
  error: number;
}

// Prisma types for cursors
export type CursorRecord = any;

// Formatted export record
export interface FormattedRecord {
  [key: string]: unknown;
}

