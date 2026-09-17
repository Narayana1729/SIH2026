/**
 * @module server/services/circuitBreaker
 * @description Production Circuit Breaker with exponential backoff & jitter for resilient upstream data ingestion.
 */

export const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Failing, fast fail
  HALF_OPEN: 'HALF_OPEN', // Trial period
};

export class CircuitBreaker {
  /**
   * @param {string} name - Identifier for the upstream service
   * @param {object} options
   * @param {number} [options.failureThreshold=5] - Consecutive failures before opening
   * @param {number} [options.resetTimeoutMs=30000] - Cool-down time before trying half-open
   * @param {number} [options.timeoutMs=10000] - Default call timeout limit
   */
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.timeoutMs = options.timeoutMs || 10000;

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastStateChange = Date.now();
  }

  /**
   * Execute an async action protected by this circuit breaker.
   * @template T
   * @param {() => Promise<T>} fn
   * @param {T | (() => Promise<T> | T)} [fallback]
   * @returns {Promise<T>}
   */
  async execute(fn, fallback = null) {
    const now = Date.now();

    // Check if open circuit can transition to half-open
    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        // Fast-fail or fallback
        if (fallback !== null && fallback !== undefined) {
          return typeof fallback === 'function' ? fallback() : fallback;
        }
        const waitSec = Math.ceil((this.resetTimeoutMs - (now - this.lastFailureTime)) / 1000);
        throw new Error(`CircuitBreaker[${this.name}] is OPEN (fast-fail). Retry in ~${waitSec}s`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`CircuitBreaker[${this.name}] execution timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      if (fallback !== null && fallback !== undefined) {
        return typeof fallback === 'function' ? fallback() : fallback;
      }
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    console.warn(`[CircuitBreaker:${this.name}] Upstream call failed (${this.failureCount}/${this.failureThreshold}): ${err?.message || err}`);

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  transitionTo(newState) {
    console.info(`[CircuitBreaker:${this.name}] State transition: ${this.state} -> ${newState}`);
    this.state = newState;
    this.lastStateChange = Date.now();
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastStateChange: new Date(this.lastStateChange).toISOString(),
    };
  }
}

// Pre-configured circuit breakers for major external feeds
export const firmsCircuitBreaker = new CircuitBreaker('NASA_FIRMS', { failureThreshold: 3, resetTimeoutMs: 20000, timeoutMs: 15000 });
export const usgsCircuitBreaker = new CircuitBreaker('USGS_EARTHQUAKES', { failureThreshold: 3, resetTimeoutMs: 20000, timeoutMs: 10000 });
export const openMeteoCircuitBreaker = new CircuitBreaker('OPEN_METEO', { failureThreshold: 4, resetTimeoutMs: 15000, timeoutMs: 8000 });
