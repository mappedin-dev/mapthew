import { Queue, Worker, type Job as BullJob, type Processor } from 'bullmq';
import type { Job } from './types.js';

const QUEUE_NAME = 'dexter-jobs';

/**
 * Create a BullMQ queue for adding jobs
 */
export function createQueue(redisUrl: string): Queue<Job> {
  const connection = parseRedisUrl(redisUrl);
  return new Queue<Job>(QUEUE_NAME, { connection });
}

/**
 * Create a BullMQ worker for processing jobs
 */
export function createWorker(
  redisUrl: string,
  processor: Processor<Job>
): Worker<Job> {
  const connection = parseRedisUrl(redisUrl);
  return new Worker<Job>(QUEUE_NAME, processor, {
    connection,
    concurrency: 1, // Process one job at a time
  });
}

/**
 * Parse Redis URL into connection options
 */
function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
  };
}

export type { BullJob };
