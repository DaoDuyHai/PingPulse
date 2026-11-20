import { type Job } from 'bullmq';

import { prisma } from '../config/db.js';

import { checkUrl } from '../checker/checkUrl.js';

import { type CheckJobData } from '../queues/monitorQueue.js';
import { logger } from '../config/logger.js';
import { decideIncident } from '../incident/decideIncident.js';

import { redis } from '../config/redis.js';

export const processCheckJob = async (job: Job<CheckJobData>) => {
  const { monitorId } = job.data;

  const monitor = await prisma.monitors.findUnique({
    where: {
      id: monitorId,
    },
  });

  if (!monitor) {
    logger.warn(
      { monitorId },
      `Monitor #${monitorId} không tồn tại hoặc đã bị xóa , bỏ qua job`
    );
    return null;
  }

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
      select: { is_up: true, status_code: true },
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

  logger.info(
    {
      monitorId,
      url: monitor.url,
      isUp: result.isUp,
      latencyMs: result.latencyMs,
    },
    `Worker đã check xong Monitor #${monitorId} : ${result.isUp ? 'UP' : 'DOWN'} (${result.latencyMs}ms)`
  );

  return {
    checkId: newCheck.id.toString(),
    isUp: result.isUp,
    statusCode: result.status,
    latencyMs: result.latencyMs,
  };
};
