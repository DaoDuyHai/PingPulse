import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import debounce from '../utils/debounce.js';

describe('PingPulse - debounce Utility Tests (Vitest)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test case 1: Chỉ chạy đúng 1 lần với tham số cuối cùng khi bị gọi liên tiếp
  it('should only execute once with the latest arguments when called repeatedly', () => {
    const mockSendAlert = vi.fn();
    const debouncedAlert = debounce(mockSendAlert, 300);

    // Giả lập 50 website sập cùng lúc gọi thông báo liên tục
    debouncedAlert('alert-1');
    debouncedAlert('alert-2');
    debouncedAlert('alert-3');

    // Lúc này chưa qua 300ms -> Chưa gửi tin nhắn nào
    expect(mockSendAlert).not.toHaveBeenCalled();

    // Tua thời gian 300ms
    vi.advanceTimersByTime(300);

    // Chỉ gửi duy nhất 1 lần với tham số cuối cùng 'alert-3'
    expect(mockSendAlert).toHaveBeenCalledTimes(1);
    expect(mockSendAlert).toHaveBeenCalledWith('alert-3');
  });

  // Test case 2: Không được chạy trước khi hết thời gian waitMs
  it('should not execute before waitMs has elapsed', () => {
    const mockFn = vi.fn();
    const debounced = debounce(mockFn, 500);

    debounced();

    vi.advanceTimersByTime(499);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  // Test case 3: Reset lại thời gian chờ mỗi khi có cuộc gọi mới
  it('should reset the timer when called again before delay finishes', () => {
    const mockFn = vi.fn();
    const debounced = debounce(mockFn, 200);

    debounced();
    vi.advanceTimersByTime(150); // Còn 50ms nữa là chạy

    debounced(); // Cuộc gọi mới tới -> Reset lại từ đầu thành 200ms
    vi.advanceTimersByTime(150);
    expect(mockFn).not.toHaveBeenCalled(); // Vẫn chưa chạy!

    vi.advanceTimersByTime(50); // Đủ 200ms kể từ lần gọi thứ 2
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  // Test case 4: Tính năng cancel() hủy bỏ lượt thực thi đang chờ
  it('should cancel the pending execution when cancel() is called', () => {
    const mockFn = vi.fn();
    const debounced = debounce(mockFn, 300);

    debounced();
    debounced.cancel(); // Hủy

    vi.advanceTimersByTime(500);
    expect(mockFn).not.toHaveBeenCalled();
  });

  // Test case 5: Kiểm tra kiểu dữ liệu với @ts-expect-error (theo yêu cầu đề bài)
  it('should strictly check argument types and trigger type errors on invalid input', () => {
    const typedFunc = (siteUrl: string, statusCode: number) => {
      return `${siteUrl}:${statusCode}`;
    };

    const debounced = debounce(typedFunc, 100);

    // @ts-expect-error: Cố tình truyền sai kiểu dữ liệu (number thay vì string)
    debounced(12345, 200);

    // @ts-expect-error: Cố tình truyền thiếu tham số
    debounced('https://api.dev');
  });
});
