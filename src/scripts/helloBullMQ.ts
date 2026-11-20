import { Queue, Worker } from 'bullmq';

// 1. Cấu hình kết nối Redis cho BullMQ (Bắt buộc maxRetriesPerRequest = null)
const connection = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
};

async function main() {
  console.log('==================================================');
  console.log('⚡ KHỞI ĐỘNG VÍ DỤ HELLO WORLD BULLMQ (TASK 6.1)');
  console.log('==================================================');

  // 2. Tạo Queue (Hàng đợi) - Đóng vai trò PRODUCER (Người giao việc)
  const myQueue = new Queue('hello-queue', { connection });

  // 3. Tạo Worker (Người làm việc) - Đóng vai trò CONSUMER
  const myWorker = new Worker(
    'hello-queue',
    async (job) => {
      console.log(`\n👷 [WORKER] Nhận được job #${job.id} (Tên: "${job.name}")`);
      console.log(`📦 [WORKER] Dữ liệu bên trong job:`, job.data);
      console.log('⏳ [WORKER] Đang giả lập làm việc trong 1 giây...');
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      console.log('✅ [WORKER] Đã hoàn thành job thành công!');
      return { success: true };
    },
    { connection }
  );

  // Lắng nghe sự kiện hoàn thành của Worker
  myWorker.on('completed', (job) => {
    console.log(`🎉 [EVENT] Job #${job.id} đã hoàn tất trọn vẹn!`);
  });

  // 4. Producer: Ném 1 công việc vào hàng đợi
  console.log('\n🚀 [PRODUCER] Đang đẩy 1 job vào Redis Queue...');
  const job = await myQueue.add('sendGreeting', {
    message: 'Xin chào PingPulse! Đây là công việc đầu tiên qua Redis Queue!',
    author: 'Dao Duy Hai',
    createdAt: new Date().toISOString(),
  });

  console.log(`📫 [PRODUCER] Job đã nằm gọn trong Redis với ID: ${job.id}`);
  console.log('👉 Bây giờ quan sát Worker tự động bốc job ra làm...\n');

  // Chờ Worker xử lý xong rồi đóng kết nối an toàn
  await new Promise((resolve) => setTimeout(resolve, 2500));

  await myWorker.close();
  await myQueue.close();
  console.log('\n🏁 Đã dọn dẹp và đóng kết nối Redis an toàn.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
