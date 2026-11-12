import { Prisma } from '@prisma/client';
import { type Request, type Response } from 'express';
import { prisma } from '../config/db.js';
import { checkUrl } from '../checker/checkUrl.js';
import { createHttpError } from '../utils/httpError.js';

const MAX_MONITORS_PER_USER = 5;

function getUserId(req: Request): number {
  const userId = req.user?.id;
  if (!userId) {
    throw createHttpError(401, 'Ban phai dang nhap de thuc hien tac vu nay');
  }
  return userId;
}

function parseMonitorId(rawId: string | string[] | undefined): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, 'ID monitor khong hop le');
  }
  return id;
}

async function findOwnedMonitor(monitorId: number, userId: number) {
  const monitor = await prisma.monitors.findUnique({
    where: { id: monitorId },
  });

  if (!monitor) {
    throw createHttpError(404, 'Khong tim thay monitor');
  }

  if (monitor.user_id !== userId) {
    throw createHttpError(403, 'Ban khong co quyen truy cap monitor nay');
  }

  return monitor;
}

function serializeCheck<T extends { id: bigint }>(check: T) {
  return {
    ...check,
    id: Number(check.id),
  };
}

export const createMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorList = Array.isArray(req.body) ? req.body : [req.body];

  if (monitorList.length === 0 || !req.body) {
    throw createHttpError(400, 'Danh sach monitor khong hop le');
  }

  const currentCount = await prisma.monitors.count({
    where: { user_id: userId },
  });

  if (currentCount + monitorList.length > MAX_MONITORS_PER_USER) {
    throw createHttpError(
      400,
      `Moi tai khoan chi duoc tao toi da ${MAX_MONITORS_PER_USER} monitor (hien tai da co ${currentCount})`
    );
  }

  const errors: { index: number; message: string }[] = [];
  const validItems: {
    name: string;
    url: string;
    interval_sec?: number;
    user_id: number;
  }[] = [];

  monitorList.forEach((item, index) => {
    if (
      !item ||
      typeof item.name !== 'string' ||
      typeof item.url !== 'string' ||
      !item.name.trim() ||
      !item.url.trim()
    ) {
      errors.push({
        index,
        message: 'Phai dien day du thong tin name va url hop le',
      });
      return;
    }

    try {
      const parsedUrl = new URL(item.url.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        errors.push({ index, message: 'URL chi ho tro http hoac https' });
        return;
      }
    } catch {
      errors.push({ index, message: 'Dinh dang url khong hop le' });
      return;
    }

    if (item.interval_sec !== undefined) {
      if (
        typeof item.interval_sec !== 'number' ||
        !Number.isInteger(item.interval_sec) ||
        item.interval_sec <= 0
      ) {
        errors.push({
          index,
          message: 'interval_sec phai la so nguyen duong',
        });
        return;
      }
    }

    validItems.push({
      name: item.name.trim(),
      url: item.url.trim(),
      ...(item.interval_sec !== undefined && {
        interval_sec: item.interval_sec,
      }),
      user_id: userId,
    });
  });

  if (errors.length > 0) {
    throw createHttpError(400, JSON.stringify(errors));
  }

  const createdMonitors = await prisma.$transaction(
    validItems.map((data) =>
      prisma.monitors.create({
        data,
        include: {
          users: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      })
    )
  );

  return res.status(201).json({
    message: 'Da tao monitor thanh cong',
    data: Array.isArray(req.body) ? createdMonitors : createdMonitors[0],
  });
};

interface LatestCheckRow {
  id: bigint;
  monitor_id: number;
  is_up: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
  checked_at: Date;
}

export const getMonitors = async (req: Request, res: Response) => {
  const userId = getUserId(req);

  // Query 1: Lay danh sach monitor cua user
  const monitors = await prisma.monitors.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      url: true,
      interval_sec: true,
      status: true,
      created_at: true,
    },
  });

  if (monitors.length === 0) {
    return res.status(200).json({
      message: 'Da lay thanh cong danh sach monitor',
      data: [],
    });
  }

  // Query 2: Loc dung 1 ban ghi check moi nhat cho moi monitor ngay tai PostgreSQL
  const monitorIds = monitors.map((m) => m.id);
  const latestChecks = await prisma.$queryRaw<LatestCheckRow[]>`
    SELECT DISTINCT ON (monitor_id)
      id, monitor_id, is_up, status_code, latency_ms, error, checked_at
    FROM checks
    WHERE monitor_id IN (${Prisma.join(monitorIds)})
    ORDER BY monitor_id, checked_at DESC
  `;

  const checkByMonitorId = new Map(
    latestChecks.map((check) => [check.monitor_id, serializeCheck(check)])
  );

  const data = monitors.map((monitor) => {
    const latestCheck = checkByMonitorId.get(monitor.id);
    return {
      ...monitor,
      checks: latestCheck ? [latestCheck] : [],
    };
  });

  return res.status(200).json({
    message: 'Da lay thanh cong danh sach monitor',
    data,
  });
};

export const getDetailMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);

  await findOwnedMonitor(monitorId, userId);

  const detailMonitor = await prisma.monitors.findUnique({
    where: { id: monitorId },
    select: {
      id: true,
      name: true,
      url: true,
      interval_sec: true,
      status: true,
      created_at: true,
      checks: {
        orderBy: { checked_at: 'desc' },
      },
    },
  });

  return res.status(200).json({
    message: 'Da lay chi tiet thong tin va lich su check cua monitor',
    data: detailMonitor
      ? {
          ...detailMonitor,
          checks: detailMonitor.checks.map(serializeCheck),
        }
      : null,
  });
};

export const editDetailMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);
  const { name, interval_sec } = req.body;

  await findOwnedMonitor(monitorId, userId);

  if (name === undefined && interval_sec === undefined) {
    throw createHttpError(
      400,
      'Vui long cung cap it nhat name hoac interval_sec de cap nhat'
    );
  }

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw createHttpError(400, 'Ten monitor khong hop le');
  }

  if (
    interval_sec !== undefined &&
    (typeof interval_sec !== 'number' ||
      !Number.isInteger(interval_sec) ||
      interval_sec <= 0)
  ) {
    throw createHttpError(400, 'interval_sec phai la so nguyen duong');
  }

  const updated = await prisma.monitors.update({
    where: { id: monitorId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(interval_sec !== undefined && { interval_sec }),
    },
  });

  return res.status(200).json({
    message: 'Da cap nhat monitor thanh cong',
    data: updated,
  });
};

export const deleteMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);

  await findOwnedMonitor(monitorId, userId);

  await prisma.monitors.delete({
    where: { id: monitorId },
  });

  return res.status(200).json({ message: 'Da xoa monitor thanh cong' });
};

export const checkNowMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);

  const monitor = await findOwnedMonitor(monitorId, userId);
  const result = await checkUrl(monitor.url);
  const newStatus = result.isUp ? 'up' : 'down';

  const [newCheck, updatedMonitor] = await prisma.$transaction([
    prisma.checks.create({
      data: {
        monitor_id: monitor.id,
        is_up: result.isUp,
        status_code: result.status,
        latency_ms: result.latencyMs,
        error: result.error,
      },
    }),
    prisma.monitors.update({
      where: { id: monitor.id },
      data: { status: newStatus },
    }),
  ]);

  return res.status(200).json({
    message: 'Da kiem tra monitor thanh cong',
    data: {
      monitor: updatedMonitor,
      check: serializeCheck(newCheck),
    },
  });
};
