import { NextFunction, Request, Response, Router } from 'express';
import auth from '../auth/auth';
import { createImportJob, getImportJobStatus } from './imports.service';
import { uploadSingle } from '../../middleware/multerConfig';
import { importRequestSchema, importQuerySchema, importHeadersSchema } from '../../schemas/importSchemas';
import { validateQuery, validateHeaders, validateBodyIfJson, validateFileOrUrl } from '../../middleware/validateBody';

const router = Router();

/**
 * POST /v1/imports
 * Create import job
 * Accepts either:
 * - multipart/form-data with file field
 * - JSON body with url field
 */
router.post(
  '/imports',
  auth.required,
  validateQuery(importQuerySchema),
  validateHeaders(importHeadersSchema),
  uploadSingle('file'),
  validateBodyIfJson(importRequestSchema),
  validateFileOrUrl,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resource = req.query.resource as string;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      const file = req.file;
      const url = req.body?.url;

      const filePath = file ? file.path : null;
      const fileUrl = url || null;

      const jobId = await createImportJob({
        resource,
        idempotencyKey,
        filePath,
        fileUrl,
      });

      res.status(202).json({
        job_id: jobId,
        status: 'accepted',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /v1/imports/:job_id
 * Get import job status
 */
router.get(
  '/imports/:job_id',
  auth.required,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = req.params.job_id;
      const jobStatus = await getImportJobStatus(jobId);
      res.json(jobStatus);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
