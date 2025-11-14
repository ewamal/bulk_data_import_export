import prisma from '../../../prisma/prisma-client';

interface CreateImportJobParams {
  resource: string;
  idempotencyKey: string;
  filePath?: string | null;
  fileUrl?: string | null;
}

/**
 * Create an import job
 * Checks for existing job with idempotency key to prevent duplicates
 */
export async function createImportJob(params: CreateImportJobParams): Promise<string> {
  const { resource, idempotencyKey } = params;

  if (!['users', 'articles', 'comments'].includes(resource)) {
    throw new Error('Invalid resource type');
  }

  const existingJob = await prisma.importJob.findUnique({
    where: { idempotencyKey },
  });

  if (existingJob) {
    // Return existing job ID if it already exists (idempotency)
    return existingJob.id.toString();
  }

  const importJob = await prisma.importJob.create({
    data: {
      idempotencyKey,
      resource,
      status: 'pending',
      filePath: params.filePath || params.fileUrl || null,
    },
  });

  return importJob.id.toString();
}

/**
 * Get import job status
 */
export async function getImportJobStatus(jobId: string) {
  const job = await prisma.importJob.findUnique({
    where: { id: parseInt(jobId) },
    include: {
      errors: {
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit errors returned
      },
    },
  });

  if (!job) {
    throw new Error('Import job not found');
  }

  return {
    job_id: job.id.toString(),
    status: job.status,
    resource: job.resource,
    totalRecords: job.totalRecords,
    successCount: job.successCount,
    errorCount: job.errorCount,
    skippedCount: job.skippedCount,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    errors: job.errors.map((error) => ({
      recordIndex: error.recordIndex,
      errorMessage: error.errorMessage,
      errorType: error.errorType,
      recordData: error.recordData,
    })),
  };
}

