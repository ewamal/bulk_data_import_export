// @ts-nocheck - Prisma mock circular type references
import prismaMock from '../prisma-mock';
import {
  createExportJob,
  getExportJobStatus,
} from '../../app/routes/exports/exports.service';

describe('Export Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createExportJob', () => {
    test('should create new export job', async () => {
      const params = {
        resource: 'users' as const,
        format: 'ndjson' as const,
        idempotencyKey: 'export-key-123',
      };

      const mockJob = {
        id: 1,
        idempotencyKey: 'export-key-123',
        resource: 'users',
        format: 'ndjson',
        status: 'pending',
        filters: null,
        fields: null,
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.exportJob.create as jest.Mock).mockResolvedValue(mockJob);

      const result = await createExportJob(params);

      expect(prismaMock.exportJob.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'export-key-123' },
      });
      expect(prismaMock.exportJob.create).toHaveBeenCalledWith({
        data: {
          idempotencyKey: 'export-key-123',
          resource: 'users',
          format: 'ndjson',
          status: 'pending',
          filters: undefined,
          fields: undefined,
        },
      });
      expect(result).toBe('1');
    });

    test('should return existing job id if idempotency key exists', async () => {
      const params = {
        resource: 'articles' as const,
        format: 'json' as const,
        idempotencyKey: 'existing-key',
      };

      const existingJob = {
        id: 5,
        idempotencyKey: 'existing-key',
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(existingJob);

      const result = await createExportJob(params);

      expect(prismaMock.exportJob.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'existing-key' },
      });
      expect(prismaMock.exportJob.create).not.toHaveBeenCalled();
      expect(result).toBe('5');
    });

    test('should create job with filters', async () => {
      const params = {
        resource: 'articles' as const,
        format: 'ndjson' as const,
        idempotencyKey: 'export-with-filters',
        filters: {
          status: 'published',
        },
      };

      const mockJob = {
        id: 2,
        filters: { status: 'published' },
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.exportJob.create as jest.Mock).mockResolvedValue(mockJob);

      await createExportJob(params);

      expect(prismaMock.exportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filters: { status: 'published' },
        }),
      });
    });

    test('should create job with fields', async () => {
      const params = {
        resource: 'users' as const,
        format: 'ndjson' as const,
        idempotencyKey: 'export-with-fields',
        fields: ['id', 'email', 'name'],
      };

      const mockJob = {
        id: 3,
        fields: ['id', 'email', 'name'],
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.exportJob.create as jest.Mock).mockResolvedValue(mockJob);

      await createExportJob(params);

      expect(prismaMock.exportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fields: ['id', 'email', 'name'],
        }),
      });
    });

    test('should create job with filters and fields', async () => {
      const params = {
        resource: 'comments' as const,
        format: 'json' as const,
        idempotencyKey: 'export-complete',
        filters: {
          articleId: '123',
        },
        fields: ['id', 'body'],
      };

      const mockJob = {
        id: 4,
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.exportJob.create as jest.Mock).mockResolvedValue(mockJob);

      await createExportJob(params);

      expect(prismaMock.exportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filters: { articleId: '123' },
          fields: ['id', 'body'],
        }),
      });
    });

    test('should throw error for invalid resource', async () => {
      const params = {
        resource: 'invalid' as any,
        format: 'ndjson' as const,
        idempotencyKey: 'invalid-resource',
      };

      await expect(createExportJob(params)).rejects.toThrow('Invalid resource type');
    });

    test('should throw error for invalid format', async () => {
      const params = {
        resource: 'users' as const,
        format: 'xml' as any,
        idempotencyKey: 'invalid-format',
      };

      await expect(createExportJob(params)).rejects.toThrow('Invalid format');
    });
  });

  describe('getExportJobStatus', () => {
    test('should return export job status', async () => {
      const mockJob = {
        id: 1,
        status: 'completed',
        resource: 'users',
        format: 'ndjson',
        totalRecords: 1000,
        filePath: 'exports/export-1.ndjson',
        downloadUrl: '/api/v1/exports/1/download',
        filters: null,
        fields: null,
        startedAt: new Date('2025-01-13T10:00:00Z'),
        completedAt: new Date('2025-01-13T10:05:00Z'),
        createdAt: new Date('2025-01-13T10:00:00Z'),
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await getExportJobStatus('1');

      expect(prismaMock.exportJob.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({
        job_id: '1',
        status: 'completed',
        resource: 'users',
        format: 'ndjson',
        totalRecords: 1000,
        filePath: 'exports/export-1.ndjson',
        downloadUrl: '/api/v1/exports/1/download',
        filters: null,
        fields: null,
        startedAt: new Date('2025-01-13T10:00:00Z'),
        completedAt: new Date('2025-01-13T10:05:00Z'),
        createdAt: new Date('2025-01-13T10:00:00Z'),
      });
    });

    test('should return pending job status', async () => {
      const mockJob = {
        id: 2,
        status: 'pending',
        resource: 'articles',
        format: 'json',
        totalRecords: 0,
        filePath: null,
        downloadUrl: null,
        filters: { status: 'published' },
        fields: ['id', 'title'],
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2025-01-13T10:00:00Z'),
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await getExportJobStatus('2');

      expect(result.status).toBe('pending');
      expect(result.filters).toEqual({ status: 'published' });
      expect(result.fields).toEqual(['id', 'title']);
    });

    test('should return processing job status', async () => {
      const mockJob = {
        id: 3,
        status: 'processing',
        resource: 'comments',
        format: 'ndjson',
        totalRecords: 500,
        filePath: null,
        downloadUrl: null,
        filters: null,
        fields: null,
        startedAt: new Date('2025-01-13T10:00:00Z'),
        completedAt: null,
        createdAt: new Date('2025-01-13T10:00:00Z'),
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await getExportJobStatus('3');

      expect(result.status).toBe('processing');
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeNull();
    });

    test('should throw error when job not found', async () => {
      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(getExportJobStatus('999')).rejects.toThrow('Export job not found');
    });

    test('should handle string job id', async () => {
      const mockJob = {
        id: 10,
        status: 'completed',
        resource: 'users',
        format: 'ndjson',
        totalRecords: 0,
        filePath: null,
        downloadUrl: null,
        filters: null,
        fields: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await getExportJobStatus('10');

      expect(prismaMock.exportJob.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
      });
      expect(result.job_id).toBe('10');
    });
  });
});

