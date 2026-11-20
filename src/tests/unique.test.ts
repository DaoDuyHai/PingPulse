import { describe, it, expect } from 'vitest';
import unique from '../utils/unique.js';

describe('PingPulse - unique Utility Tests (Vitest)', () => {
  // Test case 1: Khử trùng lặp danh sách URL (chuỗi string)
  it('should remove duplicate strings such as monitor URLs', () => {
    const urls: readonly string[] = [
      'https://api.pingpulse.dev',
      'https://auth.pingpulse.dev',
      'https://api.pingpulse.dev',
      'https://db.pingpulse.dev',
      'https://auth.pingpulse.dev',
    ];

    const result = unique(urls);

    expect(result).toEqual([
      'https://api.pingpulse.dev',
      'https://auth.pingpulse.dev',
      'https://db.pingpulse.dev',
    ]);
  });

  // Test case 2: Khử trùng lặp danh sách số (HTTP status codes, ports)
  it('should remove duplicate numbers such as ports or status codes', () => {
    const ports: readonly number[] = [80, 443, 80, 8080, 443, 3000];

    const result = unique(ports);

    expect(result).toEqual([80, 443, 8080, 3000]);
  });

  // Test case 3: Mảng rỗng [] -> trả về []
  it('should return an empty array when given an empty array', () => {
    const empty: readonly string[] = [];

    expect(unique(empty)).toEqual([]);
  });

  // Test case 4: Mảng không có phần tử nào trùng lặp
  it('should return the same elements when all items are already unique', () => {
    const protocols: readonly string[] = ['HTTP', 'HTTPS', 'TCP', 'PING'];

    expect(unique(protocols)).toEqual(['HTTP', 'HTTPS', 'TCP', 'PING']);
  });

  // Test case 5: Tất cả các phần tử đều trùng nhau
  it('should return a single item when all elements are identical', () => {
    const statuses = ['DOWN', 'DOWN', 'DOWN', 'DOWN'];

    expect(unique(statuses)).toEqual(['DOWN']);
  });

  // Test case 6: Giữ nguyên thứ tự xuất hiện đầu tiên của từng phần tử
  it('should preserve the original order of the first occurrence of each item', () => {
    const items = ['c', 'b', 'a', 'b', 'c', 'd', 'a'];

    expect(unique(items)).toEqual(['c', 'b', 'a', 'd']);
  });

  // Test case 7: Đảm bảo tính bất biến (Immutability), trả về mảng mới
  it('should not mutate the original array and return a new array reference', () => {
    const original: readonly string[] = Object.freeze(['a', 'b', 'a']);

    const result = unique(original);

    expect(result).toEqual(['a', 'b']);
    expect(result).not.toBe(original);
  });
});

