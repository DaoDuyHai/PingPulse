import { Redis } from 'ioredis';
import { logger } from './logger.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis da ket noi thanh cong tai cong 6379');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Loi ket noi voi Redis');
});

const parsedRedisUrl = new URL(redisUrl);

export const bullmqConnection = {
  host: parsedRedisUrl.hostname || 'localhost',
  port: Number(parsedRedisUrl.port) || 6379,
  password: parsedRedisUrl.password || undefined,
  maxRetriesPerRequest: null,
};
