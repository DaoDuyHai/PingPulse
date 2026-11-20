import 'dotenv/config';
import { Worker } from 'bullmq';
import { prisma } from './config/db.js';
import { bullmqConnection } from './config/redis.js';
import { logger } from './config/logger.js';
import {
  MONITOR_QUEUE_NAME,
  type CheckJobData,
} from './queues/monitorQueue.js';
import { processCheckJob } from './workers/checkProcessor.js';

logger.info('🚀 Đang khởi động tiến trình Background Worker...');

// 1. Khởi tạo Worker lắng nghe trên hàng đợi 'monitor-checks'
const worker = new Worker<CheckJobData>(
  MONITOR_QUEUE_NAME,
  processCheckJob, // Giao nhiệm vụ cho hàm xử lý chúng ta đã viết ở Task 6.2
  {
    connection: bullmqConnection,
    concurrency: 5,
  }
);

// 2. Lắng nghe các sự kiện của Worker để dễ theo dõi
worker.on('ready', () => {
  logger.info(
    `👷 Worker đã sẵn sàng nhận việc trên hàng đợi [${MONITOR_QUEUE_NAME}] (Concurrency: 5)`
  );
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, `❌ Job #${job?.id} xử lý thất bại!`);
});

// 3. 🛡️ GRACEFUL SHUTDOWN (TẮT TIẾN TRÌNH AN TOÀN - CHUẨN SENIOR)
// Khi bạn bấm Ctrl+C hoặc khi Docker tắt container, không được ngắt đột ngột làm hỏng việc!
// Ta cho Worker thời gian hoàn thành nốt các job đang chạy dở rồi mới thoát.
async function shutdown(signal: string) {
  logger.info(`⚠️ Nhận tín hiệu ${signal}, đang đóng Worker an toàn...`);
  try {
    await worker.close();
    await prisma.$disconnect();
    logger.info(
      '🏁 Worker đã dừng hoàn toàn, không có job nào bị rớt dở dang.'
    );
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Lỗi khi đóng Worker');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
