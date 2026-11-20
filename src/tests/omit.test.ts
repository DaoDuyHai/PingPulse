import { describe, it, expect } from 'vitest';
import omit from '../utils/omit.js';

// ==========================================
// 1. Định nghĩa kiểu dữ liệu PingPulse
// ==========================================

interface MonitorDetail {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly status: 'UP' | 'DOWN' | 'DEGRADED';
  readonly secretToken: string;
  readonly internalIp: string;
}

interface IncidentReport {
  readonly id: string;
  readonly monitorId: string;
  readonly severity: 'CRITICAL' | 'WARNING' | 'INFO';
  readonly debugStackTrace: string;
}

// ==========================================
// 2. Test Suite dành cho hàm omit
// ==========================================

describe('PingPulse - omit Utility Tests (Vitest)', () => {
  // Test case 1: Loại bỏ nhiều trường nhạy cảm khỏi Monitor
  it('should omit specified sensitive keys from monitor detail', () => {
    const monitor: MonitorDetail = {
      id: 'mon-501',
      name: 'Auth Cluster',
      url: 'https://auth.pingpulse.dev',
      status: 'UP',
      secretToken: 'super-secret-jwt-key',
      internalIp: '10.0.0.12',
    };

    const sanitized = omit(monitor, ['secretToken', 'internalIp']);

    expect(sanitized).toEqual({
      id: 'mon-501',
      name: 'Auth Cluster',
      url: 'https://auth.pingpulse.dev',
      status: 'UP',
    });

    expect(sanitized).not.toHaveProperty('secretToken');
    expect(sanitized).not.toHaveProperty('internalIp');
  });

  // Test case 2: Loại bỏ 1 trường duy nhất (ví dụ bỏ stack trace khi gửi thông báo)
  it('should omit a single key properly', () => {
    const incident: IncidentReport = {
      id: 'inc-99',
      monitorId: 'mon-501',
      severity: 'CRITICAL',
      debugStackTrace: 'Error at line 42 in server.ts',
    };

    const publicAlert = omit(incident, ['debugStackTrace']);

    expect(publicAlert).toEqual({
      id: 'inc-99',
      monitorId: 'mon-501',
      severity: 'CRITICAL',
    });
    expect(publicAlert).not.toHaveProperty('debugStackTrace');
  });

  // Test case 3: Mảng keys rỗng [] -> giữ nguyên toàn bộ object gốc
  it('should return a shallow copy with all properties when keys array is empty', () => {
    const monitor: MonitorDetail = {
      id: 'mon-502',
      name: 'Billing API',
      url: 'https://billing.pingpulse.dev',
      status: 'DEGRADED',
      secretToken: 'secret-123',
      internalIp: '10.0.0.15',
    };

    const result = omit(monitor, []);

    expect(result).toEqual(monitor);
    // Đảm bảo tạo ra một bản sao mới (khác tham chiếu)
    expect(result).not.toBe(monitor);
  });

  // Test case 4: Loại bỏ tất cả các trường
  it('should return an empty object when all keys are omitted', () => {
    const simple = { a: 1, b: 2 };
    const result = omit(simple, ['a', 'b']);

    expect(result).toEqual({});
  });

  // Test case 5: Không làm thay đổi (mutate) object gốc
  it('should not mutate the original object', () => {
    const original: MonitorDetail = Object.freeze({
      id: 'mon-503',
      name: 'Payment Webhook',
      url: 'https://pay.pingpulse.dev',
      status: 'UP',
      secretToken: 'top-secret',
      internalIp: '10.0.0.99',
    });

    const result = omit(original, ['secretToken', 'internalIp']);

    expect(result).toEqual({
      id: 'mon-503',
      name: 'Payment Webhook',
      url: 'https://pay.pingpulse.dev',
      status: 'UP',
    });

    // Object gốc vẫn đầy đủ các thuộc tính ban đầu
    expect(original.secretToken).toBe('top-secret');
    expect(original.internalIp).toBe('10.0.0.99');
  });
});

