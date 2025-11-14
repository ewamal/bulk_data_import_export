import prisma from '../../prisma/prisma-client';

/**
 * Export Job Repository
 * Handles all database operations for export jobs
 */

export async function updateJobStatus(
  jobId: number,
  status: string,
  data?: { 
    startedAt?: Date; 
    completedAt?: Date;
    filePath?: string | null;
    downloadUrl?: string | null;
    totalRecords?: number;
  }
) {
  return prisma.exportJob.update({
    where: { id: jobId },
    data: { status, ...data },
  });
}

export async function getJob(jobId: number) {
  return prisma.exportJob.findUnique({
    where: { id: jobId },
  });
}

