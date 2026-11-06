import { describe, it, expect } from 'vitest';
import { AppError, handleError } from '../errors/AppError.js';

describe('PingPulse - AppError & handleError Tests (Vitest)', () => {
  describe('AppError Class', () => {
    it('should correctly construct an AppError instance with statusCode and message', () => {
      const err = new AppError(404, 'Monitor not found', 'MONITOR_NOT_FOUND');

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.name).toBe('AppError');
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Monitor not found');
      expect(err.code).toBe('MONITOR_NOT_FOUND');
      expect(err.isOperational).toBe(true);
    });

    it('should allow optional code property', () => {
      const err = new AppError(400, 'Bad request');

      expect(err.statusCode).toBe(400);
      expect(err.code).toBeUndefined();
    });
  });

  describe('handleError Function', () => {
    it('should handle AppError instances and preserve custom statusCode and message', () => {
      const appErr = new AppError(401, 'Unauthorized access', 'AUTH_REQUIRED');
      const response = handleError(appErr);

      expect(response).toEqual({
        success: false,
        statusCode: 401,
        message: 'Unauthorized access',
        code: 'AUTH_REQUIRED',
      });
    });

    it('should format standard JavaScript Error as internal server error 500', () => {
      const standardErr = new Error('Database connection failed');
      const response = handleError(standardErr);

      expect(response).toEqual({
        success: false,
        statusCode: 500,
        message: 'Database connection failed',
        code: 'INTERNAL_SERVER_ERROR',
      });
    });

    it('should safely handle unknown non-Error values (string, number, null, undefined)', () => {
      expect(handleError('Network dropped')).toEqual({
        success: false,
        statusCode: 500,
        message: 'An unexpected unknown error occurred',
        code: 'UNKNOWN_ERROR',
      });

      expect(handleError(null)).toEqual({
        success: false,
        statusCode: 500,
        message: 'An unexpected unknown error occurred',
        code: 'UNKNOWN_ERROR',
      });

      expect(handleError({ weird: 'object' })).toEqual({
        success: false,
        statusCode: 500,
        message: 'An unexpected unknown error occurred',
        code: 'UNKNOWN_ERROR',
      });
    });
  });
});
