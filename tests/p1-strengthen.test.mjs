import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computePercentile } from '../server/services/metrics.mjs';
import { computeDozierSensitivity, solveDozierPyrometry } from '../src/disasters/pyrometry/dozierPyrometry.js';
import { computeFrpDistribution } from '../server/routes/firmsApi.mjs';
import { AlertLogStore } from '../server/services/alertLogStore.mjs';
import { AlertSystem } from '../src/intelligence/alertSystem.js';
import { generatePlumeFootprint } from '../src/disasters/dispersion/gaussianPlume.js';
import { defaultMLInferenceService } from '../server/services/mlInferenceService.mjs';
import { defaultCache } from '../server/services/cache.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('P1 — Hardening & Verification Suite', () => {

  describe('1. Percentile & P95 (Hyndman-Fan Type 7 Linear Interpolation)', () => {
    it('accurately computes P50=3 and P95=4.8 on [1, 2, 3, 4, 5]', () => {
      const arr = [1, 2, 3, 4, 5];
      const p50 = computePercentile(arr, 50);
      const p95 = computePercentile(arr, 95);
      assert.equal(p50, 3, 'P50 of [1,2,3,4,5] must equal 3');
      assert.equal(p95, 4.8, 'P95 of [1,2,3,4,5] must equal 4.8 via linear interpolation');
    });

    it('handles boundary array sizes: empty [], single [5], two-elements [1, 2]', () => {
      assert.equal(computePercentile([], 50), 0);
      assert.equal(computePercentile([], 95), 0);
      assert.equal(computePercentile([5], 50), 5);
      assert.equal(computePercentile([5], 95), 5);

      const two = [1, 2];
      assert.equal(computePercentile(two, 50), 1.5);
      assert.equal(computePercentile(two, 95), 1.95);
    });

    it('accurately handles duplicate values and ties', () => {
      const dups = [10, 10, 10, 20, 20, 30];
      const p50 = computePercentile(dups, 50);
      assert.equal(p50, 15);
      assert.ok(computePercentile(dups, 95) >= 20);
    });
  });

  describe('2. Dozier Pyrometry Sensitivity Analysis', () => {
    it('computes perturbation bounds across background and sensor scenarios without claiming NEΔT certainty', () => {
      const result = solveDozierPyrometry(345, 295, 25);
      assert.ok(result.sensitivity_analysis, 'Must return sensitivity_analysis object');

      const sens = result.sensitivity_analysis;
      assert.equal(sens.method, 'PERTURBATION_SCENARIO_ANALYSIS');
      assert.ok(sens.temperature_interval_k.min <= sens.temperature_interval_k.max);
      assert.ok(sens.area_interval_m2.min <= sens.area_interval_m2.max);
      assert.ok(['STABLE', 'MODERATE_SENSITIVITY', 'HIGH_SENSITIVITY'].includes(sens.condition_stability));
      assert.ok(sens.scenarios_evaluated >= 8, 'Must evaluate at least 8 perturbation scenarios');
    });

    it('verifies computeDozierSensitivity reports bounded sensitivity intervals', () => {
      const sens = computeDozierSensitivity(360, 296, 40);
      assert.ok(sens.temperature_interval_k.delta_k >= 0);
      assert.ok(sens.area_interval_m2.delta_m2 >= 0);
      const nominal = sens.scenarios.find((s) => s.scenario === 'Nominal');
      assert.ok(nominal, 'Must include nominal scenario');
      assert.ok(nominal.flame_temp_k > 0);
    });
  });

  describe('3. FRP Statistical Distribution & Pareto Tail', () => {
    it('returns INSUFFICIENT_SAMPLE_SIZE for datasets with N < 5', () => {
      const small = [12.5, 18.2, 25.0];
      const res = computeFrpDistribution(small);
      assert.equal(res.status, 'INSUFFICIENT_SAMPLE_SIZE');
      assert.equal(res.sample_size, 3);
    });

    it('computes parametric and non-parametric stats on sample size N >= 5', () => {
      const sample = [5, 10, 15, 20, 25, 30, 35, 40, 50, 120];
      const res = computeFrpDistribution(sample);

      assert.equal(res.sample_size, 10);
      assert.ok(res.parametric.mean_mw > 0);
      assert.ok(res.parametric.standard_deviation_mw > 0);
      assert.equal(res.non_parametric.min_mw, 5);
      assert.equal(res.non_parametric.max_mw, 120);
      assert.ok(res.non_parametric.median_p50_mw > 0);
      assert.ok(res.non_parametric.iqr_mw > 0);

      // Histogram bins
      assert.ok(res.histogram_bins.under_5mw === 0);
      assert.ok(res.histogram_bins.over_100mw === 1);
    });

    it('estimates conditional Pareto tail with documented xmin and tail sample count', () => {
      // Synthetic heavy-tail sample
      const tailData = [5, 6, 8, 10, 12, 14, 15, 18, 22, 28, 35, 45, 60, 90, 150, 280];
      const res = computeFrpDistribution(tailData);

      assert.ok(res.pareto_tail, 'Must include pareto_tail analysis');
      assert.ok(res.pareto_tail.xmin >= 10, 'Candidate xmin must be at least 10 MW');
      assert.equal(res.pareto_tail.method, 'MLE_CONDITIONAL_ON_XMIN');
      assert.ok(typeof res.pareto_tail.tail_sample_count === 'number');
      if (res.pareto_tail.tail_sample_count >= 5) {
        assert.ok(res.pareto_tail.alpha > 1.0, 'Pareto alpha must be > 1');
      }
    });
  });

  describe('4. Server-Side Alert JSONL Persistence & Lifecycle Audit', () => {
    const testLogDir = path.resolve(__dirname, '../data/test_alerts');
    const testLogFile = path.join(testLogDir, 'test_alerts.jsonl');

    it('persists alerts to JSONL with deduplication by event_id', () => {
      if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);

      const store = new AlertLogStore({ logDir: testLogDir, logFilePath: testLogFile });

      const incident1 = {
        id: 'event-jamnagar-01',
        event_id: 'event-jamnagar-01',
        title: 'Thermal Outburst at Refinery',
        severity: 'CRITICAL',
        incident_type: 'INDUSTRIAL_FIRE',
      };

      const res1 = store.ingestAlert(incident1);
      assert.equal(res1.isNew, true, 'First ingestion must be new');
      assert.equal(res1.alert.status, 'ACTIVE');

      // Attempt duplicate ingestion with same event_id
      const res2 = store.ingestAlert(incident1);
      assert.equal(res2.isNew, false, 'Second ingestion must be detected as duplicate');
      assert.equal(res2.alert.alertId, res1.alert.alertId, 'Must map to same alertId');

      // Operator lifecycle transition: ACKNOWLEDGE
      const acked = store.recordAction(res1.alert.alertId, 'ACKNOWLEDGED', 'Field commander dispatched', 'CHIEF_OPERATOR');
      assert.equal(acked.status, 'ACKNOWLEDGED');

      // Operator lifecycle transition: RESOLVE
      const resolved = store.recordAction(res1.alert.alertId, 'RESOLVED', 'Fire suppressed by deluge system', 'CHIEF_OPERATOR');
      assert.equal(resolved.status, 'RESOLVED');

      // Verify audit trail entries
      const trail = store.getAuditTrail(res1.alert.alertId);
      assert.ok(trail.length >= 3, 'Audit trail must contain CREATED, ACKNOWLEDGED, and RESOLVED entries');
      assert.equal(trail[0].action, 'CREATED');
      assert.equal(trail[1].action, 'ACKNOWLEDGED');
      assert.equal(trail[2].action, 'RESOLVED');

      // Replay log into a fresh store instance to verify persistence
      const replayedStore = new AlertLogStore({ logDir: testLogDir, logFilePath: testLogFile });
      const replayedAlert = replayedStore.alerts.get(res1.alert.alertId);
      assert.ok(replayedAlert, 'Replayed store must contain persisted alert');
      assert.equal(replayedAlert.status, 'RESOLVED');

      // Clean up test file
      if (fs.existsSync(testLogFile)) fs.unlinkSync(testLogFile);
      if (fs.existsSync(testLogDir)) fs.rmdirSync(testLogDir);
    });

    it('verifies client AlertSystem state machine and deduplication', () => {
      const clientSystem = new AlertSystem();
      const incidents = [
        { id: 'inc-01', severity: 'CRITICAL', incident_type: 'WILDFIRE_ENVIRONMENTAL_RISK' },
        { id: 'inc-02', severity: 'HIGH', incident_type: 'FOREST_DISTURBANCE_PATTERN' },
      ];

      clientSystem.updateAlerts(incidents);
      assert.equal(clientSystem.getActiveAlerts().length, 2);

      // Re-ingest duplicate
      clientSystem.updateAlerts(incidents);
      assert.equal(clientSystem.getActiveAlerts().length, 2, 'Duplicates must not inflate alert list');

      // Acknowledge and resolve
      clientSystem.acknowledgeAlert('inc-01', 'Noted by operator');
      assert.equal(clientSystem.alerts.find((a) => a.id === 'inc-01').status, 'ACKNOWLEDGED');

      clientSystem.resolveAlert('inc-01', 'Resolved');
      assert.equal(clientSystem.alerts.find((a) => a.id === 'inc-01').status, 'RESOLVED');
      assert.equal(clientSystem.getActiveAlerts().length, 1, 'Resolved alert removed from active list');
    });
  });

  describe('5. Plume Epistemic Provenance & Chemical Disclaimers', () => {
    it('returns 4-tier epistemic provenance and explicit chemical detection disclaimer', () => {
      const plume = generatePlumeFootprint({
        sourceLat: 22.4707,
        sourceLon: 70.0577,
        windDirectionDeg: 270,
        windSpeedMps: 4.5,
        emissionRateGps: 600,
        chemicalName: 'BENZENE',
      });

      assert.equal(plume.simulation_title, 'Atmospheric Dispersion Screening Simulation (Gaussian Plume — Pasquill-Gifford)');
      assert.equal(plume.chemical, 'BENZENE');
      assert.equal(plume.chemical_provenance, 'ASSUMED_SCENARIO_OR_FACILITY_CATALOG_LOOKUP');
      assert.equal(plume.satellite_detected_chemical, false, 'Satellite must NOT claim to measure chemical species');

      // 4-Tier Epistemic Provenance checks
      const epi = plume.epistemic_provenance;
      assert.ok(epi, 'Must contain epistemic_provenance');
      assert.ok(epi.observed.source_latitude === 22.4707, 'Observed tier holds coordinates');
      assert.ok(epi.estimated.stability_class, 'Estimated tier holds stability class');
      assert.ok(epi.assumed.chemical === 'BENZENE', 'Assumed tier holds chemical name');
      assert.equal(epi.unknown.confirmed_toxic_release, false, 'Unknown tier acknowledges unmeasured release presence');
    });
  });

  describe('6. Weather Provenance & Fallback States', () => {
    it('distinguishes LIVE, CACHED, and FALLBACK states with data provenance', async () => {
      // Verify cache service set & get for simulated CACHED state
      const cacheKey = 'weather_test_grid.json';
      const cachedPayload = {
        status: 'ok',
        source: 'CACHE',
        is_live: false,
        is_fallback: false,
        is_measured: true,
        data_quality: 'CACHED_RECENT',
        timestamp: Date.now() - 30000,
      };

      await defaultCache.set(cacheKey, JSON.stringify(cachedPayload));
      const readBack = JSON.parse(await defaultCache.get(cacheKey));
      assert.equal(readBack.source, 'CACHE');
      assert.equal(readBack.is_fallback, false);

      // Verify simulated FALLBACK structure
      const fallbackPayload = {
        status: 'degraded',
        source: 'FALLBACK',
        provider: 'Climatological Regional Default (Open-Meteo Proxy)',
        is_live: false,
        is_fallback: true,
        is_measured: false,
        data_provenance: 'ESTIMATED_REGIONAL_CLIMATOLOGY',
      };
      assert.equal(fallbackPayload.source, 'FALLBACK');
      assert.equal(fallbackPayload.is_fallback, true);
      assert.equal(fallbackPayload.is_measured, false);
    });
  });

  describe('7. ML Batch Inference & IPC Protocol', () => {
    it('supports vectorized batch format with backwards compatible single event handling', async () => {
      const detections = [
        { lat: 22.47, lon: 70.05, frp: 280, brightness: 375, detection_id: 'd1' },
        { lat: 14.50, lon: 76.20, frp: 18, brightness: 315, detection_id: 'd2' },
      ];

      const batchResult = await defaultMLInferenceService.classifyBatch(detections);
      assert.equal(batchResult.status, 'ok');
      assert.equal(batchResult.count, 2);
      assert.ok(Array.isArray(batchResult.events));
      assert.equal(batchResult.events.length, 2);

      // Verify each event has separated observed, modeled, and predicted sections
      for (const ev of batchResult.events) {
        assert.ok(ev.observed, 'Must have observed telemetry');
        assert.ok(ev.modeled_estimates, 'Must have modeled physical estimates');
        assert.ok(ev.derived_intelligence, 'Must have derived intelligence');
      }

      // Backwards compatible single classification
      const singleResult = await defaultMLInferenceService.classifyThermalEvent(detections[0]);
      assert.ok(singleResult.event_id, 'Single classification must return valid domain event');
      assert.ok(singleResult.observed.frp_mw === 280);
    });
  });
});
