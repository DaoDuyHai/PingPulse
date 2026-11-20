// src/types/express.d.ts
import 'express';

// 1. Khai báo và export luôn UserPayload ra ngoài
export interface UserPayload {
  username: string;
  id: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}