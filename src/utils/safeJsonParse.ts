import type { Result } from '../types/result.js';

export type { Result };

/**
 * Phân tích cú pháp chuỗi JSON an toàn:
 * - Khi truyền 1 tham số `safeJsonParse(text)`: Trả về `Result<T, Error>` theo chuẩn Discriminated Union.
 * - Khi truyền 2 tham số `safeJsonParse(text, fallback)`: Trả về `T` (nếu lỗi sẽ trả về `fallback`).
 */
function safeJsonParse<T>(text: string): Result<T, Error>;
function safeJsonParse<T>(text: string, fallback: T): T;
function safeJsonParse<T>(
  text: string,
  fallback?: T
): Result<T, Error> | T {
  const hasFallback = arguments.length >= 2;

  try {
    const parsed = JSON.parse(text) as T;
    if (!hasFallback) {
      return { ok: true, data: parsed };
    }
    return parsed;
  } catch (error) {
    if (!hasFallback) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return fallback!;
  }
}

export default safeJsonParse;
