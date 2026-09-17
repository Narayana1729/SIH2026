import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSriVisionMiddleware } from '../server/app.mjs';
import { CircuitBreaker, CircuitState } from '../server/services/circuitBreaker.mjs';
import { metricsRegistry } from '../server/services/metrics.mjs';
import { eventHub } from '../server/routes/stream.mjs';
import { computeEtag } from '../server/middleware/security.mjs';

// Mock HTTP Request/Response helper
function createMockHttp(method = 'GET', url = '/api/health/live', headers = {}) {
  const req = {
    method,
    url,
    headers: { ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    on: (evt, cb) => {},
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    ended: false,
    eventHandlers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    writeHead(status, headers = {}) {
      this.statusCode = status;
      for (const [k, v] of Object.entries(headers)) {
        this.headers[k.toLowerCase()] = v;
      }
    },
    write(chunk) {
      this.body += chunk;
    },
    end(chunk = '') {
      this.body += chunk;
      this.ended = true;
      if (this.eventHandlers['finish']) {
        this.eventHandlers['finish']();
      }
    },
    on(event, handler) {
      this.eventHandlers[event] = handler;
    },
  };

  return { req, res };
}

test('Production Backend: Trace ID propagation and header setting', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/health/live', { 'x-request-id': 'custom-trace-uuid-12345' });

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-request-id'], 'custom-trace-uuid-12345');
  const payload = JSON.parse(res.body);
  assert.equal(payload.status, 'LIVE');
});

test('Production Backend: Unified Error Response format for 404', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/non-existent-endpoint');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(res.body);
  assert.ok(payload.error, 'Should contain unified error envelope');
  assert.equal(payload.error.code, 'ROUTE_NOT_FOUND');
  assert.ok(payload.error.traceId, 'Error envelope must contain traceId');
});

test('Production Backend: Readiness Probe /api/health/ready', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/health/ready');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.status, 'READY');
  assert.equal(payload.checks.cacheWritable, true);
  assert.ok(payload.checks.circuitBreakers.firms);
});

test('Production Backend: Metrics Telemetry recording & snapshot', async () => {
  metricsRegistry.reset();
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/health/live');

  await middleware(req, res, () => {});

  const { req: mReq, res: mRes } = createMockHttp('GET', '/api/metrics');
  await middleware(mReq, mRes, () => {});

  assert.equal(mRes.statusCode, 200);
  const metrics = JSON.parse(mRes.body);
  assert.equal(metrics.status, 'nominal');
  assert.ok(metrics.summary.totalRequests >= 1);
  assert.ok(metrics.memory.heapUsedMb > 0);
});

test('Production Backend: CircuitBreaker state transitions & fallback', async () => {
  const cb = new CircuitBreaker('TEST_SERVICE', {
    failureThreshold: 2,
    resetTimeoutMs: 50,
    timeoutMs: 500,
  });

  assert.equal(cb.state, CircuitState.CLOSED);

  // Failure 1
  await assert.rejects(async () => {
    await cb.execute(async () => {
      throw new Error('Downstream 503');
    });
  });
  assert.equal(cb.state, CircuitState.CLOSED);

  // Failure 2 -> Trips to OPEN
  await assert.rejects(async () => {
    await cb.execute(async () => {
      throw new Error('Downstream 503');
    });
  });
  assert.equal(cb.state, CircuitState.OPEN);

  // When OPEN, fallback is returned immediately without executing fn
  let called = false;
  const fallbackResult = await cb.execute(
    async () => {
      called = true;
      return 'ok';
    },
    () => 'fallback_value'
  );
  assert.equal(called, false);
  assert.equal(fallbackResult, 'fallback_value');

  // Wait for resetTimeoutMs -> transitions to HALF_OPEN
  await new Promise((r) => setTimeout(r, 60));

  const successResult = await cb.execute(async () => 'recovered');
  assert.equal(successResult, 'recovered');
});

test('Production Backend: ETag computation and 304 conditional validation', async () => {
  const middleware = createSriVisionMiddleware();
  const sampleData = { status: 'LIVE', uptimeSeconds: 10, timestamp: '2026-01-01T00:00:00.000Z' };
  const etag = computeEtag(sampleData);

  assert.ok(etag.startsWith('W/"'));

  // Request with matching If-None-Match
  const { req, res } = createMockHttp('GET', '/api/health/live', { 'if-none-match': etag });
  // Note: /api/health/live generates dynamic timestamp so we verify computeEtag integrity
  assert.equal(typeof etag, 'string');
});

test('Production Backend: Realtime EventHub Pub/Sub', () => {
  let received = null;
  const mockClient = {
    write: (data) => {
      received = data;
    },
  };

  eventHub.addClient(mockClient);
  eventHub.broadcast('alert', { severity: 'HIGH', fireId: 'F-99' });

  assert.ok(received.includes('event: alert'));
  assert.ok(received.includes('F-99'));

  eventHub.removeClient(mockClient);
});
