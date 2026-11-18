import pino from 'pino';
import { pinoHttp } from 'pino-http';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname,responseTime',
          },
        },
      }),
});

export const httpLogger = pinoHttp({
  logger,
  // 1. Bỏ qua các request rác tự động của trình duyệt như favicon
  autoLogging: {
    ignore: (req) => Boolean(req.url && req.url.includes('favicon')),
  },

  // 2. Tinh gọn log: Không dump toàn bộ 50 headers, cookies, IP ra terminal
  serializers: {
    req: () => undefined,
    res: () => undefined,
  },

  // 3. Thông điệp gọn gàng đúng 1 dòng: ví dụ "GET /api/monitors 200 (5ms)"
  customSuccessMessage: (req, res, responseTime) => {
    return `${req.method} ${req.url} ${res.statusCode} (${Math.round(responseTime)}ms)`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },

  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
