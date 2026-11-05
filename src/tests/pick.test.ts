import { describe, it, expect } from 'vitest';
import pick from '../utils/pick.js';

// ==========================================
// 1. Định nghĩa kiểu dữ liệu PingPulse
// ==========================================

interface MonitorConfig {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly status: 'UP' | 'DOWN' | 'DEGRADED';
  readonly secretToken: string;
  readonly intervalMs: number;
}

interface HttpCheckLog {
  readonly id: string;
  readonly monitorId: string;
  readonly statusCode: number;
  readonly latencyMs: number;
  readonly rawHeaders: Record<string, string>;
}

// ==========================================
// 2. Test Suite dành cho hàm pick
// ==========================================

describe('PingPulse - pick Utility Tests (Vitest)', () => {
  // Test case 1: Nhặt các trường cần thiết, loại bỏ thông tin nhạy cảm
  it('should pick specified keys and omit sensitive or unnecessary properties', () => {
    const monitor: MonitorConfig = {
      id: 'mon-101',
      name: 'Payment Service',
      url: 'https://pay.pingpulse.dev',
      status: 'UP',
      secretToken: 'super-secret-key-xyz',
      intervalMs: 60000,
    };

    const picked = pick(monitor, ['id', 'name', 'status']);

    expect(picked).toEqual({
      id: 'mon-101',
      name: 'Payment Service',
      status: 'UP',
    });

    // Đảm bảo secretToken và intervalMs không lọt vào kết quả
    expect(picked).not.toHaveProperty('secretToken');
    expect(picked).not.toHaveProperty('intervalMs');
  });

  // Test case 2: Nhặt đúng 1 trường duy nhất (Single key)
  it('should handle picking a single key', () => {
    const log: HttpCheckLog = {
      id: 'log-1',
      monitorId: 'mon-101',
      statusCode: 200,
      latencyMs: 142,
      rawHeaders: { 'content-type': 'application/json' },
    };

    const picked = pick(log, ['latencyMs']);

    expect(picked).toEqual({ latencyMs: 142 });
  });

  // Test case 3: Khi mảng keys rỗng [] -> trả về object rỗng {}
  it('should return an empty object when keys array is empty', () => {
    const monitor: MonitorConfig = {
      id: 'mon-102',
      name: 'Auth API',
      url: 'https://auth.pingpulse.dev',
      status: 'DOWN',
      secretToken: 'auth-token-123',
      intervalMs: 30000,
    };

    const picked = pick(monitor, []);

    expect(picked).toEqual({});
  });

  // Test case 4: Bỏ qua các thuộc tính kế thừa từ prototype (nhờ Object.hasOwn)
  it('should only pick own properties and ignore inherited prototype properties', () => {
    const proto = { inheritedField: 'should not be picked' };
    const child = Object.create(proto) as {
      id: string;
      name: string;
      inheritedField?: string;
    };
    child.id = 'mon-200';
    child.name = 'Worker';

    // Type assertion để truyền key prototype kiểm tra runtime
    const picked = pick(child, ['id', 'inheritedField'] as const);

    expect(picked).toEqual({ id: 'mon-200' });
    expect(picked).not.toHaveProperty('inheritedField');
  });

  // Test case 5: Không làm thay đổi (mutate) object gốc
  it('should not mutate the original object', () => {
    const original: MonitorConfig = Object.freeze({
      id: 'mon-300',
      name: 'Database Cluster',
      url: 'https://db.pingpulse.dev',
      status: 'UP',
      secretToken: 'db-secret',
      intervalMs: 10000,
    });

    const picked = pick(original, ['id', 'name']);

    expect(picked).toEqual({ id: 'mon-300', name: 'Database Cluster' });
    expect(original.secretToken).toBe('db-secret');
  });
});
