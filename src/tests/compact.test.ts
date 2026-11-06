import { describe, it, expect } from 'vitest';
import compact from '../utils/compact.js';

describe('PingPulse - compact Utility Tests (Vitest)', () => {
  // Test case 1: Lọc bỏ các dòng trống, null, undefined khỏi danh sách URL
  it('should filter out null, undefined, and empty strings from URL list', () => {
    const rawUrls = [
      'https://api.pingpulse.dev',
      '',
      null,
      'https://auth.pingpulse.dev',
      undefined,
      'https://db.pingpulse.dev',
    ];

    const result = compact(rawUrls);

    expect(result).toEqual([
      'https://api.pingpulse.dev',
      'https://auth.pingpulse.dev',
      'https://db.pingpulse.dev',
    ]);
  });

  // Test case 2: Lọc bỏ tất cả các loại giá trị falsy trong JS (false, 0, "", null, undefined, NaN)
  it('should remove all falsy values (false, 0, "", null, undefined, NaN)', () => {
    const mixed = [0, 1, false, 2, '', 3, null, undefined, NaN, 4];

    const result = compact(mixed);

    expect(result).toEqual([1, 2, 3, 4]);
  });

  // Test case 3: Mảng rỗng [] -> trả về []
  it('should return an empty array when given an empty array', () => {
    expect(compact([])).toEqual([]);
  });

  // Test case 4: Mảng không chứa giá trị falsy nào -> giữ nguyên các phần tử
  it('should return all items when array contains only truthy values', () => {
    const validTags = ['production', 'backend', 'v2'];

    expect(compact(validTags)).toEqual(['production', 'backend', 'v2']);
  });

  // Test case 5: Mảng toàn bộ là giá trị falsy -> trả về []
  it('should return an empty array when all items are falsy', () => {
    const allFalsy = [false, null, undefined, '', 0, NaN];

    expect(compact(allFalsy)).toEqual([]);
  });

  // Test case 6: Giữ nguyên thứ tự ban đầu của các phần tử truthy
  it('should preserve the original order of truthy elements', () => {
    const items = [null, 'first', undefined, 'second', '', 'third'];

    expect(compact(items)).toEqual(['first', 'second', 'third']);
  });

  // Test case 7: Đảm bảo tính bất biến (Immutability), trả về mảng mới
  it('should not mutate the original array and return a new array instance', () => {
    const original = Object.freeze([1, null, 2, undefined]);

    const result = compact(original);

    expect(result).toEqual([1, 2]);
    expect(result).not.toBe(original);
  });
});
