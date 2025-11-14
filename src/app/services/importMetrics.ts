interface ImportMetrics {
  jobId: number;
  startTime: number;
  processedCount: number;
  errorCount: number;
}

class MetricsTracker {
  private metrics: Map<number, ImportMetrics> = new Map();

  startTracking(jobId: number) {
    this.metrics.set(jobId, {
      jobId,
      startTime: Date.now(),
      processedCount: 0,
      errorCount: 0,
    });
  }

  updateProgress(jobId: number, processed: number, errors: number) {
    const metric = this.metrics.get(jobId);
    if (metric) {
      metric.processedCount = processed;
      metric.errorCount = errors;
    }
  }

  finishTracking(jobId: number) {
    const metric = this.metrics.get(jobId);
    if (metric) {
      const duration = (Date.now() - metric.startTime) / 1000;
      const avgRowsPerSec = duration > 0 
        ? Math.round(metric.processedCount / duration) 
        : 0;
      const finalErrorRate = metric.processedCount > 0
        ? ((metric.errorCount / metric.processedCount) * 100).toFixed(2)
        : '0.00';

      console.log(
        `Job ${jobId} completed:`,
        `duration: ${duration.toFixed(1)}s,`,
        `avg_rows/sec: ${avgRowsPerSec},`,
        `total_rows: ${metric.processedCount},`,
        `error_rate: ${finalErrorRate}%`,
        `(${metric.errorCount} errors)`
      );

      this.metrics.delete(jobId);
    }
  }
}

export const metricsTracker = new MetricsTracker();

