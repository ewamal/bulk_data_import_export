import readline from 'readline';
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { userRecordSchema, articleRecordSchema, commentRecordSchema } from '../schemas/importSchemas';
import { ZodError } from 'zod';
import * as repo from '../repositories/importRepository';
import { metricsTracker } from './importMetrics';
import { ResourceType, BatchItem, ProcessBatchResult, ImportRecord } from '../types';

const BATCH_SIZE = 1000;

/**
 * Main entry point - process an import job
 */
export async function processImportJob(jobId: number): Promise<void> {
  console.log(`Processing job ${jobId}`);

  // Start metrics tracking
  metricsTracker.startTracking(jobId);

  const job = await repo.updateJobStatus(jobId, 'processing', { startedAt: new Date() });

  let actualFilePath: string | null = null;
  let downloadedFile = false;

  try {
    if (!job.filePath) throw new Error('No file path');

    // Handle URL downloads
    if (job.filePath.startsWith('http://') || job.filePath.startsWith('https://')) {
      console.log(`Downloading file from URL: ${job.filePath}`);
      actualFilePath = await downloadFile(job.filePath);
      downloadedFile = true;
    } else {
      actualFilePath = job.filePath;
    }

    // Validate file exists
    if (!fs.existsSync(actualFilePath)) throw new Error('File not found');

    // Process based on file type
    if (actualFilePath.endsWith('.ndjson')) {
      await processNdjsonFile(jobId, job.resource as ResourceType, actualFilePath);
    } else if (actualFilePath.endsWith('.csv')) {
      await processCsvFile(jobId, job.resource as ResourceType, actualFilePath);
    } else {
      await processJsonFile(jobId, job.resource as ResourceType, actualFilePath);
    }

    await repo.updateJobStatus(jobId, 'completed', { completedAt: new Date() });
    
    // Log final stats with error rate
    const finalJob = await repo.getJob(jobId);
    if (finalJob) {
      const errorRate = finalJob.totalRecords > 0 
        ? ((finalJob.errorCount / finalJob.totalRecords) * 100).toFixed(2) 
        : '0.00';
      const duration = finalJob.startedAt && finalJob.completedAt
        ? ((finalJob.completedAt.getTime() - finalJob.startedAt.getTime()) / 1000).toFixed(2)
        : 'N/A';
      console.log(
        `Job ${jobId} completed: ${finalJob.totalRecords} records, ` +
        `${finalJob.successCount} success, ${finalJob.errorCount} errors, ` +
        `error_rate: ${errorRate}%, duration: ${duration}s`
      );
    } else {
    console.log(`Job ${jobId} completed`);
    }
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await repo.updateJobStatus(jobId, 'failed', { completedAt: new Date() });
    throw error;
  } finally {
    // Finish metrics tracking
    metricsTracker.finishTracking(jobId);
    
    // Clean up downloaded file
    if (downloadedFile && actualFilePath && fs.existsSync(actualFilePath)) {
      try {
        fs.unlinkSync(actualFilePath);
        console.log(`Cleaned up downloaded file: ${actualFilePath}`);
      } catch (err) {
        console.error(`Failed to clean up file:`, err);
      }
    }
  }
}

/**
 * Process NDJSON file with streaming
 */
async function processNdjsonFile(jobId: number, resource: ResourceType, filePath: string): Promise<void> {
  let recordIndex = 0;
  let successCount = 0;
  let errorCount = 0;
  let batch: BatchItem[] = [];

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    if (!line.trim()) continue;

    const currentIndex = recordIndex++;

    try {
      const record = JSON.parse(line);
      const validated = validateRecord(resource, record);
      batch.push({ ...validated, recordIndex: currentIndex });

      // Process batch when full
      if (batch.length >= BATCH_SIZE) {
        const result = await processBatch(jobId, resource, batch);
        successCount += result.success;
        errorCount += result.error;
        batch = [];

        // Update metrics after each batch
        metricsTracker.updateProgress(jobId, recordIndex, errorCount);

        // Log progress periodically
        if (recordIndex % 10000 === 0) {
          const memUsage = process.memoryUsage();
          const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
          const errorRate = recordIndex > 0 ? ((errorCount / recordIndex) * 100).toFixed(2) : '0.00';
          console.log(
            `Job ${jobId} progress: ${recordIndex} records, ` +
            `${successCount} success, ${errorCount} errors, ` +
            `error_rate: ${errorRate}%, ${memMB}MB heap`
          );
        }
      }
    } catch (error) {
      errorCount++;
      await recordError(jobId, currentIndex, line, error);
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const result = await processBatch(jobId, resource, batch);
    successCount += result.success;
    errorCount += result.error;
  }

  // Final update
  metricsTracker.updateProgress(jobId, recordIndex, errorCount);
  await repo.updateJobCounts(jobId, {
    totalRecords: recordIndex,
    successCount,
    errorCount,
  });
}

/**
 * Process CSV file with streaming
 */
async function processCsvFile(jobId: number, resource: ResourceType, filePath: string): Promise<void> {
  let recordIndex = 0;
  let successCount = 0;
  let errorCount = 0;
  let batch: BatchItem[] = [];
  let headers: string[] = [];

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    if (!line.trim()) continue;

    // First line is headers
    if (recordIndex === 0) {
      headers = line.split(',').map(h => h.trim());
      recordIndex++;
      continue;
    }

    const currentIndex = recordIndex++;

    try {
      // Parse CSV line
      const values = line.split(',').map(v => v.trim());
      const record: any = {};
      
      headers.forEach((header, i) => {
        const value = values[i];
        // Convert empty strings to null/undefined
        if (value === '' || value === undefined) {
          record[header] = undefined;
        } else if (value === 'true') {
          record[header] = true;
        } else if (value === 'false') {
          record[header] = false;
        } else if (!isNaN(Number(value)) && value !== '') {
          record[header] = Number(value);
        } else {
          record[header] = value;
        }
      });

      const validated = validateRecord(resource, record);
      batch.push({ ...validated, recordIndex: currentIndex });

      // Process batch when full
      if (batch.length >= BATCH_SIZE) {
        const result = await processBatch(jobId, resource, batch);
        successCount += result.success;
        errorCount += result.error;
        batch = [];

        // Update metrics after each batch
        metricsTracker.updateProgress(jobId, recordIndex, errorCount);

        // Log progress periodically
        if (recordIndex % 10000 === 0) {
          const memUsage = process.memoryUsage();
          const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
          const errorRate = recordIndex > 0 ? ((errorCount / recordIndex) * 100).toFixed(2) : '0.00';
          console.log(
            `Job ${jobId} progress: ${recordIndex} records, ` +
            `${successCount} success, ${errorCount} errors, ` +
            `error_rate: ${errorRate}%, ${memMB}MB heap`
          );
        }
      }
    } catch (error) {
      errorCount++;
      await recordError(jobId, currentIndex, line, error);
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const result = await processBatch(jobId, resource, batch);
    successCount += result.success;
    errorCount += result.error;
  }

  const totalRecords = recordIndex - 1;
  metricsTracker.updateProgress(jobId, totalRecords, errorCount);
  await repo.updateJobCounts(jobId, {
    totalRecords,
    successCount,
    errorCount,
  });
}

/**
 * Process JSON array file
 */
async function processJsonFile(jobId: number, resource: ResourceType, filePath: string): Promise<void> {
  const records: unknown[] = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
  if (!Array.isArray(records)) throw new Error('JSON must be an array');

  await repo.updateJobCounts(jobId, { totalRecords: records.length });

  let batch: BatchItem[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i++) {
    try {
      const validated = validateRecord(resource, records[i]);
      batch.push({ ...validated, recordIndex: i });

      if (batch.length >= BATCH_SIZE) {
        const result = await processBatch(jobId, resource, batch);
        successCount += result.success;
        errorCount += result.error;
        batch = [];
        // Update metrics periodically
        metricsTracker.updateProgress(jobId, i + 1, errorCount);
      }
    } catch (error) {
      await recordError(jobId, i, records[i], error);
      errorCount++;
    }
  }

  if (batch.length > 0) {
    const result = await processBatch(jobId, resource, batch);
    successCount += result.success;
    errorCount += result.error;
  }

  // Final metrics update
  metricsTracker.updateProgress(jobId, records.length, errorCount);
  await repo.updateJobCounts(jobId, { successCount, errorCount });
}

/**
 * Validate record
 */
function validateRecord(resource: ResourceType, record: unknown): ImportRecord {
  const schemas = {
    users: userRecordSchema,
    articles: articleRecordSchema,
    comments: commentRecordSchema,
  };
  return schemas[resource].parse(record) as ImportRecord;
}

/**
 * Process batch of records
 */
export async function processBatch(jobId: number, resource: ResourceType, batch: BatchItem[]): Promise<ProcessBatchResult> {
  let success = 0;
  let error = 0;

  for (const item of batch) {
    const { recordIndex, ...record } = item;
    try {
      if (resource === 'users') await repo.upsertUser(record);
      else if (resource === 'articles') await repo.upsertArticle(record);
      else if (resource === 'comments') await repo.upsertComment(record);
      success++;
    } catch (err) {
      await recordError(jobId, recordIndex, record, err);
      error++;
    }
  }

  await repo.updateJobCounts(jobId, {
    successCount: { increment: success },
    errorCount: { increment: error },
  });

  return { success, error };
}

/**
 * Record error
 */
async function recordError(jobId: number, recordIndex: number, recordData: unknown, error: unknown): Promise<void> {
  let errorMessage = 'Unknown error';
  let errorType = 'UNKNOWN_ERROR';

  if (error instanceof ZodError) {
    errorMessage = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    errorType = 'VALIDATION_ERROR';
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorType = error.name;
  }

  await repo.createImportError({
    importJobId: jobId,
    recordIndex,
    recordData,
    errorMessage,
    errorType,
  });
}

/**
 * Download file from URL
 */
async function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Detect file extension from URL
    let ext = 'json';
    if (url.includes('.ndjson')) ext = 'ndjson';
    else if (url.includes('.csv')) ext = 'csv';
    
    const fileName = `download-${Date.now()}.${ext}`;
    const filePath = path.join('uploads', fileName);

    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }

    const file = fs.createWriteStream(filePath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`Downloaded file to: ${filePath}`);
        resolve(filePath);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); 
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(filePath, () => {}); 
      reject(err);
    });
  });
}
