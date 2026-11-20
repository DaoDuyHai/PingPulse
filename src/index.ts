import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './config/db.js';
import { redis } from './config/redis.js';
import { httpLogger, logger } from './config/logger.js';
import userRoutes from './routes/userRoutes.js';
import monitorRoutes from './routes/monitorRoutes.js';
import statusRoutes from './routes/statusRoutes.js';
import { errorHandler } from './middlewares/errorMiddleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(httpLogger);
app.use(cors());
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Chào mừng đến với PingPulse Server' });
});

app.use('/api/users', userRoutes);
app.use('/api/monitors', monitorRoutes);
app.use('/api/status', statusRoutes);

app.use(errorHandler);

export default app;

async function startServer() {
  try {
    // 1. Thử kết nối thật vào PostgreSQL
    await prisma.$connect();
    logger.info('PostgreSQL da san sang tai cong 5433!');

    // 2. Thử PING một phát tới Redis
    const pong = await redis.ping();
    logger.info(`Redis da san sang tai cong 6379 (Phan hoi: ${pong})!`);

    // 3. Hai ong than deu song khoe -> Mo cong don khach
    app.listen(PORT, () => {
      logger.info(`PingPulse Server dang chay tai port ${PORT}`);
    });
  } catch (error) {
    logger.error(
      { error },
      '❌ Khong the khoi dong server vi loi ket noi Database hoac Redis!'
    );
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
