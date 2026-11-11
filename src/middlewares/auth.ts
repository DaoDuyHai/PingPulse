import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { createHttpError } from '../utils/httpError.js';

interface UserPayload {
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

export const verifyUserToken = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createHttpError(
      401,
      'Khong tim thay token hoac sai dinh dang bearer'
    );
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw createHttpError(401, 'Khong tim thay token');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET chua duoc cau hinh trong .env');
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    req.user = decoded;
    next();
  } catch {
    throw createHttpError(401, 'Token khong hop le hoac da het han');
  }
};
