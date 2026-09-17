/**
 * @module server/services/rateLimit
 * @description In-memory token bucket rate limiter per client IP.
 */

export function createRateLimiter({ maxTokens = 60, refillIntervalMs = 60000 } = {}) {
  const clients = new Map();

  return function checkLimit(clientIp = '127.0.0.1') {
    const now = Date.now();
    let state = clients.get(clientIp);

    if (!state) {
      state = { tokens: maxTokens, lastRefill: now };
      clients.set(clientIp, state);
    } else {
      const elapsed = now - state.lastRefill;
      if (elapsed > refillIntervalMs) {
        state.tokens = maxTokens;
        state.lastRefill = now;
      }
    }

    if (state.tokens > 0) {
      state.tokens -= 1;
      return true;
    }

    return false;
  };
}
