import { Queue, Worker, type Job as BullJob, type Processor } from "bullmq";
import type { QueueJob } from "./types.js";
import { getQueueName } from "./config.js";

/**
 * Create a BullMQ queue for adding jobs
 *
 * The queue accepts all job types (regular jobs and system jobs like cleanup)
 */
export function createQueue(redisUrl: string): Queue<QueueJob> {
  const connection = parseRedisUrl(redisUrl);
  return new Queue<QueueJob>(getQueueName(), {
    connection,
    defaultJobOptions: {
      removeOnComplete: {
        age: 86400, // Remove completed jobs after 24 hours
        count: 100, // Keep at most 100 completed jobs
      },
      removeOnFail: {
        age: 604800, // Remove failed jobs after 7 days
      },
    },
  });
}

/**
 * Create a BullMQ worker for processing jobs
 */
export function createWorker(
  redisUrl: string,
  processor: Processor<QueueJob>,
): Worker<QueueJob> {
  const connection = parseRedisUrl(redisUrl);
  return new Worker<QueueJob>(getQueueName(), processor, {
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

export { Queue };
export type { BullJob };
