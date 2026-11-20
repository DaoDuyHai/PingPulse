import { type Request, type Response, type NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Lua script thực thi nguyên tử trong 1 lần gọi Redis
const RATE_LIMIT_SCRIPT = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  local ttl = redis.call("TTL", KEYS[1])
  return {current, ttl}
`;

export function rateLimiter(limit: number = 60, windowSec: number = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Cho phép bypass khi benchmark đo tải hoặc khi cắm cờ môi trường
      if (
        process.env.DISABLE_RATE_LIMIT === 'true' ||
        req.headers['x-bypass-rate-limit'] === 'true'
      ) {
        return next();
      }
      // 1. Chuẩn hóa IP an toàn (hỗ trợ X-Forwarded-For khi chạy sau Nginx/Proxy và cả IPv4, IPv6)
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp =
        (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
        req.ip ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const ip = rawIp === '::1' ? '127.0.0.1' : rawIp.replace(/^::ffff:/, '');

      // Gắn thêm route/path nếu muốn giới hạn riêng từng endpoint, hoặc giữ nguyên nếu giới hạn toàn cục
      const key = `rl:${ip}`;

      // 2. Thực thi Lua Script (ioredis dùng .eval, node-redis dùng .eval)
      // Giả sử bạn đang dùng thư viện `ioredis`:
      const [count, ttl] = (await redis.eval(
        RATE_LIMIT_SCRIPT,
        1,
        key,
        windowSec.toString()
      )) as [number, number];

      const remainingSec = ttl > 0 ? ttl : windowSec;

      // 3. Set Headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
      res.setHeader('X-RateLimit-Reset', remainingSec);

      // 4. Kiểm tra vượt ngưỡng
      if (count > limit) {
        res.setHeader('Retry-After', remainingSec);
        return res.status(429).json({
          message: 'Bạn đã gửi quá nhiều request. Vui lòng thử lại sau.',
          retryAfter: remainingSec,
        });
      }

      return next();
    } catch (error) {
      logger.error(
        { error },
        '⚠️ Redis Rate Limiter gặp lỗi, áp dụng fail-open cho request qua'
      );
      return next();
    }
  };
}
