/**
 * Kiểu Result đại diện cho kết quả của một phép tính có thể thành công hoặc thất bại.
 * Sử dụng kỹ thuật Discriminated Union với trường phân biệt `ok: boolean`.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E };

/**
 * Tạo kết quả thành công chứa dữ liệu `data`.
 */
export const ok = <T>(data: T): Result<T, never> => ({
  ok: true,
  data,
});

/**
 * Tạo kết quả thất bại chứa đối tượng lỗi `error`.
 */
export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
