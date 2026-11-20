import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';

describe('Task 5.2 & 5.3: Cache-Aside & Cache Invalidation Integration Test', () => {
  const testUser = {
    username: `cacheuser_${Date.now()}`,
    email: `cache_${Date.now()}@pingpulse.com`,
    password: 'password123',
  };
  const testSlug = `test-slug-${Date.now()}`;
  let token = '';
  let monitorId: number;

  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );

    // 1. Tạo user và đăng nhập lấy token
    await request(app).post('/api/users/register').send(testUser);
    const loginRes = await request(app).post('/api/users/login').send({
      username: testUser.username,
      password: testUser.password,
    });
    token = loginRes.body.token;

    // 2. Tạo monitor
    const monitorRes = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cache Test Service',
        url: 'https://example.com',
        interval_sec: 60,
      });
    monitorId = monitorRes.body.data.id;

    
    await prisma.monitors.update({
      where: { id: monitorId },
      data: { slug: testSlug },
    });
  });

  afterAll(async () => {
    await redis.del(`status:${testSlug}`);
    await prisma.users.deleteMany({
      where: { username: testUser.username },
    });
    await prisma.$disconnect();
    vi.unstubAllGlobals();
  });

  it('1. Cache-Aside: Lần 1 trả về source: db, Lần 2 trả về source: cache', async () => {
    await redis.del(`status:${testSlug}`);

    // Request 1: Cache Miss
    const res1 = await request(app).get(`/api/status/${testSlug}`);
    expect(res1.status).toBe(200);
    expect(res1.body.source).toBe('db');
    expect(res1.body.data.slug).toBe(testSlug);

    // Kiểm tra TTL trong Redis phải nằm trong khoảng (0, 30]
    const ttl = await redis.ttl(`status:${testSlug}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);

    // Request 2: Cache Hit
    const res2 = await request(app).get(`/api/status/${testSlug}`);
    expect(res2.status).toBe(200);
    expect(res2.body.source).toBe('cache');
    expect(res2.body.data.slug).toBe(testSlug);
  });

  it('2. Cache Invalidation: Bấm Check Now -> Cache bị xóa ngay lập tức', async () => {
    // Đảm bảo cache đang tồn tại trong Redis
    await request(app).get(`/api/status/${testSlug}`);
    const cacheBefore = await redis.get(`status:${testSlug}`);
    expect(cacheBefore).not.toBeNull();

    // Thực hiện Check Now
    const checkRes = await request(app)
      .post(`/api/monitors/${monitorId}/check`)
      .set('Authorization', `Bearer ${token}`);
    expect(checkRes.status).toBe(200);

    // Cache phải bị xóa khỏi Redis ngay lập tức!
    const cacheAfter = await redis.get(`status:${testSlug}`);
    expect(cacheAfter).toBeNull();

    // Lần gọi tiếp theo vào status page bắt buộc phải là 'db' vì cache đã bị xóa
    const resAfter = await request(app).get(`/api/status/${testSlug}`);
    expect(resAfter.status).toBe(200);
    expect(resAfter.body.source).toBe('db');
  });

  it('3. Cache Invalidation: Cập nhật monitor -> Cache bị xóa', async () => {
    // Nạp cache
    await request(app).get(`/api/status/${testSlug}`);
    expect(await redis.get(`status:${testSlug}`)).not.toBeNull();

    // Cập nhật tên monitor
    const updateRes = await request(app)
      .patch(`/api/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Cache Service Name' });
    expect(updateRes.status).toBe(200);

    // Cache trong Redis phải bị xóa!
    const cacheAfterUpdate = await redis.get(`status:${testSlug}`);
    expect(cacheAfterUpdate).toBeNull();
  });

  it('4. Cache Invalidation: Xóa monitor -> Cache bị xóa', async () => {
    // Nạp cache
    await request(app).get(`/api/status/${testSlug}`);
    expect(await redis.get(`status:${testSlug}`)).not.toBeNull();

    // Xóa monitor
    const delRes = await request(app)
      .delete(`/api/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    // Cache trong Redis phải bị xóa!
    const cacheAfterDelete = await redis.get(`status:${testSlug}`);
    expect(cacheAfterDelete).toBeNull();
  });
});
