import express, { type Request, type Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Chào mừng đến với PingPulse Server' });
});

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`PingPulse Server đang chạy tại port ${PORT}`);
  });
}
