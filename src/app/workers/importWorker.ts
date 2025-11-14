import prisma from '../../prisma/prisma-client';
import { processImportJob } from '../services/importProcessor';
import { processExportJob } from '../services/exportProcessor';

const POLL_INTERVAL = 5000; // Poll every 5 seconds
const MAX_CONCURRENT_JOBS = 3; // Process up to 3 jobs at once

let isRunning = false;
let activeJobs = new Set<number>();

/**
 * Start polling for pending import and export jobs
 */
export async function startWorker() {
  if (isRunning) {
    console.log('Worker already running');
    return;
  }

  isRunning = true;
  const workerId = `worker-${process.pid}`;
  console.log(`Worker ${workerId} started, polling every ${POLL_INTERVAL / 1000}s...`);

  let pollCount = 0;
  while (isRunning) {
    try {
      pollCount++;
      if (pollCount % 12 === 0) { // Log every minute (12 * 5s)
        console.log(`Worker alive - Active jobs: ${activeJobs.size}/${MAX_CONCURRENT_JOBS}`);
      }
      await pollAndProcessJobs();
    } catch (error) {
      console.error('Error in worker poll cycle:', error);
    }

    // Wait before next poll
    await sleep(POLL_INTERVAL);
  }
}

/**
 * Stop the worker
 */
export function stopWorker() {
  isRunning = false;
  console.log('Worker stopped');
}

/**
 * Poll for pending jobs and process them
 */
async function pollAndProcessJobs() {
  // Don't fetch more jobs if we're at max capacity
  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    return;
  }

  const availableSlots = MAX_CONCURRENT_JOBS - activeJobs.size;

  // Get pending import jobs
  const pendingImports = await prisma.importJob.findMany({
    where: {
      status: 'pending',
      id: {
        notIn: Array.from(activeJobs),
      },
    },
    take: availableSlots,
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Get pending export jobs
  const pendingExports = await prisma.exportJob.findMany({
    where: {
      status: 'pending',
      id: {
        notIn: Array.from(activeJobs),
      },
    },
    take: availableSlots - pendingImports.length,
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Process import jobs
  for (const job of pendingImports) {
    processImportJobAsync(job.id);
  }

  // Process export jobs
  for (const job of pendingExports) {
    processExportJobAsync(job.id);
  }
}

/**
 * Process an import job asynchronously
 */
function processImportJobAsync(jobId: number) {
  activeJobs.add(jobId);
  
  const startTime = Date.now();
  console.log(`Picked up import job ${jobId} (active: ${activeJobs.size}/${MAX_CONCURRENT_JOBS})`);

  processImportJob(jobId)
    .then(() => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Import job ${jobId} completed in ${duration}s`);
    })
    .catch((error) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`Import job ${jobId} failed after ${duration}s:`, error.message);
    })
    .finally(() => {
      activeJobs.delete(jobId);
    });
}

/**
 * Process an export job asynchronously
 */
function processExportJobAsync(jobId: number) {
  activeJobs.add(jobId);
  
  const startTime = Date.now();
  console.log(`Picked up export job ${jobId} (active: ${activeJobs.size}/${MAX_CONCURRENT_JOBS})`);

  processExportJob(jobId)
    .then(() => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Export job ${jobId} completed in ${duration}s`);
    })
    .catch((error) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`Export job ${jobId} failed after ${duration}s:`, error.message);
    })
    .finally(() => {
      activeJobs.delete(jobId);
    });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping worker...');
  stopWorker();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, stopping worker...');
  stopWorker();
});

