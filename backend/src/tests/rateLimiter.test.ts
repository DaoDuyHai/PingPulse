import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';

describe('Task 5.4: Rate Limiting Middleware Integration Test', () => {
  const testUser = {
    username: `rluser_${Date.now()}`,
    email: `rl_${Date.now()}@pingpulse.com`,
    password: 'password123',
  };
  const testSlug = `rate-limit-slug-${Date.now()}`;
  const testIp = `10.99.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
  const rateLimitKey = `rl:${testIp}`;

  let userId: number;
  let monitorId: number;

  beforeAll(async () => {
    // 1. Tạo user và monitor có slug
    const user = await prisma.users.create({
      data: {
        username: testUser.username,
        email: testUser.email,
        password_hash: 'hashedpassword',
      },
    });
    userId = user.id;

    const monitor = await prisma.monitors.create({
      data: {
        user_id: userId,
        name: 'Rate Limit Test Service',
        url: 'https://example.com',
        slug: testSlug,
      },
    });
    monitorId = monitor.id;
  });

  afterAll(async () => {
    // Xóa key rate limit và key cache
    await redis.del(`status:${testSlug}`);
    await redis.del(rateLimitKey);

    if (monitorId) {
      await prisma.monitors.delete({
        where: { id: monitorId },
      });
    }
    if (userId) {
      await prisma.users.delete({
        where: { id: userId },
      });
    }
    await prisma.$disconnect();
  });

  it('1. Đặt đầy đủ các Headers chuẩn Rate Limit (Limit, Remaining, Reset)', async () => {
    await redis.del(rateLimitKey);

    const res = await request(app)
      .get(`/api/status/${testSlug}`)
      .set('X-Forwarded-For', testIp);

    expect(res.status).toBe(200);

    expect(res.headers).toHaveProperty('x-ratelimit-limit');
    expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    expect(res.headers).toHaveProperty('x-ratelimit-reset');

    expect(Number(res.headers['x-ratelimit-limit'])).toBe(60);
    expect(Number(res.headers['x-ratelimit-remaining'])).toBe(59);
    expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(0);
  });

  it('2. Chặn request thứ 61 và trả về mã HTTP 429 kèm Retry-After', async () => {
    await redis.del(rateLimitKey);

    // Bắn 60 request liên tiếp (mô phỏng người dùng bình thường trong ngưỡng cho phép)
    for (let i = 1; i <= 60; i++) {
      const res = await request(app)
        .get(`/api/status/${testSlug}`)
        .set('X-Forwarded-For', testIp);

      expect(res.status).toBe(200);
      expect(Number(res.headers['x-ratelimit-remaining'])).toBe(60 - i);
    }

    // Request thứ 61: Phải bị chặn đứng ngay lập tức!
    const res61 = await request(app)
      .get(`/api/status/${testSlug}`)
      .set('X-Forwarded-For', testIp);

    expect(res61.status).toBe(429);
    expect(res61.body).toHaveProperty('message');
    expect(res61.body).toHaveProperty('retryAfter');
    expect(res61.headers).toHaveProperty('retry-after');
    expect(Number(res61.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(res61.headers['x-ratelimit-remaining'])).toBe(0);
  });
});
