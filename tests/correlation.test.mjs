import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCorrelationEngine } from '../src/intelligence/correlationEngine.js';
import { defaultAlertSystem } from '../src/intelligence/alertSystem.js';

test('Scenario 1: correlateWildfireRisk computes wind-influenced spread indicator', () => {
  const fire = { lat: 34.2, lon: -118.5, frp: 120, confidence: 0.95 };
  const weather = { wind_speed_10m: 32, wind_direction_10m: 270, relative_humidity_2m: 15, precipitation: 0 };
  const vegetation = { ndvi: 0.60 };

  const assessment = defaultCorrelationEngine.correlateWildfireRisk({ fire, weather, vegetation });
  assert.equal(assessment.incident_type, 'WILDFIRE_ENVIRONMENTAL_RISK');
  assert.equal(assessment.severity, 'CRITICAL');
  assert.equal(assessment.potential_spread.indicator_type, 'HEURISTIC_ENVIRONMENTAL_INDICATOR');
  // Wind from 270° blows toward (270 + 180)%360 = 90° (East)
  assert.equal(assessment.potential_spread.potential_spread_heading_deg, 90);
  assert.ok(assessment.contributing_factors.length >= 3);
  assert.ok(assessment.provenance.scientific_limitations.length > 0);
});

test('Scenario 2: correlateForestDisturbance identifies co-occurrence with active thermal anomaly', () => {
  const zone = {
    name: 'Rondônia Frontier Arc',
    coordinates: [-62.8, -10.2],
    latest_metrics: { forest_loss_percent: 6.8 },
  };
  const canopyChange = { deltaNdvi: -0.18 };
  const fires = [{ lat: -10.21, lon: -62.79, frp: 50 }, { lat: -10.22, lon: -62.80, frp: 40 }, { lat: -10.20, lon: -62.78, frp: 60 }];

  const disturbance = defaultCorrelationEngine.correlateForestDisturbance({
    forestZone: zone,
    canopyChange,
    nearbyFires: fires,
  });

  assert.equal(disturbance.incident_type, 'FOREST_DISTURBANCE_PATTERN');
  assert.equal(disturbance.disturbance_type, 'FIRE_CORRELATED_CANOPY_DISTURBANCE');
  assert.equal(disturbance.severity, 'HIGH');
  assert.ok(disturbance.signals_observed.length >= 3);
});

test('Scenario 3: correlateSeismicSeverity and Alert Priority Queue', () => {
  const eq = {
    id: 'us7000crit',
    geometry: { coordinates: [75.0, 35.0, 15.0] },
    properties: { mag: 7.4, place: 'Kashmir Region', time: Date.now() },
  };

  const seismic = defaultCorrelationEngine.correlateSeismicSeverity(eq);
  assert.equal(seismic.severity, 'CRITICAL');

  const alerts = defaultAlertSystem.updateAlerts([seismic]);
  assert.equal(alerts.length >= 1, true);
  assert.equal(alerts[0].severity, 'CRITICAL');
  assert.equal(alerts[0].priority, 1);
});
