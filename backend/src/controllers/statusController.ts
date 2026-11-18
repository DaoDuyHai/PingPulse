import { type Request, type Response } from 'express';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import { createHttpError } from '../utils/httpError.js';

export const getPublicSlug = async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    throw createHttpError(400, 'Slug khong hop le');
  }

  const cacheKey = `status:${slug.trim()}`;

  const cacheData = await redis.get(cacheKey);

  if (cacheData) {
    return res.status(200).json({
      source: 'cache',
      data: JSON.parse(cacheData),
    });
  }

  const monitor = await prisma.monitors.findUnique({
    where: {
      slug: slug.trim(),
    },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      interval_sec: true,
      created_at: true,
      checks: {
        orderBy: { checked_at: 'desc' },
        take: 10,
        select: {
          id: true,
          is_up: true,
          status_code: true,
          latency_ms: true,
          checked_at: true,
        },
      },
      incidents: {
        orderBy: { started_at: 'desc' },
        take: 5,
        select: {
          id: true,
          started_at: true,
          resolved_at: true,
          cause: true,
        },
      },
    },
  });

  if (!monitor) {
    throw createHttpError(404, 'Khong tim thay trang trang thai nay');
  }

  const sanitizedData = {
    ...monitor,
    checks: monitor.checks.map((c) => ({
      ...c,
      id: c.id.toString(),
    })),
  };

  await redis.set(cacheKey, JSON.stringify(sanitizedData), 'EX', 30);
  return res.status(200).json({
    source: 'db',
    data: sanitizedData,
  });
};
