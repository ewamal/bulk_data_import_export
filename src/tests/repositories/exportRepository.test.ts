// @ts-nocheck - Prisma mock circular type references
import prismaMock from '../prisma-mock';
import {
  updateJobStatus,
  getJob,
} from '../../app/repositories/exportRepository';

describe('Export Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateJobStatus', () => {
    test('should update job status to processing', async () => {
      const mockJob = {
        id: 1,
        status: 'processing',
        startedAt: new Date(),
      };

      (prismaMock.exportJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await updateJobStatus(1, 'processing', {
        startedAt: new Date(),
      });

      expect(prismaMock.exportJob.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'processing',
          startedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockJob);
    });

    test('should update job status to completed with file path', async () => {
      const mockJob = {
        id: 1,
        status: 'completed',
        filePath: 'exports/export-1-1234567890.ndjson',
        downloadUrl: '/api/v1/exports/1/download',
        totalRecords: 1000,
        completedAt: new Date(),
      };

      (prismaMock.exportJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await updateJobStatus(1, 'completed', {
        completedAt: new Date(),
        filePath: 'exports/export-1-1234567890.ndjson',
        downloadUrl: '/api/v1/exports/1/download',
        totalRecords: 1000,
      });

      expect(prismaMock.exportJob.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
          filePath: 'exports/export-1-1234567890.ndjson',
          downloadUrl: '/api/v1/exports/1/download',
          totalRecords: 1000,
        },
      });
      expect(result).toEqual(mockJob);
    });

    test('should update job status to failed', async () => {
      const mockJob = {
        id: 1,
        status: 'failed',
        completedAt: new Date(),
      };

      (prismaMock.exportJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await updateJobStatus(1, 'failed', {
        completedAt: new Date(),
      });

      expect(prismaMock.exportJob.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'failed',
          completedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockJob);
    });

    test('should update job with null file path', async () => {
      const mockJob = {
        id: 1,
        status: 'processing',
        filePath: null,
      };

      (prismaMock.exportJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await updateJobStatus(1, 'processing', {
        filePath: null,
      });

      expect(prismaMock.exportJob.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'processing',
          filePath: null,
        },
      });
      expect(result).toEqual(mockJob);
    });

    test('should update job without additional data', async () => {
      const mockJob = {
        id: 1,
        status: 'pending',
      };

      (prismaMock.exportJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await updateJobStatus(1, 'pending');

      expect(prismaMock.exportJob.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'pending' },
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('getJob', () => {
    test('should retrieve export job by id', async () => {
      const mockJob = {
        id: 1,
        idempotencyKey: 'export-key-123',
        resource: 'users',
        format: 'ndjson',
        status: 'completed',
        totalRecords: 1000,
        filePath: 'exports/export-1.ndjson',
        downloadUrl: '/api/v1/exports/1/download',
        filters: null,
        fields: null,
        startedAt: new Date('2025-01-13'),
        completedAt: new Date('2025-01-13'),
        createdAt: new Date('2025-01-13'),
        updatedAt: new Date('2025-01-13'),
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await getJob(1);

      expect(prismaMock.exportJob.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockJob);
    });

    test('should return null when job not found', async () => {
      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getJob(999);

      expect(prismaMock.exportJob.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
      });
      expect(result).toBeNull();
    });

    test('should retrieve job with filters and fields', async () => {
      const mockJob = {
        id: 2,
        filters: { status: 'published' },
        fields: ['id', 'title', 'body'],
      };

      (prismaMock.exportJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await getJob(2);

      expect(result.filters).toEqual({ status: 'published' });
      expect(result.fields).toEqual(['id', 'title', 'body']);
    });
  });
});

