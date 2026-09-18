import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  computeSensorScanFootprint, 
  computeSatelliteRevisitForecast 
} from '../src/intelligence/revisitPredictor.js';

function createMockEvent(overrides = {}) {
  return {
    id: 'evt-orbit-test-01',
    latitude: 21.25,
    longitude: 81.63,
    frp: 55.0,
    end_time: new Date(Date.now() - 3600000).toISOString(), // 60 mins ago
    ...overrides
  };
}

describe('Satellite Orbital Revisit & Scan Geometry Engine', () => {
  it('computes nominal 375m footprint at nadir scan angle (0 deg)', () => {
    const nadir = computeSensorScanFootprint(0);
    assert.equal(nadir.scanAngleDeg, 0);
    assert.equal(nadir.pixelWidthScanMeters, 375);
    assert.equal(nadir.pixelLengthTrackMeters, 375);
    assert.equal(nadir.distortionFactor, 1.0);
    assert.equal(nadir.isEdgeOfSwathDistorted, false);
    assert.equal(nadir.viewingParallaxShiftEstimateMeters, 0);
  });

  it('computes elongated pixel footprint and flags swath-edge distortion at 48 deg', () => {
    const limb = computeSensorScanFootprint(48);
    assert.equal(limb.scanAngleDeg, 48);
    assert.ok(limb.pixelWidthScanMeters > 500, `Expected pixel width > 500m, got ${limb.pixelWidthScanMeters}`);
    assert.ok(limb.distortionFactor > 1.5, `Expected distortion factor > 1.5, got ${limb.distortionFactor}`);
    assert.equal(limb.isEdgeOfSwathDistorted, true);
    assert.ok(limb.viewingParallaxShiftEstimateMeters > 40, 'Expected non-zero parallax shift estimate');
  });

  it('detects active LEO blind window when > 40 minutes have elapsed since last pass', () => {
    const now = new Date();
    const event = createMockEvent({
      end_time: new Date(now.getTime() - 1000 * 60 * 75).toISOString() // 75 mins ago
    });

    const forecast = computeSatelliteRevisitForecast(event, { currentTime: now });

    assert.equal(forecast.elapsedMinutesSinceObservation, 75);
    assert.equal(forecast.isBlindWindowActive, true);
    assert.ok(forecast.blindWindowGuidance.includes('LEO Blind Window active'));
    assert.ok(forecast.upcomingPasses.length >= 3, 'Must project multiple candidate LEO constellations');
    assert.ok(forecast.nextLeoPass.minutesUntilPass > 0);
    assert.ok(forecast.insatNextScanMinutes <= 15 && forecast.insatNextScanMinutes >= 1);
  });
});
