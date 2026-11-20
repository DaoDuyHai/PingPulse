import { describe, it, expect } from 'vitest';
import safeJsonParse from '../utils/safeJsonParse.js';

describe('PingPulse - safeJsonParse Utility Tests', () => {
  it('should parse valid JSON object', () => {
    const raw = '{"status": "UP", "latencyMs": 42}';
    const result = safeJsonParse<{ status: string; latencyMs: number }>(raw);

    expect(result).toEqual({ status: 'UP', latencyMs: 42 });
  });

  it('should parse valid JSON array', () => {
    const raw = '["https://google.com", "https://github.com"]';
    const result = safeJsonParse<string[]>(raw);

    expect(result).toEqual(['https://google.com', 'https://github.com']);
  });

  it('should return null when JSON is invalid and no fallback provided', () => {
    const invalid = '<html>502 Bad Gateway</html>';
    const result = safeJsonParse(invalid);

    expect(result).toBeNull();
  });

  it('should return fallback value when JSON is invalid', () => {
    const invalid = '<html>502 Bad Gateway</html>';
    const fallback = { error: true, code: 502 };
    const result = safeJsonParse(invalid, fallback);

    expect(result).toEqual(fallback);
  });

  it('should return fallback when string is empty or whitespace', () => {
    expect(safeJsonParse('', 'default')).toBe('default');
    expect(safeJsonParse('   ', 'default')).toBe('default');
  });

  it('should parse primitive JSON values properly', () => {
    expect(safeJsonParse('12345')).toBe(12345);
    expect(safeJsonParse('true')).toBe(true);
    expect(safeJsonParse('false')).toBe(false);
  });
});
