/**
 * Lớp lỗi tùy chỉnh của ứng dụng PingPulse, kế thừa từ Error chuẩn của JavaScript.
 * Bổ sung mã trạng thái HTTP statusCode và cờ isOperational.
 */
export class AppError extends Error {
  public readonly isOperational: boolean;

  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.isOperational = true;

    // Bảo tồn stack trace chuẩn của V8
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export interface ErrorResponse {
  readonly success: false;
  readonly statusCode: number;
  readonly message: string;
  readonly code?: string;
}

/**
 * Hàm xử lý lỗi tập trung an toàn, nhận vào `error: unknown`
 * (theo chuẩn TypeScript strict `useUnknownInCatchVariables`)
 * và luôn trả về đối tượng phản hồi lỗi an toàn, không làm lộ thông tin nhạy cảm.
 */
export function handleError(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      statusCode: error.statusCode,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      statusCode: 500,
      message: error.message,
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  return {
    success: false,
    statusCode: 500,
    message: 'An unexpected unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };
}
