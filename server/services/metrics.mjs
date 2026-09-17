/**
 * @module server/services/metrics
 * @description RED (Rate, Errors, Duration) Metrics & Telemetry tracker for production observability.
 */

class MetricsRegistry {
  constructor() {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.statusCodes = {};
    this.routeLatency = new Map(); // route -> array of latencies
    this.activeConnections = 0;
  }

  recordRequest(method, route, statusCode, durationMs) {
    this.totalRequests++;
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;

    if (statusCode >= 400) {
      this.totalErrors++;
    }

    const key = `${method} ${route}`;
    if (!this.routeLatency.has(key)) {
      this.routeLatency.set(key, []);
    }
    const list = this.routeLatency.get(key);
    list.push(durationMs);
    // Keep rolling window of last 1000 requests per route
    if (list.length > 1000) {
      list.shift();
    }
  }

  getSnapshot() {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const rps = uptimeSec > 0 ? (this.totalRequests / uptimeSec).toFixed(2) : '0.00';
    const errorRate = this.totalRequests > 0 ? ((this.totalErrors / this.totalRequests) * 100).toFixed(2) : '0.00';

    const routes = {};
    for (const [route, latencies] of this.routeLatency.entries()) {
      if (latencies.length === 0) continue;
      const sorted = [...latencies].sort((a, b) => a - b);
      const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
      const p50 = computePercentile(sorted, 50);
      const p95 = computePercentile(sorted, 95);
      const p99 = computePercentile(sorted, 99);

      routes[route] = {
        count: sorted.length,
        avgMs: Math.round(avg * 100) / 100,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
      };
    }

    const memory = process.memoryUsage();

    return {
      status: 'nominal',
      uptimeSeconds: uptimeSec,
      activeConnections: this.activeConnections,
      summary: {
        totalRequests: this.totalRequests,
        totalErrors: this.totalErrors,
        errorRatePercent: `${errorRate}%`,
        requestsPerSecond: parseFloat(rps),
      },
      statusCodes: this.statusCodes,
      routes,
      memory: {
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      },
    };
  }

  reset() {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.statusCodes = {};
    this.routeLatency.clear();
    this.activeConnections = 0;
  }
}

export const metricsRegistry = new MetricsRegistry();

/**
 * Calculates percentile using Hyndman-Fan Type 7 linear interpolation (NumPy / R / NIST standard).
 * i = (p / 100) * (N - 1)
 *
 * @param {Array<number>} sorted - Pre-sorted numeric array in ascending order
 * @param {number} percentile - Target percentile between 0 and 100
 * @returns {number} Interpolated percentile value
 */
export function computePercentile(sorted, percentile) {
  if (!Array.isArray(sorted) || sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const p = Math.max(0, Math.min(100, percentile));
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }
  const interpolated = sorted[lower] * (1 - weight) + sorted[upper] * weight;
  return Math.round(interpolated * 1000) / 1000;
}
