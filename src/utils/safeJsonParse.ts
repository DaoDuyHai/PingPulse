/**
 * Parse chuỗi JSON an toàn bằng try/catch, không làm sập chương trình.
 * Nếu JSON hợp lệ -> trả về dữ liệu đã parse.
 * Nếu JSON lỗi -> trả về giá trị fallback (mặc định là null).
 *
 * @param text - Chuỗi JSON cần parse
 * @param fallback - Giá trị dự phòng trả về khi parse thất bại (mặc định là null)
 */
const safeJsonParse = <T>(text: string, fallback: T | null = null): T | null => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

export default safeJsonParse;
