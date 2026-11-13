import { describe, it, expect, vi } from 'vitest';
import retry from '../utils/retry.js';

describe('PingPulse - retry Utility Tests (Vitest)', () => {
  // Test case 1: Thành công ngay từ lần đầu tiên
  it('should return result immediately on first attempt without retrying', async () => {
    const mockCheck = vi.fn().mockResolvedValue({ status: 'UP', latencyMs: 45 });

    const result = await retry(mockCheck, { retries: 3, delayMs: 10 });

    expect(result).toEqual({ status: 'UP', latencyMs: 45 });
    // Chỉ gọi đúng 1 lần, không cần thử lại
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  // Test case 2: Lần 1 và 2 bị lỗi mạng, lần 3 thành công
  it('should retry after errors and return result when a subsequent attempt succeeds', async () => {
    const mockCheck = vi
      .fn()
      .mockRejectedValueOnce(new Error('DNS lookup failed'))
      .mockRejectedValueOnce(new Error('Connection reset'))
      .mockResolvedValueOnce({ status: 'UP', latencyMs: 120 });

    const result = await retry(mockCheck, { retries: 3, delayMs: 10 });

    expect(result).toEqual({ status: 'UP', latencyMs: 120 });
    // Đã gọi đúng 3 lần (2 lần lỗi + 1 lần thành công)
    expect(mockCheck).toHaveBeenCalledTimes(3);
  });

  // Test case 3: Thử hết số lần quy định mà vẫn lỗi -> Ném ra lỗi cuối cùng
  it('should throw the last error when all attempts are exhausted', async () => {
    const mockCheck = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));

    await expect(retry(mockCheck, { retries: 3, delayMs: 10 })).rejects.toThrow(
      '500 Internal Server Error'
    );
    // Đã thử đủ 3 lần trước khi bỏ cuộc
    expect(mockCheck).toHaveBeenCalledTimes(3);
  });

  // Test case 4: Xử lý an toàn khi retries <= 0 (vẫn chạy ít nhất 1 lần)
  it('should execute at least once even if retries is 0 or negative', async () => {
    const mockCheck = vi.fn().mockResolvedValue('success');

    const result = await retry(mockCheck, { retries: 0, delayMs: 10 });

    expect(result).toBe('success');
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  // Test case 5: Đảm bảo không delay thừa thãi sau khi lần thử cuối cùng thất bại
  it('should not wait for delayMs after the final failed attempt', async () => {
    const mockCheck = vi.fn().mockRejectedValue(new Error('Failed'));
    const start = Date.now();

    // 2 lần thử, delay 30ms -> Chỉ có 1 khoảng chờ ở giữa lần 1 và lần 2
    await expect(retry(mockCheck, { retries: 2, delayMs: 30 })).rejects.toThrow('Failed');

    const elapsed = Date.now() - start;
    // Tổng thời gian chỉ khoảng ~30ms, không thể lên tới 60ms vì lần 2 lỗi xong là dừng ngay
    expect(elapsed).toBeLessThan(100);
  });
});
