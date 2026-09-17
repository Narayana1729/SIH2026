import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSriVisionMiddleware } from '../server/app.mjs';
import {
  PrimaryClassification,
  IndustrialSubtype,
  NonIndustrialSubtype,
} from '../src/firms/domain/constants.js';
import { defaultClassifierEngine } from '../src/firms/intelligence/classifierEngine.js';

function createMockHttp(method = 'GET', url = '/api/v1/firms/detections', body = null, headers = {}) {
  const req = {
    method,
    url,
    headers: { ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    on: (evt, cb) => {
      if (evt === 'data' && body) {
        cb(typeof body === 'string' ? body : JSON.stringify(body));
      }
      if (evt === 'end') {
        cb();
      }
    },
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    ended: false,
    eventHandlers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    writeHead(s, h = {}) { this.statusCode = s; for (const [k, v] of Object.entries(h)) this.headers[k.toLowerCase()] = v; },
    write(c) { this.body += c; },
    end(c = '') { this.body += c; this.ended = true; },
    on(e, h) { this.eventHandlers[e] = h; },
  };

  return { req, res };
}

test('SIH Scope: Purged unrelated disaster endpoints return 404', async () => {
  const middleware = createSriVisionMiddleware();

  const paths = ['/api/earthquakes', '/api/flood', '/api/landslide', '/api/satellites'];
  for (const p of paths) {
    const { req, res } = createMockHttp('GET', p);
    await middleware(req, res, () => {});
    assert.equal(res.statusCode, 404, `Endpoint ${p} must be purged and return 404`);
  }
});

test('SIH FIRMS API: GET /api/v1/firms/facilities returns industrial infrastructure catalog', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/v1/firms/facilities');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.status, 'ok');
  assert.ok(data.count > 0);
  assert.ok(data.facilities.some((f) => f.facility_type.includes('REFINERY') || f.facility_type.includes('POWER')));
});

test('SIH FIRMS API: POST /api/v1/firms/classify classifies accidental fire at refinery', async () => {
  const middleware = createSriVisionMiddleware();
  const payload = {
    latitude: 17.68858,
    longitude: 83.251943,
    frp_mw: 290.0,
    brightness_temp_k: 388.0,
    daynight: 'N',
  };

  const { req, res } = createMockHttp('POST', '/api/v1/firms/classify', payload, { 'content-type': 'application/json' });
  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.status, 'ok');
  assert.equal(data.event.derived_intelligence.industrial_status, PrimaryClassification.INDUSTRIAL);
  assert.equal(data.event.derived_intelligence.subclassification, IndustrialSubtype.INDUSTRIAL_FIRE);
  assert.equal(data.event.derived_intelligence.risk_level, 'CRITICAL');
  assert.ok(data.event.derived_intelligence.facility);
  assert.ok(data.event.derived_intelligence.basis.length > 0);
});

test('SIH FIRMS API: POST /api/v1/firms/classify classifies routine flaring', async () => {
  const middleware = createSriVisionMiddleware();
  const payload = {
    latitude: 17.68858,
    longitude: 83.251943,
    frp_mw: 30.0,
    brightness_temp_k: 325.0,
    daynight: 'D',
  };

  const { req, res } = createMockHttp('POST', '/api/v1/firms/classify', payload, { 'content-type': 'application/json' });
  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.event.derived_intelligence.industrial_status, PrimaryClassification.INDUSTRIAL);
  assert.equal(data.event.derived_intelligence.subclassification, IndustrialSubtype.GAS_FLARE);
  assert.equal(data.event.derived_intelligence.risk_level, 'LOW');
});

test('SIH FIRMS API: POST /api/v1/firms/classify segregates Non-Industrial Wildfire', async () => {
  const middleware = createSriVisionMiddleware();
  const payload = {
    latitude: 11.600,
    longitude: 76.600,
    frp_mw: 95.0,
    brightness_temp_k: 345.0,
    ndvi: 0.65,
  };

  const { req, res } = createMockHttp('POST', '/api/v1/firms/classify', payload, { 'content-type': 'application/json' });
  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.event.derived_intelligence.industrial_status, PrimaryClassification.NON_INDUSTRIAL);
  assert.equal(data.event.derived_intelligence.subclassification, NonIndustrialSubtype.WILDFIRE);
});

test('SIH FIRMS API: GET /api/v1/firms/analytics returns segregation breakdown', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/v1/firms/analytics');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.status, 'ok');
  assert.ok(data.analytics.summary);
  assert.ok(data.analytics.industrial_percentage);
  assert.ok(data.analytics.non_industrial_percentage);
});

test('SIH FIRMS API: GET /api/v1/firms/timeline returns daily aggregated stats', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/v1/firms/timeline?year=2026&month=8');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.year, 2026);
  assert.equal(data.month, 8);
  assert.equal(data.daysInMonth, 31);
  assert.equal(data.dailyStats.length, 31);
  assert.ok(data.dailyStats[25].count > 0);
  assert.ok(data.dailyStats[25].satellites.length > 0);
  assert.ok(data.dailyStats[25].overpasses.length > 0);
});

test('SIH FIRMS API: GET /api/firms?date=2026-08-25 returns date-filtered fires', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/firms?date=2026-08-25');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.date, '2026-08-25');
  assert.ok(data.fires.length > 0);
  assert.ok(data.fires.some((f) => f.acqDate === '2026-08-25'));
});

test('SIH FIRMS API: GET /api/firms?mode=stored returns local archived detections without upstream call', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/firms?mode=stored&date=2026-08-25');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.ok(data.fires.length > 0);
  assert.ok(data.fires.every((f) => f.lat && f.lon));
});

test('SIH FIRMS API: GET /api/v1/firms/export returns GIS GeoJSON FeatureCollection', async () => {
  const middleware = createSriVisionMiddleware();
  const { req, res } = createMockHttp('GET', '/api/v1/firms/export?format=geojson');

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.type, 'FeatureCollection');
  assert.ok(Array.isArray(data.features));
  assert.ok(data.metadata.platform);
});


