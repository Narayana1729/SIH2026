import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ThermalAnomalyClassifier,
  ThermalCategories,
  defaultThermalClassifier,
} from '../src/intelligence/thermalClassifier.js';
import { createSriVisionMiddleware } from '../server/app.mjs';

test('Thermal Classifier: Distinguishes Industrial Disaster (Explosion/Surge) at Refinery', () => {
  const classifier = new ThermalAnomalyClassifier();

  // Coordinates of HPCL Vizag Refinery (17.68858 N, 83.251943 E) with extreme FRP surge
  const anomaly = {
    latitude: 17.68858,
    longitude: 83.251943,
    frp: 280.0, // High surge
    brightness: 385.0,
    daynight: 'N',
    historicalPersistence: 0.05, // Sudden unexpected spike
  };

  const verdict = classifier.classify(anomaly);

  assert.equal(verdict.category, ThermalCategories.INDUSTRIAL_DISASTER);
  assert.equal(verdict.isAccidentalDisaster, true);
  assert.equal(verdict.severity, 'CRITICAL');
  assert.ok(verdict.facilityMatch);
  assert.ok(verdict.facilityMatch.name.toLowerCase().includes('refinery') || verdict.facilityMatch.name.toLowerCase().includes('vizag'));
  assert.ok(verdict.tacticalAction.includes('HazMat'));
});

test('Thermal Classifier: Distinguishes Controlled Industrial Flaring', () => {
  const classifier = new ThermalAnomalyClassifier();

  // Moderate FRP, persistent operational heat at HPCL Vizag Refinery
  const anomaly = {
    latitude: 17.68858,
    longitude: 83.251943,
    frp: 35.0,
    brightness: 325.0,
    daynight: 'D',
    historicalPersistence: 0.85, // Highly persistent
  };

  const verdict = classifier.classify(anomaly);

  assert.equal(verdict.category, ThermalCategories.INDUSTRIAL_FLARE);
  assert.equal(verdict.isAccidentalDisaster, false);
  assert.equal(verdict.severity, 'LOW');
  assert.ok(verdict.tacticalAction.includes('Operational process heat'));
});

test('Thermal Classifier: Segregates Forest Wildfire (Western Ghats / Bandipur)', () => {
  const classifier = new ThermalAnomalyClassifier();

  // Bandipur/Wayanad forest coordinates (11.60 N, 76.60 E) with high NDVI, far from industry
  const anomaly = {
    latitude: 11.600,
    longitude: 76.600,
    frp: 140.0,
    brightness: 345.0,
    ndvi: 0.68,
    landCover: 'forest',
  };

  const verdict = classifier.classify(anomaly);

  assert.equal(verdict.category, ThermalCategories.FOREST_WILDFIRE);
  assert.equal(verdict.severity, 'CRITICAL');
  assert.ok(verdict.tacticalAction.includes('Forestry Rapid Response Unit'));
});

test('Thermal Classifier: Segregates Agricultural Stubble Burning', () => {
  const classifier = new ThermalAnomalyClassifier();

  // Punjab/Haryana farmland coordinates (30.30 N, 75.80 E) in cropland
  const anomaly = {
    latitude: 30.300,
    longitude: 75.800,
    frp: 22.0,
    brightness: 318.0,
    ndvi: 0.26,
    landCover: 'cropland',
  };

  const verdict = classifier.classify(anomaly);

  assert.equal(verdict.category, ThermalCategories.AGRICULTURAL_BURNING);
  assert.ok(verdict.confidence >= 0.75);
  assert.ok(verdict.tacticalAction.includes('Crop residue'));
});

test('Thermal Classifier: Batch Segregation & GIS GeoJSON FeatureCollections', () => {
  const anomalies = [
    { latitude: 22.385, longitude: 73.132, frp: 250, landCover: 'industrial' }, // Industrial Disaster
    { latitude: 11.600, longitude: 76.600, frp: 90, landCover: 'forest' },       // Wildfire
    { latitude: 30.300, longitude: 75.800, frp: 18, landCover: 'cropland' },     // Agricultural
  ];

  const batchResult = defaultThermalClassifier.classifyBatch(anomalies);

  assert.equal(batchResult.status, 'ok');
  assert.equal(batchResult.summary.total, 3);
  assert.equal(batchResult.summary.industrialDisasters, 1);
  assert.equal(batchResult.summary.wildfires, 1);
  assert.equal(batchResult.summary.agricultural, 1);

  // Validate GeoJSON layer structures
  assert.ok(batchResult.geoJsonLayers.industrialDisasters.features.length === 1);
  assert.ok(batchResult.geoJsonLayers.wildfires.features.length === 1);
  assert.ok(batchResult.geoJsonLayers.agricultural.features.length === 1);
});

test('Thermal Classifier API Route: POST /api/v1/firms/classify', async () => {
  const middleware = createSriVisionMiddleware();

  const req = {
    method: 'POST',
    url: '/api/v1/firms/classify',
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
    on: (evt, cb) => {
      if (evt === 'data') {
        cb(JSON.stringify({ latitude: 11.600, longitude: 76.600, frp_mw: 85, landCover: 'forest' }));
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
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    writeHead(s, h = {}) { this.statusCode = s; for (const [k, v] of Object.entries(h)) this.headers[k.toLowerCase()] = v; },
    write(c) { this.body += c; },
    end(c = '') { this.body += c; this.ended = true; },
    on: () => {},
  };

  await middleware(req, res, () => {});

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.status, 'ok');
  assert.equal(data.event.derived_intelligence.classification, 'NON_INDUSTRIAL');
});
