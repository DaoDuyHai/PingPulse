import { type Request, type Response, type NextFunction } from 'express';

import { HttpError } from '../utils/httpError.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: 'Loi may chu noi bo' });
};
