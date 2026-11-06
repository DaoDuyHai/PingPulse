import { describe, it, expect } from 'vitest';
import safeJsonParse from '../utils/safeJsonParse.js';

describe('PingPulse - safeJsonParse Utility Tests (Vitest)', () => {
  // ========================================================
  // Phần 1: Kiểm thử chế độ Result<T, E> (Discriminated Union)
  // ========================================================
  describe('Result<T, E> Pattern (1 argument)', () => {
    it('should return { ok: true, data } when JSON is valid', () => {
      const raw = '{"status": "UP", "latencyMs": 42}';
      const result = safeJsonParse<{ status: string; latencyMs: number }>(raw);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // TypeScript thu hẹp kiểu an toàn sang result.data
        expect(result.data).toEqual({ status: 'UP', latencyMs: 42 });
      }
    });

    it('should return { ok: false, error } when JSON is invalid without throwing', () => {
      const invalid = '<html>502 Bad Gateway</html>';
      const result = safeJsonParse(invalid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // TypeScript thu hẹp kiểu an toàn sang result.error
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });

  // ========================================================
  // Phần 2: Kiểm thử chế độ Fallback truyền thống (2 arguments)
  // ========================================================
  describe('Fallback Pattern (2 arguments)', () => {
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

    it('should correctly parse valid JSON array strings', () => {
      const raw = '["https://api.pingpulse.dev", "https://auth.pingpulse.dev"]';
      const fallback: string[] = [];

      const result = safeJsonParse(raw, fallback);

      expect(result).toEqual(['https://api.pingpulse.dev', 'https://auth.pingpulse.dev']);
    });

    it('should return fallback when receiving malformed HTML error pages', () => {
      const htmlResponse = '<html><body>502 Bad Gateway - Nginx</body></html>';
      const fallback = { error: true, code: 502 };

      const result = safeJsonParse(htmlResponse, fallback);

      expect(result).toEqual(fallback);
    });

    it('should return fallback when JSON string is cut off or malformed', () => {
      const malformed = '{"status": "UP", "latencyMs":';
      const fallback = { status: 'UNKNOWN' };

      expect(safeJsonParse(malformed, fallback)).toEqual(fallback);
      expect(safeJsonParse('{ unquoted_key: 123 }', fallback)).toEqual(fallback);
    });

    it('should return fallback when input string is empty', () => {
      const fallback = { default: true };

      expect(safeJsonParse('', fallback)).toEqual(fallback);
      expect(safeJsonParse('   ', fallback)).toEqual(fallback);
    });

    it('should parse primitive JSON values properly', () => {
      expect(safeJsonParse('12345', 0)).toBe(12345);
      expect(safeJsonParse('true', false)).toBe(true);
      expect(safeJsonParse('false', true)).toBe(false);
    });
  });
});
