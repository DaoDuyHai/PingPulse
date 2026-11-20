import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { prisma } from '../config/db.js';
import { monitorQueue } from '../queues/monitorQueue.js';

describe('Task 6.3: BullMQ Job Scheduler Integration Test', () => {
  const testUser = {
    username: `scheduler_user_${Date.now()}`,
    email: `scheduler_${Date.now()}@pingpulse.com`,
    password: 'password123',
  };

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
  });

  afterAll(async () => {
    if (monitorId) {
      await monitorQueue.removeJobScheduler(`scheduler-monitor-${monitorId}`);
      await prisma.checks.deleteMany({ where: { monitor_id: monitorId } });
      await prisma.monitors.deleteMany({ where: { id: monitorId } });
    }
    await prisma.users.deleteMany({ where: { username: testUser.username } });
    await monitorQueue.close();
    await prisma.$disconnect();
    vi.unstubAllGlobals();
  });

  it('1. Tạo Monitor -> Tự động kích hoạt Job Scheduler trong Redis', async () => {
    const res = await request(app)
      .post('/api/monitors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Automated Scheduled Service',
        url: 'https://pingpulse.com',
        interval_sec: 30,
      });

    expect(res.status).toBe(201);
    monitorId = res.body.data.id;
    expect(monitorId).toBeDefined();

    // Soi trực tiếp vào Redis xem cái đồng hồ scheduler-monitor-${id} đã tồn tại chưa
    const scheduler = await monitorQueue.getJobScheduler(`scheduler-monitor-${monitorId}`);
    expect(scheduler).toBeDefined();
    expect(scheduler?.every).toBe(30 * 1000); // Đúng 30.000 ms
  });

  it('2. Cập nhật interval_sec -> Cập nhật lại chu kỳ mới của Scheduler', async () => {
    const res = await request(app)
      .patch(`/api/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        interval_sec: 120, // Đổi từ 30s sang 120s
      });

    expect(res.status).toBe(200);

    // Kiểm tra trong Redis: Chu kỳ của cái đồng hồ đã đổi sang 120s
    const scheduler = await monitorQueue.getJobScheduler(`scheduler-monitor-${monitorId}`);
    expect(scheduler).toBeDefined();
    expect(scheduler?.every).toBe(120 * 1000); // 120.000 ms
  });

  it('3. Xóa Monitor -> Tự động hủy chiếc đồng hồ trong Redis', async () => {
    const res = await request(app)
      .delete(`/api/monitors/${monitorId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Kiểm tra trong Redis: Cái đồng hồ đã bị xóa hoàn toàn
    const scheduler = await monitorQueue.getJobScheduler(`scheduler-monitor-${monitorId}`);
    expect(scheduler).toBeUndefined();
  });
});
