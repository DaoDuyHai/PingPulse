import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '../config/db.js';
import { redis, bullmqConnection } from '../config/redis.js';
import { type CheckJobData } from '../queues/monitorQueue.js';
import { processCheckJob } from '../workers/checkProcessor.js';

describe('Task 6.2 & 6.5: BullMQ Check Processor & Incident Lifecycle Integration Test', () => {
  const testUser = {
    username: `workeruser_${Date.now()}`,
    email: `worker_${Date.now()}@pingpulse.com`,
    password_hash: 'hashpass',
  };

  // Dùng queue riêng cho test này để tránh xung đột khi chạy song song với các test file khác
  const TEST_QUEUE = `test-worker-queue-${Date.now()}`;
  let testQueue: Queue<CheckJobData>;
  let worker: Worker<CheckJobData>;

  let userId: number;
  let monitorId: number;

  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );

    testQueue = new Queue<CheckJobData>(TEST_QUEUE, {
      connection: bullmqConnection,
    });

    // 1. Tạo user và monitor mẫu trong PostgreSQL
    const user = await prisma.users.create({ data: testUser });
    userId = user.id;

    const monitor = await prisma.monitors.create({
      data: {
        user_id: userId,
        name: 'Worker Test Service',
        url: 'https://test-worker.com',
        interval_sec: 60,
      },
    });
    monitorId = monitor.id;
  });

  afterAll(async () => {
    if (worker) {
      await worker.close();
    }
    await testQueue.close();

    // Dọn dẹp Database sau khi test xong
    if (monitorId) {
      await prisma.checks.deleteMany({ where: { monitor_id: monitorId } });
      await prisma.incidents.deleteMany({ where: { monitor_id: monitorId } });
      await prisma.monitors.delete({ where: { id: monitorId } });
    }
    if (userId) {
      await prisma.users.delete({ where: { id: userId } });
    }

    await prisma.$disconnect();
    vi.unstubAllGlobals();
  });

  it('1. Hàm processCheckJob nhận job, gọi checkUrl và ghi kết quả vào PostgreSQL', async () => {
    const mockJob = {
      id: 'job-123',
      name: 'check',
      data: { monitorId },
    } as unknown as Job<CheckJobData>;

    const result = await processCheckJob(mockJob);

    expect(result).not.toBeNull();
    expect(result?.isUp).toBe(true);
    expect(result?.statusCode).toBe(200);

    // Kiểm tra trực tiếp trong PostgreSQL xem đã có dòng check mới chưa
    const savedCheck = await prisma.checks.findFirst({
      where: { monitor_id: monitorId },
      orderBy: { checked_at: 'desc' },
    });

    expect(savedCheck).toBeDefined();
    expect(savedCheck?.is_up).toBe(true);
    expect(savedCheck?.status_code).toBe(200);
    expect(savedCheck?.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('2. Bỏ qua an toàn (Graceful Skip) khi monitorId không tồn tại trong DB', async () => {
    const nonExistentId = 99999999;
    const mockJob = {
      id: 'job-ghost',
      name: 'check',
      data: { monitorId: nonExistentId },
    } as unknown as Job<CheckJobData>;

    const result = await processCheckJob(mockJob);
    expect(result).toBeNull();
  });

  it('3. Luồng đẩy qua Redis Queue thật và Worker bốc job tự động xử lý', async () => {
    let completedJobId = '';
    worker = new Worker<CheckJobData>(
      TEST_QUEUE,
      async (job) => {
        return await processCheckJob(job);
      },
      { connection: bullmqConnection }
    );

    const completionPromise = new Promise<void>((resolve) => {
      worker.on('completed', (job) => {
        completedJobId = job.id || '';
        resolve();
      });
    });

    // Producer ném job vào Queue
    const addedJob = await testQueue.add('check', { monitorId });
    expect(addedJob.id).toBeDefined();

    // Chờ Worker tự động bốc job từ Redis ra làm
    await completionPromise;

    expect(completedJobId).toBe(addedJob.id);
  });

  it('4. Task 6.5: Tự động mở sự cố, cập nhật status down, xóa cache khi 3 lần lỗi và đóng sự cố khi phục hồi', async () => {
    const slug = `slug-${Date.now()}`;
    await prisma.monitors.update({
      where: { id: monitorId },
      data: { slug, status: 'up' },
    });

    const mockJob = {
      id: 'job-incident-test',
      name: 'check',
      data: { monitorId },
    } as unknown as Job<CheckJobData>;

    // Cài cache giả định trong Redis
    await redis.set(`status:${slug}`, JSON.stringify({ cached: true }));

    // 1. Giả lập website bị sập (Fetch trả về lỗi 500)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    // Lần check lỗi 1
    await processCheckJob(mockJob);
    let monitor = await prisma.monitors.findUnique({ where: { id: monitorId } });
    expect(monitor?.status).toBe('up'); // Chưa đủ 3 lần lỗi, chưa mở sự cố

    // Lần check lỗi 2
    await processCheckJob(mockJob);
    monitor = await prisma.monitors.findUnique({ where: { id: monitorId } });
    expect(monitor?.status).toBe('up');

    // Lần check lỗi 3: ĐỦ 3 LẦN LỖI LIÊN TIẾP -> Mở sự cố!
    await processCheckJob(mockJob);
    monitor = await prisma.monitors.findUnique({ where: { id: monitorId } });
    expect(monitor?.status).toBe('down');

    const openIncident = await prisma.incidents.findFirst({
      where: { monitor_id: monitorId, resolved_at: null },
    });
    expect(openIncident).not.toBeNull();

    // Kiểm tra cache Redis đã bị xóa sạch (Cache Invalidation)
    const cached = await redis.get(`status:${slug}`);
    expect(cached).toBeNull();

    // 2. Giả lập website hồi phục (Fetch trả về 200 OK)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );

    // Lần check OK 1
    await processCheckJob(mockJob);
    monitor = await prisma.monitors.findUnique({ where: { id: monitorId } });
    expect(monitor?.status).toBe('down'); // Chưa đủ 2 lần OK, vẫn down

    // Lần check OK 2: ĐỦ 2 LẦN OK LIÊN TIẾP -> Đóng sự cố!
    await processCheckJob(mockJob);
    monitor = await prisma.monitors.findUnique({ where: { id: monitorId } });
    expect(monitor?.status).toBe('up');

    const resolvedIncident = await prisma.incidents.findUnique({
      where: { id: openIncident!.id },
    });
    expect(resolvedIncident?.resolved_at).not.toBeNull();
  });
});
