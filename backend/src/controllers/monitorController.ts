import { Prisma } from '@prisma/client';
import { type Request, type Response } from 'express';
import { prisma } from '../config/db.js';
import { checkUrl } from '../checker/checkUrl.js';
import { createHttpError } from '../utils/httpError.js';
import { decideIncident } from '../incident/decideIncident.js';
import { redis } from '../config/redis.js';
import { monitorQueue } from '../queues/monitorQueue.js';
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

  for (const m of createdMonitors) {
    await monitorQueue.upsertJobScheduler(
      `scheduler-monitor-${m.id}`,
      { every: m.interval_sec * 1000 },
      { name: 'check', data: { monitorId: m.id } }
    );
  }

  return res.status(201).json({
    message: 'Da tao monitor thanh cong',
    data: Array.isArray(req.body) ? createdMonitors : createdMonitors[0],
  });
};

interface MonitorWithLatestCheckRow {
  id: number;
  name: string;
  url: string;
  interval_sec: number;
  status: string;
  created_at: Date;
  check_id: bigint | null;
  is_up: boolean | null;
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
  checked_at: Date | null;
}

export const getMonitors = async (req: Request, res: Response) => {
  const userId = getUserId(req);

  const page = Math.max(1, Number(req.query.page) || 1);

  const limit = Math.max(1, Math.min(50, Number(req.query.limit)) || 10);

  const offset = (page - 1) * limit;

  // 1 câu SQL duy nhất dùng LATERAL JOIN kết hợp Composite Index (Tối ưu Max Ping)
  const rows = await prisma.$queryRaw<MonitorWithLatestCheckRow[]>`
    SELECT 
      m.id,
      m.name,
      m.url,
      m.interval_sec,
      m.status,
      m.created_at,
      c.id AS check_id,
      c.is_up,
      c.status_code,
      c.latency_ms,
      c.error,
      c.checked_at
    FROM monitors m
    LEFT JOIN LATERAL (
      SELECT id, is_up, status_code, latency_ms, error, checked_at
      FROM checks
      WHERE monitor_id = m.id
      ORDER BY checked_at DESC
      LIMIT 1
    ) c ON true
    WHERE m.user_id = ${userId}
    ORDER BY m.created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  const data = rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    interval_sec: row.interval_sec,
    status: row.status,
    created_at: row.created_at,
    checks: row.check_id
      ? [
          {
            id: Number(row.check_id),
            monitor_id: row.id,
            is_up: Boolean(row.is_up),
            status_code: row.status_code,
            latency_ms: row.latency_ms,
            error: row.error,
            checked_at: row.checked_at,
          },
        ]
      : [],
  }));

  const total = await prisma.monitors.count({
    where: { user_id: userId },
  });

  return res.status(200).json({
    message: 'Da lay thanh cong danh sach monitor',
    data: {
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
};

export const getDetailMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);

  const monitor = await findOwnedMonitor(monitorId, userId);

  return res.status(200).json({
    message: 'Da lay chi tiet thong tin monitor',
    data: monitor,
  });
};

export const getMonitorChecks = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);
  await findOwnedMonitor(monitorId, userId);

  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

  const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

  const checks = await prisma.checks.findMany({
    where: { monitor_id: monitorId },
    take: limit + 1,
    orderBy: { id: 'desc' },
    ...(cursor
      ? {
          cursor: { id: BigInt(cursor) },
          skip: 1,
        }
      : {}),
  });

  // Nếu số dòng DB trả về > limit (tức là trả về đủ 21 dòng) => Vẫn CÒN trang sau
  const hasNextPage = checks.length > limit;

  // Nếu có trang sau, ta cắt bỏ dòng thứ 21 đó đi để trả về đúng 20 dòng cho client
  const items = hasNextPage ? checks.slice(0, limit) : checks;

  const lastItem = items[items.length - 1];
  const nextCursor = hasNextPage && lastItem ? Number(lastItem.id) : null;

  return res.status(200).json({
    message: 'Da lay danh sach checks thanh cong',
    data: {
      items: items.map(serializeCheck),
      pagination: {
        nextCursor,
        hasNextPage,
      },
    },
  });
};

interface MonitorStatsRow {
  total_checks_24h: bigint;
  uptime_pct_24h: Prisma.Decimal | number | string | null;
  avg_latency_ms_24h: Prisma.Decimal | number | string | null;
  total_checks_7d: bigint;
  uptime_pct_7d: Prisma.Decimal | number | string | null;
  avg_latency_ms_7d: Prisma.Decimal | number | string | null;
}

export const getMonitorStats = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);

  await findOwnedMonitor(monitorId, userId);

  const rows = await prisma.$queryRaw<MonitorStatsRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE checked_at >= NOW() - INTERVAL '24 hours') AS total_checks_24h,
      ROUND(
        COUNT(*) FILTER (WHERE checked_at >= NOW() - INTERVAL '24 hours' AND is_up) * 100.0 /
        NULLIF(COUNT(*) FILTER (WHERE checked_at >= NOW() - INTERVAL '24 hours'), 0),
        2
      ) AS uptime_pct_24h,
      ROUND(
        AVG(latency_ms) FILTER (WHERE checked_at >= NOW() - INTERVAL '24 hours' AND is_up)
      ) AS avg_latency_ms_24h,

      COUNT(*) AS total_checks_7d,
      ROUND(
        COUNT(*) FILTER (WHERE is_up) * 100.0 /
        NULLIF(COUNT(*), 0),
        2
      ) AS uptime_pct_7d,
      ROUND(
        AVG(latency_ms) FILTER (WHERE is_up)
      ) AS avg_latency_ms_7d
    FROM checks
    WHERE monitor_id = ${monitorId}
      AND checked_at >= NOW() - INTERVAL '7 days';
  `;

  const row = rows[0];

  return res.status(200).json({
    message: 'Da lay thong ke monitor thanh cong',
    data: {
      monitor_id: monitorId,
      stats_24h: {
        total_checks: Number(row?.total_checks_24h ?? 0),
        uptime_pct:
          row?.uptime_pct_24h != null ? Number(row.uptime_pct_24h) : null,
        avg_latency_ms:
          row?.avg_latency_ms_24h != null
            ? Number(row.avg_latency_ms_24h)
            : null,
      },
      stats_7d: {
        total_checks: Number(row?.total_checks_7d ?? 0),
        uptime_pct:
          row?.uptime_pct_7d != null ? Number(row.uptime_pct_7d) : null,
        avg_latency_ms:
          row?.avg_latency_ms_7d != null ? Number(row.avg_latency_ms_7d) : null,
      },
    },
  });
};

export const editDetailMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);
  const { name, interval_sec } = req.body;

  const monitor = await findOwnedMonitor(monitorId, userId);

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

  if (monitor.slug) {
    await redis.del(`status:${monitor.slug}`);
  }

  if (interval_sec !== undefined) {
    await monitorQueue.upsertJobScheduler(
      `scheduler-monitor-${updated.id}`,
      { every: updated.interval_sec * 1000 },
      { name: 'check', data: { monitorId: updated.id } }
    );
  }

  return res.status(200).json({
    message: 'Da cap nhat monitor thanh cong',
    data: updated,
  });
};

export const deleteMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);

  const monitor = await findOwnedMonitor(monitorId, userId);

  await prisma.monitors.delete({
    where: { id: monitorId },
  });

  if (monitor.slug) {
    await redis.del(`status:${monitor.slug}`);
  }

  await monitorQueue.removeJobScheduler(`scheduler-monitor-${monitor.id}`);

  return res.status(200).json({ message: 'Da xoa monitor thanh cong' });
};

export const checkNowMonitor = async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const monitorId = parseMonitorId(req.params.id);

  const monitor = await findOwnedMonitor(monitorId, userId);
  const result = await checkUrl(monitor.url);

  const [lastIncident, previousChecks] = await Promise.all([
    prisma.incidents.findFirst({
      where: { monitor_id: monitorId },
      orderBy: { started_at: 'desc' },
    }),
    prisma.checks.findMany({
      where: { monitor_id: monitorId },
      orderBy: { checked_at: 'desc' },
      take: 2,
      select: {
        is_up: true,
        status_code: true,
      },
    }),
  ]);

  const hasOpenIncident =
    lastIncident !== null && lastIncident.resolved_at === null;

  const recentChecks = [
    { isUp: result.isUp, status: result.status },
    ...previousChecks.map((c) => ({
      isUp: c.is_up,
      status: c.status_code ?? 0,
    })),
  ];

  const action = decideIncident(recentChecks, hasOpenIncident);

  let nextStatus = monitor.status;
  if (action === 'open') {
    nextStatus = 'down';
  } else if (action === 'close') {
    nextStatus = 'up';
  } else if (monitor.status === 'unknown' && result.isUp) {
    nextStatus = 'up';
  }

  const [newCheck, newStatusMonitor, incident] = await prisma.$transaction(
    async (tx) => {
      const createCheck = await tx.checks.create({
        data: {
          monitor_id: monitor.id,
          is_up: result.isUp,
          status_code: result.status,
          latency_ms: result.latencyMs,
          error: result.error,
        },
      });

      const updateMonitor = await tx.monitors.update({
        where: { id: monitor.id },
        data: { status: nextStatus },
      });

      let incidentResult = null;

      if (action === 'open') {
        incidentResult = await tx.incidents.create({
          data: {
            monitor_id: monitor.id,
            cause: result.error,
          },
        });
      } else if (action === 'close' && lastIncident) {
        incidentResult = await tx.incidents.update({
          where: { id: lastIncident.id },
          data: { resolved_at: new Date() },
        });
      }

      return [createCheck, updateMonitor, incidentResult];
    }
  );

  if (monitor.slug) {
    await redis.del(`status:${monitor.slug}`);
  }

  return res.status(200).json({
    message: 'Da kiem tra monitor thanh cong',
    data: {
      monitor: newStatusMonitor,
      check: serializeCheck(newCheck),
      incident,
    },
  });
};
