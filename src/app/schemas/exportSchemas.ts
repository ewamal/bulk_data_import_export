import { z } from 'zod';

// Query validation for GET /v1/exports
export const exportQuerySchema = z.object({
  resource: z.enum(['users', 'articles', 'comments'], {
    message: 'resource must be one of: users, articles, comments',
  }),
  format: z.enum(['ndjson', 'json']).default('ndjson'),
});

// Request body validation for POST /v1/exports
export const exportRequestSchema = z.object({
  resource: z.enum(['users', 'articles', 'comments']),
  format: z.enum(['ndjson', 'json']).default('ndjson'),
  filters: z.record(z.string(), z.any()).optional(), 
  fields: z.array(z.string()).optional(), 
});

// Headers validation
export const exportHeadersSchema = z.object({
  'idempotency-key': z.string().min(1, 'Idempotency-Key is required'),
}).passthrough();

// Export TypeScript types from schemas
export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportHeaders = z.infer<typeof exportHeadersSchema>;

