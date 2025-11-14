import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ParsedQs } from 'qs';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: err.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({ status: 'error', message: 'Invalid request' });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as ParsedQs;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: err.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({ status: 'error', message: 'Invalid request' });
    }
  };
};

export const validateHeaders = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Normalize header keys to lowercase for case-insensitive matching
      const normalizedHeaders: Record<string, any> = {};
      Object.keys(req.headers).forEach((key) => {
        normalizedHeaders[key.toLowerCase()] = req.headers[key];
      });
      
      // Validate the normalized headers
      const validated = schema.parse(normalizedHeaders);
      
      // Merge validated headers back into req.headers
      Object.assign(req.headers, validated);
      
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: err.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({ status: 'error', message: 'Invalid request' });
    }
  };
};

/**
 * Conditionally validates body based on content-type
 * Only validates if content-type is application/json
 */
export const validateBodyIfJson = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      return validateBody(schema)(req, res, next);
    }
    next();
  };
};

/**
 * Validates that either file or url is provided
 */
export const validateFileOrUrl = (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;
  const url = req.body?.url;

  if (!file && !url) {
    return res.status(400).json({
      status: 'error',
      message: 'Either file upload or url is required',
    });
  }
  next();
};