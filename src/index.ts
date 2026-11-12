import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import userRoutes from './routes/userRoutes.js';
import monitorRoutes from './routes/monitorRoutes.js';
import { errorHandler } from './middlewares/errorMiddleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

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
    console.log(`PingPulse Server đang chạy tại port ${PORT}`);
  });
}
