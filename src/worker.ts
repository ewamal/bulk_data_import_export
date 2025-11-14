/**
 * Standalone worker process for processing import and export jobs
 * Run this separately: node dist/worker/worker.js
 */

import { startWorker } from './app/workers/importWorker';

console.log('Starting worker...');

startWorker().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});

