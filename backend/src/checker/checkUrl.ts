export async function checkUrl(url: string, timeoutMs = 5000) {
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return {
      isUp: res.status < 400,
      status: res.status,
      latencyMs: Math.round(performance.now() - start),
      error: null,
    };
  } catch (err) {
    return {
      isUp: false,
      status: null,
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}


