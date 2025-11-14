import {
  exportQuerySchema,
  exportRequestSchema,
  exportHeadersSchema,
} from '../../app/schemas/exportSchemas';
import { ZodError } from 'zod';

describe('Export Schemas', () => {
  describe('exportQuerySchema', () => {
    test('should validate valid query with resource and format', () => {
      const validQuery = {
        resource: 'users',
        format: 'ndjson',
      };

      const result = exportQuerySchema.parse(validQuery);
      expect(result.resource).toBe('users');
      expect(result.format).toBe('ndjson');
    });

    test('should default format to ndjson when not provided', () => {
      const query = {
        resource: 'articles',
      };

      const result = exportQuerySchema.parse(query);
      expect(result.resource).toBe('articles');
      expect(result.format).toBe('ndjson');
    });

    test('should accept json format', () => {
      const query = {
        resource: 'comments',
        format: 'json',
      };

      const result = exportQuerySchema.parse(query);
      expect(result.format).toBe('json');
    });

    test('should require resource', () => {
      const invalidQuery = {
        format: 'ndjson',
      };

      expect(() => exportQuerySchema.parse(invalidQuery)).toThrow();
    });

    test('should reject invalid resource', () => {
      const invalidQuery = {
        resource: 'invalid',
        format: 'ndjson',
      };

      expect(() => exportQuerySchema.parse(invalidQuery)).toThrow('resource must be one of');
    });

    test('should reject invalid format', () => {
      const invalidQuery = {
        resource: 'users',
        format: 'xml',
      };

      expect(() => exportQuerySchema.parse(invalidQuery)).toThrow();
    });
  });

  describe('exportRequestSchema', () => {
    test('should validate valid request with resource only', () => {
      const validRequest = {
        resource: 'users',
      };

      const result = exportRequestSchema.parse(validRequest);
      expect(result.resource).toBe('users');
      expect(result.format).toBe('ndjson');
    });

    test('should validate request with filters', () => {
      const request = {
        resource: 'articles',
        format: 'ndjson',
        filters: {
          status: 'published',
        },
      };

      const result = exportRequestSchema.parse(request);
      expect(result.resource).toBe('articles');
      expect(result.filters).toEqual({ status: 'published' });
    });

    test('should validate request with fields', () => {
      const request = {
        resource: 'users',
        format: 'json',
        fields: ['id', 'email', 'name'],
      };

      const result = exportRequestSchema.parse(request);
      expect(result.fields).toEqual(['id', 'email', 'name']);
    });

    test('should validate request with filters and fields', () => {
      const request = {
        resource: 'articles',
        format: 'ndjson',
        filters: {
          status: 'published',
          authorId: '123',
        },
        fields: ['id', 'title', 'body'],
      };

      const result = exportRequestSchema.parse(request);
      expect(result.filters).toEqual({ status: 'published', authorId: '123' });
      expect(result.fields).toEqual(['id', 'title', 'body']);
    });

    test('should require resource', () => {
      const invalidRequest = {
        format: 'ndjson',
      };

      expect(() => exportRequestSchema.parse(invalidRequest)).toThrow();
    });

    test('should reject invalid resource', () => {
      const invalidRequest = {
        resource: 'invalid',
      };

      expect(() => exportRequestSchema.parse(invalidRequest)).toThrow();
    });

    test('should reject invalid format', () => {
      const invalidRequest = {
        resource: 'users',
        format: 'csv',
      };

      expect(() => exportRequestSchema.parse(invalidRequest)).toThrow();
    });

    test('should accept empty filters object', () => {
      const request = {
        resource: 'users',
        filters: {},
      };

      const result = exportRequestSchema.parse(request);
      expect(result.filters).toEqual({});
    });

    test('should accept empty fields array', () => {
      const request = {
        resource: 'users',
        fields: [],
      };

      const result = exportRequestSchema.parse(request);
      expect(result.fields).toEqual([]);
    });
  });

  describe('exportHeadersSchema', () => {
    test('should validate valid headers with idempotency-key', () => {
      const validHeaders = {
        'idempotency-key': 'unique-key-123',
      };

      const result = exportHeadersSchema.parse(validHeaders);
      expect(result['idempotency-key']).toBe('unique-key-123');
    });

    test('should require idempotency-key', () => {
      const invalidHeaders = {};

      // Zod throws "expected string, received undefined" when field is missing
      // The min(1) validation only applies when the value is a string
      expect(() => exportHeadersSchema.parse(invalidHeaders)).toThrow(ZodError);
      
      try {
        exportHeadersSchema.parse(invalidHeaders);
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        if (error instanceof ZodError) {
          expect(error.issues[0].path).toContain('idempotency-key');
          expect(error.issues[0].code).toBe('invalid_type');
        }
      }
    });

    test('should reject empty idempotency-key', () => {
      const invalidHeaders = {
        'idempotency-key': '',
      };

      expect(() => exportHeadersSchema.parse(invalidHeaders)).toThrow('Idempotency-Key is required');
    });

    test('should allow additional headers (passthrough)', () => {
      const headers = {
        'idempotency-key': 'unique-key-123',
        'authorization': 'Bearer token',
        'content-type': 'application/json',
      };

      const result = exportHeadersSchema.parse(headers);
      expect(result['idempotency-key']).toBe('unique-key-123');
      expect(result['authorization']).toBe('Bearer token');
      expect(result['content-type']).toBe('application/json');
    });
  });
});

