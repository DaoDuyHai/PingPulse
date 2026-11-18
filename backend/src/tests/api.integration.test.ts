import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { prisma } from '../config/db.js';

describe('API Integration Test: Luong Nguoi Dung Toan Dien', () => {
  // Dữ liệu mẫu ngẫu nhiên để không bị trùng lặp khi chạy lại test
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@pingpulse.com`,
    password: 'password123',
  };

  let token = '';
  let monitorId: number;

  beforeAll(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );
  });

  afterAll(async () => {
    await prisma.users.deleteMany({
      where: { username: testUser.username },
    });
    await prisma.$disconnect();
    vi.unstubAllGlobals();
  });

  it('1. POST /api/users/register - Dang ky tai khoan thanh cong (201)', async () => {
    const res = await request(app).post('/api/users/register').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.username).toBe(testUser.username);
  });

  it('2. POST /api/users/login - Dang nhap va lay Token (200)', async () => {
    const res = await request(app).post('/api/users/login').send({
      username: testUser.username,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');

    // Lưu token vào biến để các test sau dùng
    token = res.body.token;
  });

  it('3. POST /api/monitors - Tao monitor moi voi Token xac thuc (201)', async () => {
    const res = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Google Health Check',
        url: 'https://google.com',
        interval_sec: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');

    // Lưu monitorId trực tiếp từ Object:
    monitorId = res.body.data.id;
    expect(monitorId).toBeDefined();
  });

  it('4. POST /api/monitors/:id/check - Thuc hien Check Now (200)', async () => {
    const res = await request(app)
      .post(`/api/monitors/${monitorId}/check`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('check');
    expect(res.body.data.check.is_up).toBe(true);
    expect(res.body.data.check.status_code).toBe(200);
    expect(res.body.data.monitor.status).toBe('up');
  });
});
