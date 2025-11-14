import { z } from 'zod';

// Request validation
export const importRequestSchema = z.object({
  url: z.string().url('Invalid URL').optional(),
});

// Query validation
export const importQuerySchema = z.object({
  resource: z.enum(['users', 'articles', 'comments'], {
    message: 'resource must be one of: users, articles, comments',
  }),
});

// Headers validation
export const importHeadersSchema = z.object({
  'idempotency-key': z.string().min(1, 'Idempotency-Key is required'),
}).passthrough();

// Export TypeScript types from schemas
export type ImportRequest = z.infer<typeof importRequestSchema>;
export type ImportQuery = z.infer<typeof importQuerySchema>;
export type ImportHeaders = z.infer<typeof importHeadersSchema>;

// Record validation
export const userRecordSchema = z.object({
  id: z.union([z.number().int(), z.string()]), 
  email: z.string().email('Invalid email format'),
  name: z.string().min(1),
  role: z.string().optional(), //role validation requirements are not specified in the documentation
  active: z.boolean().default(true),
  created_at: z.string().optional(), 
  updated_at: z.string().optional(), 
});

export const articleRecordSchema = z.object({
  id: z.union([z.number().int(), z.string()]).optional(), 
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Must be kebab-case'),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  body: z.string().min(1),
  author_id: z.union([z.number().int(), z.string()]).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']).optional(),
  published_at: z.string().optional().nullable(),
}).refine(
  (data) => data.author_id !== undefined,
  { message: 'author_id is required' }
).refine(
  (data) => !(data.status === 'draft' && data.published_at !== null && data.published_at !== undefined),
  { message: 'Draft articles must not have published_at' }
);

export const commentRecordSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),

  article_id: z.union([z.number(), z.string()]), 

  user_id: z.union([z.number(), z.string()]), 

  body: z.string()
    .min(1, "Body is required")
    .max(2500, "Body must be <=500 words"),

  created_at: z.string().optional(),
});

// Export record types
export type UserRecord = z.infer<typeof userRecordSchema>;
export type ArticleRecord = z.infer<typeof articleRecordSchema>;
export type CommentRecord = z.infer<typeof commentRecordSchema>;