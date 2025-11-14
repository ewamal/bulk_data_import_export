// @ts-nocheck - Prisma mock circular type references
import prismaMock from '../prisma-mock';
import {
  upsertUser,
  upsertArticle,
  upsertComment,
  updateJobStatus,
  updateJobCounts,
  createImportError,
} from '../../app/repositories/importRepository';

describe('Import Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertUser', () => {
    test('should create new user with email', async () => {
      const record = {
        id: '5864905b-ec8c-4fa6-8ba7-545d13f29b4e',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'admin',
        active: true,
      };

      const mockUser = {
        id: 1,
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'imported-user-change-me',
        role: 'admin',
        active: true,
        externalId: '5864905b-ec8c-4fa6-8ba7-545d13f29b4e',
      };

      (prismaMock.user.upsert as jest.Mock).mockResolvedValue(mockUser);

      const result = await upsertUser(record);

      expect(prismaMock.user.upsert).toHaveBeenCalledWith({
        where: { email: 'newuser@example.com' },
        update: expect.objectContaining({
          username: 'newuser',
          role: 'admin',
          active: true,
          externalId: '5864905b-ec8c-4fa6-8ba7-545d13f29b4e',
        }),
        create: expect.objectContaining({
          email: 'newuser@example.com',
          username: 'newuser',
          externalId: '5864905b-ec8c-4fa6-8ba7-545d13f29b4e',
        }),
      });
      expect(result).toEqual(mockUser);
    });

    test('should generate username from name', async () => {
      const record = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      (prismaMock.user.upsert as jest.Mock).mockResolvedValue({});

      await upsertUser(record);

      expect(prismaMock.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            username: 'johndoe',
          }),
        })
      );
    });

    test('should default role to reader', async () => {
      const record = {
        email: 'test@example.com',
        name: 'Test User',
      };

      (prismaMock.user.upsert as jest.Mock).mockResolvedValue({});

      await upsertUser(record);

      expect(prismaMock.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            role: 'reader',
          }),
        })
      );
    });

    test('should not store externalId for integer IDs', async () => {
      const record = {
        id: 123,
        email: 'test@example.com',
        name: 'Test User',
      };

      (prismaMock.user.upsert as jest.Mock).mockResolvedValue({});

      await upsertUser(record);

      expect(prismaMock.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            externalId: null,
          }),
        })
      );
    });
  });

  describe('upsertArticle', () => {
    test('should create article with integer author_id', async () => {
      const record = {
        slug: 'test-article',
        title: 'Test Article',
        body: 'Body',
        author_id: 1,
      };

      (prismaMock.article.upsert as jest.Mock).mockResolvedValue({});

      await upsertArticle(record);

      expect(prismaMock.article.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'test-article' },
          create: expect.objectContaining({
            author: { connect: { id: 1 } },
          }),
        })
      );
    });

    test('should lookup user by externalId for UUID author_id', async () => {
      const record = {
        slug: 'test-article',
        title: 'Test Article',
        body: 'Body',
        author_id: '225e7529-b0be-4dcd-bce9-07caaf0fa1cb',
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 5 });
      (prismaMock.article.upsert as jest.Mock).mockResolvedValue({});

      await upsertArticle(record);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { externalId: '225e7529-b0be-4dcd-bce9-07caaf0fa1cb' },
        select: { id: true },
      });
      expect(prismaMock.article.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            author: { connect: { id: 5 } },
          }),
        })
      );
    });

    test('should throw error if UUID author_id not found', async () => {
      const record = {
        slug: 'test-article',
        title: 'Test Article',
        body: 'Body',
        author_id: '225e7529-b0be-4dcd-bce9-07caaf0fa1cb',
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(upsertArticle(record)).rejects.toThrow(
        'Foreign key violation'
      );
    });

    test('should use title as description fallback', async () => {
      const record = {
        slug: 'test-article',
        title: 'Test Article',
        body: 'Body',
        author_id: 1,
      };

      (prismaMock.article.upsert as jest.Mock).mockResolvedValue({});

      await upsertArticle(record);

      expect(prismaMock.article.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            description: 'Test Article',
          }),
        })
      );
    });
  });

  describe('upsertComment', () => {
    test('should create comment with integer IDs', async () => {
      const record = {
        article_id: 1,
        user_id: 2,
        body: 'Comment body',
      };

      (prismaMock.comment.create as jest.Mock).mockResolvedValue({});

      await upsertComment(record);

      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          body: 'Comment body',
          articleId: 1,
          authorId: 2,
        },
      });
    });

    test('should lookup article by externalId for UUID article_id', async () => {
      const record = {
        article_id: '8fce7dc5-09d1-4ad3-ac40-64a79e78bd38',
        user_id: 2,
        body: 'Comment body',
      };

      (prismaMock.article.findUnique as jest.Mock).mockResolvedValue({ id: 10 });
      (prismaMock.comment.create as jest.Mock).mockResolvedValue({});

      await upsertComment(record);

      expect(prismaMock.article.findUnique).toHaveBeenCalledWith({
        where: { externalId: '8fce7dc5-09d1-4ad3-ac40-64a79e78bd38' },
        select: { id: true },
      });
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 10,
        }),
      });
    });

    test('should lookup user by externalId for UUID user_id', async () => {
      const record = {
        article_id: 1,
        user_id: 'd20181f9-7a30-43e9-8c79-b9d0d2e77edf',
        body: 'Comment body',
      };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 20 });
      (prismaMock.comment.create as jest.Mock).mockResolvedValue({});

      await upsertComment(record);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { externalId: 'd20181f9-7a30-43e9-8c79-b9d0d2e77edf' },
        select: { id: true },
      });
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          authorId: 20,
        }),
      });
    });

    test('should throw error if UUID article_id not found', async () => {
      const record = {
        article_id: 'invalid-uuid',
        user_id: 1,
        body: 'Comment',
      };

      (prismaMock.article.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(upsertComment(record)).rejects.toThrow(
        'Foreign key violation'
      );
    });
  });

  describe('updateJobStatus', () => {
    test('should update job status', async () => {
      const mockJob = { id: 1, status: 'processing' };
      (prismaMock.importJob.update as jest.Mock).mockResolvedValue(mockJob);

      const result = await updateJobStatus(1, 'processing', {
        startedAt: new Date(),
      });

      expect(prismaMock.importJob.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'processing', startedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('updateJobCounts', () => {
    test('should update job counts', async () => {
      const mockJob = { id: 1, totalRecords: 100, successCount: 90, errorCount: 10 };
      prismaMock.importJob.update.mockResolvedValue(mockJob as any);

      const result = await updateJobCounts(1, {
        totalRecords: 100,
        successCount: 90,
        errorCount: 10,
      });

      expect(prismaMock.importJob.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { totalRecords: 100, successCount: 90, errorCount: 10 },
      });
      expect(result).toEqual(mockJob);
    });
  });

  describe('createImportError', () => {
    test('should create import error', async () => {
      const mockError = { id: 1, errorMessage: 'Test error' };
      (prismaMock.importError.create as jest.Mock).mockResolvedValue(mockError);

      const result = await createImportError({
        importJobId: 1,
        recordIndex: 5,
        recordData: { test: 'data' },
        errorMessage: 'Test error',
        errorType: 'VALIDATION_ERROR',
      });

      expect(prismaMock.importError.create).toHaveBeenCalledWith({
        data: {
          importJobId: 1,
          recordIndex: 5,
          recordData: { test: 'data' },
          errorMessage: 'Test error',
          errorType: 'VALIDATION_ERROR',
        },
      });
      expect(result).toEqual(mockError);
    });
  });
});

