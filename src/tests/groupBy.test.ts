import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import groupBy from '../utils/groupBy.js';

// ==========================================
// 1. Định nghĩa các kiểu dữ liệu thực tế của PingPulse
// ==========================================

type MonitorStatus = 'UP' | 'DOWN' | 'DEGRADED';
type Protocol = 'HTTP' | 'HTTPS' | 'TCP' | 'PING';
type Region = 'ap-southeast-1' | 'us-east-1' | 'eu-central-1';

interface Monitor {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly protocol: Protocol;
  readonly status: MonitorStatus;
  readonly region: Region;
}

interface PingLog {
  readonly id: string;
  readonly monitorId: string;
  readonly statusCode: number;
  readonly latencyMs: number;
  readonly timestamp: number;
}

interface Incident {
  readonly id: string;
  readonly monitorId: string;
  readonly severity: 'CRITICAL' | 'WARNING' | 'INFO';
  readonly message: string;
}

// ==========================================
// 2. Test Suite dành riêng cho PingPulse
// ==========================================

describe('PingPulse - groupBy Utility Tests', () => {
  // Test case 1: Gom nhóm Monitor theo trạng thái hoạt động (UP / DOWN / DEGRADED)
  it('should group monitors by their operational status (UP / DOWN / DEGRADED)', () => {
    const monitors: readonly Monitor[] = [
      {
        id: 'mon-1',
        name: 'API Gateway',
        url: 'https://api.pingpulse.dev',
        protocol: 'HTTPS',
        status: 'UP',
        region: 'ap-southeast-1',
      },
      {
        id: 'mon-2',
        name: 'Auth Service',
        url: 'https://auth.pingpulse.dev',
        protocol: 'HTTPS',
        status: 'DOWN',
        region: 'ap-southeast-1',
      },
      {
        id: 'mon-3',
        name: 'Database Primary',
        url: 'db.pingpulse.internal',
        protocol: 'TCP',
        status: 'UP',
        region: 'us-east-1',
      },
      {
        id: 'mon-4',
        name: 'Payment Webhook',
        url: 'https://pay.pingpulse.dev',
        protocol: 'HTTPS',
        status: 'DEGRADED',
        region: 'eu-central-1',
      },
      {
        id: 'mon-5',
        name: 'Worker Node',
        url: 'worker.pingpulse.internal',
        protocol: 'PING',
        status: 'DOWN',
        region: 'us-east-1',
      },
    ];

    const groupedByStatus = groupBy(monitors, (m) => m.status);

    assert.ok(groupedByStatus.UP);
    assert.ok(groupedByStatus.DOWN);
    assert.ok(groupedByStatus.DEGRADED);

    assert.strictEqual(groupedByStatus.UP.length, 2);
    assert.strictEqual(groupedByStatus.DOWN.length, 2);
    assert.strictEqual(groupedByStatus.DEGRADED.length, 1);

    assert.deepStrictEqual(
      groupedByStatus.UP.map((m) => m.id),
      ['mon-1', 'mon-3']
    );
    assert.deepStrictEqual(
      groupedByStatus.DOWN.map((m) => m.id),
      ['mon-2', 'mon-5']
    );
  });

  // Test case 2: Gom nhóm PingLog theo HTTP status code (number key: 200, 500, 504)
  it('should group ping check logs by numeric HTTP status code', () => {
    const logs: readonly PingLog[] = [
      { id: 'log-1', monitorId: 'mon-1', statusCode: 200, latencyMs: 45, timestamp: 1710000000 },
      { id: 'log-2', monitorId: 'mon-1', statusCode: 200, latencyMs: 52, timestamp: 1710000060 },
      { id: 'log-3', monitorId: 'mon-2', statusCode: 500, latencyMs: 820, timestamp: 1710000120 },
      { id: 'log-4', monitorId: 'mon-3', statusCode: 504, latencyMs: 5000, timestamp: 1710000180 },
      { id: 'log-5', monitorId: 'mon-2', statusCode: 500, latencyMs: 760, timestamp: 1710000240 },
    ];

    const groupedByCode = groupBy(logs, (log) => log.statusCode);

    assert.ok(groupedByCode[200]);
    assert.ok(groupedByCode[500]);
    assert.ok(groupedByCode[504]);

    assert.strictEqual(groupedByCode[200].length, 2);
    assert.strictEqual(groupedByCode[500].length, 2);
    assert.strictEqual(groupedByCode[504].length, 1);

    assert.deepStrictEqual(
      groupedByCode[500].map((l) => l.id),
      ['log-3', 'log-5']
    );
  });

  // Test case 3: Gom nhóm monitors theo Region hạ tầng
  it('should group monitors by deployment region', () => {
    const monitors: readonly Monitor[] = [
      {
        id: 'm-sg',
        name: 'SG Cluster',
        url: 'https://sg.pingpulse.dev',
        protocol: 'HTTPS',
        status: 'UP',
        region: 'ap-southeast-1',
      },
      {
        id: 'm-us',
        name: 'US Cluster',
        url: 'https://us.pingpulse.dev',
        protocol: 'HTTPS',
        status: 'UP',
        region: 'us-east-1',
      },
    ];

    const groupedByRegion = groupBy(monitors, (m) => m.region);

    assert.ok(groupedByRegion['ap-southeast-1']);
    assert.ok(groupedByRegion['us-east-1']);
    assert.strictEqual(groupedByRegion['ap-southeast-1'].length, 1);
    assert.strictEqual(groupedByRegion['us-east-1'].length, 1);
  });

  // Test case 4: Gom nhóm sự cố (Incidents) theo mức độ nghiêm trọng (Severity)
  it('should group alert incidents by severity level', () => {
    const incidents: readonly Incident[] = [
      { id: 'inc-1', monitorId: 'mon-2', severity: 'CRITICAL', message: 'Endpoint unreachable' },
      { id: 'inc-2', monitorId: 'mon-4', severity: 'WARNING', message: 'High response latency > 2000ms' },
      { id: 'inc-3', monitorId: 'mon-1', severity: 'INFO', message: 'SSL certificate renewed' },
    ];

    const groupedBySeverity = groupBy(incidents, (inc) => inc.severity);

    assert.ok(groupedBySeverity.CRITICAL);
    assert.ok(groupedBySeverity.WARNING);
    assert.ok(groupedBySeverity.INFO);
    assert.strictEqual(groupedBySeverity.CRITICAL[0]?.message, 'Endpoint unreachable');
  });

  // Test case 5: Xử lý danh sách log rỗng (Edge case)
  it('should return an empty Record when logs array is empty', () => {
    const emptyLogs: readonly PingLog[] = [];
    const result = groupBy(emptyLogs, (l) => l.statusCode);

    assert.deepStrictEqual(result, {});
  });
});
