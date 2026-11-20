import sleep from './sleep.js';

export interface RetryOptions {
  readonly retries: number;
  readonly delayMs: number;
}

const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  const maxAttempts = Math.max(1, options.retries);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts && options.delayMs > 0) {
        await sleep(options.delayMs);
      }
    }
  }

  throw lastError;
};

export default retry;
