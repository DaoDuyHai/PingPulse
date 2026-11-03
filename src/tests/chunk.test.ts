import { describe, it, expect } from 'vitest';
import chunk from '../utils/chunk.js';

// ==========================================
// 1. Định nghĩa kiểu dữ liệu PingPulse
// ==========================================

interface PingTask {
  readonly id: string;
  readonly url: string;
  readonly timeoutMs: number;
}

// ==========================================
// 2. Test Suite dành cho hàm chunk
// ==========================================

describe('PingPulse - chunk Utility Tests (Vitest)', () => {
  // Test case 1: Chia đều khi số lượng chia hết cho size
  it('should split tasks evenly when array length is divisible by chunk size', () => {
    const tasks: readonly PingTask[] = [
      { id: 't-1', url: 'https://api.pingpulse.dev', timeoutMs: 3000 },
      { id: 't-2', url: 'https://auth.pingpulse.dev', timeoutMs: 3000 },
      { id: 't-3', url: 'https://db.pingpulse.dev', timeoutMs: 3000 },
      { id: 't-4', url: 'https://pay.pingpulse.dev', timeoutMs: 3000 },
    ];

    const batches = chunk(tasks, 2);

    expect(batches).toHaveLength(2);
    expect(batches[0]?.map((t) => t.id)).toEqual(['t-1', 't-2']);
    expect(batches[1]?.map((t) => t.id)).toEqual(['t-3', 't-4']);
  });

  // Test case 2: Chia không đều - mảng con cuối cùng chứa các phần tử còn lại
  it('should place remaining elements into the final chunk when not evenly divisible', () => {
    const monitorUrls: readonly string[] = [
      'https://site-a.com',
      'https://site-b.com',
      'https://site-c.com',
      'https://site-d.com',
      'https://site-e.com',
    ];

    const batches = chunk(monitorUrls, 2);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toEqual(['https://site-a.com', 'https://site-b.com']);
    expect(batches[1]).toEqual(['https://site-c.com', 'https://site-d.com']);
    expect(batches[2]).toEqual(['https://site-e.com']);
  });

  // Test case 3: Kích thước size lớn hơn tổng số phần tử của mảng
  it('should return a single chunk containing all elements when size exceeds array length', () => {
    const serverIds: readonly number[] = [101, 102, 103];
    const batches = chunk(serverIds, 10);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([101, 102, 103]);
  });

  // Test case 4: Mảng đầu vào rỗng []
  it('should return an empty array when given an empty array', () => {
    const emptyList: readonly string[] = [];
    const batches = chunk(emptyList, 5);

    expect(batches).toEqual([]);
  });

  // Test case 5: Ném lỗi khi size <= 0
  it('should throw an Error when size is 0 or negative', () => {
    const items = ['web-1', 'web-2'];

    expect(() => chunk(items, 0)).toThrow('Size must be greater than 0');
    expect(() => chunk(items, -3)).toThrow('Size must be greater than 0');
  });

  // Test case 6: Đảm bảo không làm biến đổi mảng gốc ban đầu
  it('should not mutate the original input array', () => {
    const original: readonly number[] = Object.freeze([1, 2, 3, 4, 5]);

    const result = chunk(original, 2);

    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect(result).toHaveLength(3);
  });
});
