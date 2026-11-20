import { Queue } from 'bullmq';
import { bullmqConnection } from '../config/redis.js';

export const MONITOR_QUEUE_NAME = 'monitor-checks';

export interface CheckJobData {
  monitorId: number;
}

export const monitorQueue = new Queue<CheckJobData>(MONITOR_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: 100,
  },
});
