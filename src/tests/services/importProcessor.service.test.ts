import { processBatch } from '../../app/services/importProcessor';
import * as repo from '../../app/repositories/importRepository';
import { userRecordSchema } from '../../app/schemas/importSchemas';
import { ZodError } from 'zod';

jest.mock('../../app/repositories/importRepository');

describe('Import Processor', () => {
  const jobId = 1;
  const mockedRepo = repo as jest.Mocked<typeof repo>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processBatch', () => {
    describe('users batch processing', () => {
      it('should handle all successful records', async () => {
        const batch = [
          { email: 'user1@test.com', name: 'User 1', recordIndex: 0 },
          { email: 'user2@test.com', name: 'User 2', recordIndex: 1 },
        ];

        mockedRepo.upsertUser.mockResolvedValue({} as any);
        mockedRepo.updateJobCounts.mockResolvedValue({} as any);

        const result = await processBatch(jobId, 'users', batch);
        
        expect(result).toEqual({ success: 2, error: 0 });
        expect(mockedRepo.upsertUser).toHaveBeenCalledTimes(2);
        expect(mockedRepo.createImportError).not.toHaveBeenCalled();
      });

      it('should handle mixed success and failures', async () => {
        const batch = [
          { email: 'valid@test.com', name: 'Valid', recordIndex: 0 },
          { email: 'invalid', name: 'Invalid', recordIndex: 1 },
          { email: 'valid2@test.com', name: 'Valid2', recordIndex: 2 }
        ];

        mockedRepo.upsertUser
          .mockResolvedValueOnce({} as any)
          .mockRejectedValueOnce(new Error('Invalid email format'))
          .mockResolvedValueOnce({} as any);
        
        mockedRepo.createImportError.mockResolvedValue({} as any);
        mockedRepo.updateJobCounts.mockResolvedValue({} as any);

        const result = await processBatch(jobId, 'users', batch);
        
        expect(result).toEqual({ success: 2, error: 1 });
        expect(mockedRepo.createImportError).toHaveBeenCalledWith(
          expect.objectContaining({
            importJobId: jobId,
            recordIndex: 1,
            errorType: 'Error'
          })
        );
      });

      it('should handle all failures', async () => {
        const batch = [
          { email: 'bad1', name: 'Bad 1', recordIndex: 0 },
          { email: 'bad2', name: 'Bad 2', recordIndex: 1 },
        ];

        mockedRepo.upsertUser.mockRejectedValue(new Error('Invalid'));
        mockedRepo.createImportError.mockResolvedValue({} as any);
        mockedRepo.updateJobCounts.mockResolvedValue({} as any);

        const result = await processBatch(jobId, 'users', batch);
        
        expect(result).toEqual({ success: 0, error: 2 });
        expect(mockedRepo.createImportError).toHaveBeenCalledTimes(2);
      });
    });

    describe('articles batch processing', () => {
      it('should process articles with valid author references', async () => {
        const batch = [
          { 
            slug: 'test-article',
            title: 'Test',
            body: 'Content',
            author_id: 1,
            recordIndex: 0 
          }
        ];

        mockedRepo.upsertArticle.mockResolvedValue({} as any);
        mockedRepo.updateJobCounts.mockResolvedValue({} as any);

        const result = await processBatch(jobId, 'articles', batch);
        
        expect(result).toEqual({ success: 1, error: 0 });
        expect(mockedRepo.upsertArticle).toHaveBeenCalledWith(
          expect.objectContaining({
            slug: 'test-article',
            author_id: 1
          })
        );
      });

      it('should handle foreign key violations', async () => {
        const batch = [
          {
            slug: 'test',
            title: 'Test',
            body: 'Content',
            author_id: 'invalid-uuid',
            recordIndex: 0
          }
        ];

        const fkError = new Error('Foreign key violation: author_id "invalid-uuid" does not exist');
        mockedRepo.upsertArticle.mockRejectedValue(fkError);
        mockedRepo.createImportError.mockResolvedValue({} as any);
        mockedRepo.updateJobCounts.mockResolvedValue({} as any);

        const result = await processBatch(jobId, 'articles', batch);
        
        expect(result).toEqual({ success: 0, error: 1 });
        expect(mockedRepo.createImportError).toHaveBeenCalledWith(
          expect.objectContaining({
            errorMessage: expect.stringContaining('Foreign key violation')
          })
        );
      });
    });

    describe('error recording', () => {
      it('should properly format ZodError messages', async () => {
        let zodError: ZodError;
        try {
          userRecordSchema.parse({ email: 123, name: 'Test' });
          throw new Error('Expected validation to fail');
        } catch (error) {
          if (error instanceof ZodError) {
            zodError = error;
          } else {
            throw error;
          }
        }

        const batch = [{ email: 123, name: 'Test', recordIndex: 0 }];
        
        mockedRepo.upsertUser.mockRejectedValue(zodError);
        mockedRepo.createImportError.mockResolvedValue({} as any);
        mockedRepo.updateJobCounts.mockResolvedValue({} as any);

        await processBatch(jobId, 'users', batch);

        expect(mockedRepo.createImportError).toHaveBeenCalledWith(
          expect.objectContaining({
            errorType: 'VALIDATION_ERROR',
            errorMessage: expect.stringContaining('email')
          })
        );
      });
    });

    describe('job count updates', () => {
      it('should update counts after processing', async () => {
        const batch = [
          { email: 'test@test.com', name: 'Test', recordIndex: 0 }
        ];

        mockedRepo.upsertUser.mockResolvedValue({} as any);
        mockedRepo.updateJobCounts.mockResolvedValue({} as any);

        await processBatch(jobId, 'users', batch);

        expect(mockedRepo.updateJobCounts).toHaveBeenCalledWith(jobId, {
          successCount: { increment: 1 },
          errorCount: { increment: 0 },
        });
      });
    });
  });
});