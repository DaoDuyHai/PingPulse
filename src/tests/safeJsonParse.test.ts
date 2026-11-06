import { describe, it, expect } from 'vitest';
import safeJsonParse from '../utils/safeJsonParse.js';

describe('PingPulse - safeJsonParse Utility Tests (Vitest)', () => {
  // Test case 1: Parse thành công object JSON hợp lệ
  it('should correctly parse valid JSON object strings', () => {
    const raw = '{"status": "UP", "latencyMs": 42, "url": "https://api.pingpulse.dev"}';
    const fallback = { status: 'DOWN', latencyMs: 0, url: '' };

    const result = safeJsonParse(raw, fallback);

    expect(result).toEqual({
      status: 'UP',
      latencyMs: 42,
      url: 'https://api.pingpulse.dev',
    });
  });

  // Test case 2: Parse thành công mảng JSON hợp lệ
  it('should correctly parse valid JSON array strings', () => {
    const raw = '["https://api.pingpulse.dev", "https://auth.pingpulse.dev"]';
    const fallback: string[] = [];

    const result = safeJsonParse(raw, fallback);

    expect(result).toEqual(['https://api.pingpulse.dev', 'https://auth.pingpulse.dev']);
  });

  // Test case 3: Trả về fallback khi nhận chuỗi lỗi HTML (khi server trả về 502/500 HTML)
  it('should return fallback when receiving malformed HTML error pages', () => {
    const htmlResponse = '<html><body>502 Bad Gateway - Nginx</body></html>';
    const fallback = { error: true, code: 502 };

    const result = safeJsonParse(htmlResponse, fallback);

    expect(result).toEqual(fallback);
  });

  // Test case 4: Trả về fallback khi chuỗi JSON bị thiếu ngoặc hoặc sai cú pháp
  it('should return fallback when JSON string is cut off or malformed', () => {
    const malformed = '{"status": "UP", "latencyMs":';
    const fallback = { status: 'UNKNOWN' };

    expect(safeJsonParse(malformed, fallback)).toEqual(fallback);
    expect(safeJsonParse('{ unquoted_key: 123 }', fallback)).toEqual(fallback);
  });

  // Test case 5: Chuỗi rỗng "" -> trả về fallback
  it('should return fallback when input string is empty', () => {
    const fallback = { default: true };

    expect(safeJsonParse('', fallback)).toEqual(fallback);
    expect(safeJsonParse('   ', fallback)).toEqual(fallback);
  });

  // Test case 6: Parse các giá trị nguyên thủy hợp lệ trong JSON (number, boolean)
  it('should parse primitive JSON values properly', () => {
    expect(safeJsonParse('12345', 0)).toBe(12345);
    expect(safeJsonParse('true', false)).toBe(true);
    expect(safeJsonParse('false', true)).toBe(false);
  });
});
