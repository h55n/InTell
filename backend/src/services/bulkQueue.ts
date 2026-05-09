import { v4 as uuidv4 } from 'uuid';
import { cacheSet, cacheGet } from '../cache/redis.js';
import { orchestrate } from '../orchestrator/index.js';
import { logger } from '../utils/logger.js';
import type { StreamEvent } from '../types/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BulkInput {
  input: string;
  inputType?: 'phone' | 'email' | 'name' | 'business';
}

export interface BulkJobResult {
  input: string;
  inputType: string;
  reportId: string | null;
  safetyVerdict: string | null;
  rating: number | null;
  status: 'complete' | 'failed';
  error?: string;
}

export interface BulkJob {
  jobId: string;
  total: number;
  completed: number;
  failed: number;
  status: 'running' | 'done';
  results: BulkJobResult[];
  createdAt: string;
}

const BULK_JOB_TTL = 3600; // 1 hour

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function saveJob(job: BulkJob) {
  await cacheSet(`bulk:${job.jobId}`, JSON.stringify(job), BULK_JOB_TTL);
}

export async function getJob(jobId: string): Promise<BulkJob | null> {
  const raw = await cacheGet(`bulk:${jobId}`);
  return raw ? (JSON.parse(raw) as BulkJob) : null;
}

// ─── Main processor ───────────────────────────────────────────────────────────

export async function processBulk(inputs: BulkInput[]): Promise<string> {
  const jobId = uuidv4();
  const job: BulkJob = {
    jobId,
    total: inputs.length,
    completed: 0,
    failed: 0,
    status: 'running',
    results: [],
    createdAt: new Date().toISOString(),
  };
  await saveJob(job);

  // Fire off in background (don't await)
  void runBulkAsync(inputs, job);

  return jobId;
}

async function runBulkAsync(inputs: BulkInput[], job: BulkJob) {
  const BATCH_SIZE = 3;

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async ({ input, inputType }) => {
        const resolvedType = inputType ?? 'phone';
        // Silent SSE sink — bulk doesn't stream per-agent events
        const sink = (_evt: StreamEvent) => {};
        const report = await orchestrate(input, resolvedType, sink);
        return { input, inputType: resolvedType, report };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { input, inputType, report } = result.value;
        job.results.push({
          input,
          inputType: inputType ?? 'phone',
          reportId: report.id,
          safetyVerdict: report.safetyVerdict,
          rating: report.rating,
          status: 'complete',
        });
        job.completed++;
      } else {
        const failedInput = batch[batchResults.indexOf(result)];
        job.results.push({
          input: failedInput.input,
          inputType: failedInput.inputType ?? 'phone',
          reportId: null,
          safetyVerdict: null,
          rating: null,
          status: 'failed',
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        });
        job.failed++;
      }
    }

    await saveJob(job);
    logger.info(`[Bulk] Batch done ${job.completed + job.failed}/${job.total}`);
  }

  job.status = 'done';
  await saveJob(job);
  logger.info(`[Bulk] Job ${job.jobId} complete — ${job.completed} OK, ${job.failed} failed`);
}
