import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sleep from '../utils/sleep.js';

describe('PingPulse - sleep Utility Tests (Vitest)', () => {
  // Test case 1: Kiểm tra đo thời gian chạy thực tế
  it('should pause execution for approximately the specified duration', async () => {
    const start = Date.now();
    await sleep(50); // Chờ 50ms
    const elapsed = Date.now() - start;

    // Cho phép dung sai một chút do scheduler của Node.js
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  // Test case 2: Sử dụng Vitest Fake Timers để tua nhanh thời gian (chuyên nghiệp)
  describe('with Fake Timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve only after the timer advances to the requested time', async () => {
      let isDone = false;

      // Bắt đầu sleep 3000ms (3 giây)
      const promise = sleep(3000).then(() => {
        isDone = true;
      });

      // Tại thời điểm 1500ms: chưa xong
      await vi.advanceTimersByTimeAsync(1500);
      expect(isDone).toBe(false);

      // Tua thêm 1500ms nữa (tổng 3000ms): hoàn thành!
      await vi.advanceTimersByTimeAsync(1500);
      await promise;
      expect(isDone).toBe(true);
    });
  });

  // Test case 3: Xử lý số 0 hoặc số âm (hoàn thành ngay lập tức)
  it('should resolve immediately when ms is 0 or negative', async () => {
    const start = Date.now();
    await sleep(0);
    await sleep(-100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  // Test case 4: Đảm bảo chạy tuần tự trong vòng lặp (ứng dụng cho retry/ping)
  it('should pause sequentially inside a loop', async () => {
    const timestamps: number[] = [];

    for (let i = 0; i < 3; i++) {
      timestamps.push(Date.now());
      await sleep(30);
    }

    expect(timestamps).toHaveLength(3);
    // Thời điểm lần 2 phải lớn hơn lần 1 ít nhất ~20ms
    expect((timestamps[1] ?? 0) - (timestamps[0] ?? 0)).toBeGreaterThanOrEqual(20);
    expect((timestamps[2] ?? 0) - (timestamps[1] ?? 0)).toBeGreaterThanOrEqual(20);
  });
});

