/**
 * Trì hoãn việc thực thi của hàm `fn` cho đến khi trôi qua `waitMs` mili-giây
 * kể từ lần gọi cuối cùng (chống gọi liên tục, chống bão sự kiện).
 *
 * @param fn - Hàm cần thực hiện debounce.
 * @param waitMs - Thời gian chờ tính bằng mili-giây.
 * @returns Hàm debounced có kèm phương thức `cancel()` để hủy nếu cần.
 */
const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number
): ((...args: Args) => void) & { cancel: () => void } => {
  let timer: NodeJS.Timeout | null = null;

  const debounced = (...args: Args): void => {
    // Nếu hàm đang trong thời gian chờ mà bị gọi tiếp -> xóa timer cũ, hẹn giờ lại từ đầu
    if (timer !== null) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, Math.max(0, waitMs));
  };

  // Hỗ trợ hủy hẹn giờ nếu người dùng muốn hủy trước khi chạy
  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
};

export default debounce;
