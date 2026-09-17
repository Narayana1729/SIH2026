/**
 * @file tests/briggs-plume-rise.test.mjs
 * @description Automated Verification Suite for US EPA Briggs (1969/1975) Convective Plume Rise Dynamics.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBriggsPlumeRise,
  STABILITY_LABELS,
  STABILITY_TOUCHDOWN_MULTIPLIER,
} from '../src/disasters/dispersion/briggsPlumeRise.js';

describe('US EPA Briggs Convective Plume Rise Dynamics', () => {
  it('accurately computes convective buoyant heat flux Fb proportional to FRP', () => {
    // Fb = 8.79e-6 * (FRP * 1e6) = 8.79 * FRP
    const frp = 50.0;
    const result = calculateBriggsPlumeRise(null, { frpMw: frp });

    assert.equal(result.convectiveHeatFluxFbM4s3, 439.5);
    assert.equal(result.isBuoyancyDominated, true);
  });

  it('computes convective plume rise Delta-H and Heff under Neutral conditions (Class D)', () => {
    const result = calculateBriggsPlumeRise(null, {
      frpMw: 30.0,
      windSpeedMs: 4.0,
      physicalStackHeightM: 25.0,
      stabilityClass: 'D',
      isIndustrial: true,
    });

    assert.ok(result.plumeRiseDeltaHM > 0, 'Plume rise Delta-H must be positive');
    assert.equal(
      result.effectiveReleaseHeightHeffM,
      Number((25.0 + result.plumeRiseDeltaHM).toFixed(1)),
      'Heff must equal physical stack height + Delta-H'
    );
    assert.equal(result.stabilityClass, 'D');
    assert.equal(result.stabilityLabel, STABILITY_LABELS.D);
    assert.equal(
      result.downwindTouchdownDistanceM,
      Math.round(result.effectiveReleaseHeightHeffM * STABILITY_TOUCHDOWN_MULTIPLIER.D)
    );
  });

  it('computes stable atmosphere plume rise under nighttime surface inversion (Class F)', () => {
    const result = calculateBriggsPlumeRise(null, {
      frpMw: 20.0,
      windSpeedMs: 2.5,
      ambientTempK: 288.15,
      physicalStackHeightM: 30.0,
      stabilityClass: 'F',
      isIndustrial: true,
    });

    assert.ok(result.plumeRiseDeltaHM > 0, 'Stable plume rise must be positive');
    assert.ok(result.neutralTransitionDistanceXfM > 0, 'Transition distance must be positive');
    assert.equal(result.stabilityClass, 'F');
    assert.equal(result.downwindTouchdownDistanceM, Math.round(result.effectiveReleaseHeightHeffM * 40.0));
  });

  it('triggers critical fumigation warning under high convective instability with severe heat', () => {
    const highFumigation = calculateBriggsPlumeRise(null, {
      frpMw: 120.0,
      windSpeedMs: 6.0,
      stabilityClass: 'A',
    });

    assert.equal(highFumigation.fumigationRisk, true);
    assert.ok(highFumigation.fumigationExplanation.includes('FUMIGATION WARNING'));
  });

  it('handles low-intensity ground wildfire baseline with 2m physical release', () => {
    const wildfire = calculateBriggsPlumeRise({
      frp_mw: 8.0,
      classification: 'NATURAL_FOREST_WILDFIRE',
      isIndustrial: false,
    });

    assert.equal(wildfire.physicalStackHeightM, 2.0);
    assert.ok(wildfire.effectiveReleaseHeightHeffM > 2.0);
    assert.equal(wildfire.stabilityClass, 'C');
  });
});
