import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { httpLogger, logger } from './config/logger.js';
import userRoutes from './routes/userRoutes.js';
import monitorRoutes from './routes/monitorRoutes.js';
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

app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`PingPulse Server dang chay tai port ${PORT}`);
  });
}
