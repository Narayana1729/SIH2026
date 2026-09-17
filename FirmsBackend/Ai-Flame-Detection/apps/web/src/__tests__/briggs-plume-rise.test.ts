import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBriggsPlumeRise } from '../lib/physics/briggsPlumeRise.ts';
import type { ThermalEvent } from '../types/event.ts';

describe('Briggs (1969/1975) Convective Plume Rise & Fumigation Engine', () => {
  const mockIndustrialEvent: ThermalEvent = {
    event_id: 'TEST-IND-01',
    latitude: 28.5,
    longitude: 77.2,
    phenomenon: 'flare',
    frp_mw: 45.0,
    confidence: 0.95,
    classification: 'INDUSTRIAL',
    uncertainty_state: 'CONFIDENT',
    start_time: '2026-09-06T00:00:00Z',
    end_time: '2026-09-06T01:00:00Z',
    detection_count: 5,
  };

  test('computes buoyant convective heat flux Fb proportional to FRP', () => {
    const result = calculateBriggsPlumeRise(mockIndustrialEvent);
    // Fb = 8.79 * 45.0 = 395.55 m^4/s^3
    assert.strictEqual(result.convectiveHeatFluxFbM4s3, 395.55);
    assert.strictEqual(result.isBuoyancyDominated, true);
  });

  test('calculates significant plume rise and effective height exceeding physical stack height', () => {
    const result = calculateBriggsPlumeRise(mockIndustrialEvent, {
      windSpeedMs: 3.0,
      physicalStackHeightM: 30.0,
      stabilityClass: 'D'
    });

    assert.strictEqual(result.physicalStackHeightM, 30.0);
    assert.ok(result.plumeRiseDeltaHM > 50, `Plume rise should be substantial (>50m), got ${result.plumeRiseDeltaHM}`);
    assert.strictEqual(result.effectiveReleaseHeightHeffM, Number((30.0 + result.plumeRiseDeltaHM).toFixed(1)));
    assert.ok(result.downwindTouchdownDistanceM > result.effectiveReleaseHeightHeffM);
  });

  test('models stable inversion regime (Class F) with suppressed plume rise', () => {
    const neutralResult = calculateBriggsPlumeRise(mockIndustrialEvent, {
      windSpeedMs: 3.0,
      stabilityClass: 'D'
    });

    const stableResult = calculateBriggsPlumeRise(mockIndustrialEvent, {
      windSpeedMs: 3.0,
      stabilityClass: 'F'
    });

    assert.strictEqual(stableResult.stabilityClass, 'F');
    assert.ok(stableResult.plumeRiseDeltaHM < neutralResult.plumeRiseDeltaHM, 'Stable atmospheric plume rise should be smaller than neutral');
    assert.ok(stableResult.downwindTouchdownDistanceM > neutralResult.downwindTouchdownDistanceM, 'Stable plume touchdown should be farther downwind');
  });

  test('detects critical fumigation risk under unstable turbulent boundary conditions', () => {
    const result = calculateBriggsPlumeRise(mockIndustrialEvent, {
      frpMw: 120.0,
      windSpeedMs: 5.5,
      stabilityClass: 'A'
    });

    assert.strictEqual(result.fumigationRisk, true);
    assert.ok(result.fumigationExplanation.includes('FUMIGATION WARNING'));
  });
});
