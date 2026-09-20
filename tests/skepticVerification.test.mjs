import test from 'node:test';
import assert from 'node:assert/strict';
import { SkepticVerificationEngine, SkepticVerdictAction } from '../src/intelligence/skepticVerification.js';

test('Skeptic AI: Disproves daytime solar roof glint as non-combustion artifact', () => {
  const engine = new SkepticVerificationEngine();
  // Typical daytime roof glint: Day pass, modest deltaT (10K), no true combustion flame
  const glintDetection = {
    latitude: 22.47,
    longitude: 70.06,
    frp: 8,
    bright_ti4: 318,
    bright_ti5: 308,
    daynight: 'D',
    historicalPersistence: 0.05,
    confidence: 'n',
  };

  const audit = engine.auditAnomaly(glintDetection, { category: 'INDUSTRIAL_DISASTER' });
  assert.equal(audit.isDisproven, true);
  assert.equal(audit.action, SkepticVerdictAction.DISCARD_FALSE_ALARM);
  assert.ok(audit.primaryDisproveReason.includes('Solar Glint') || audit.primaryDisproveReason.includes('reflection'));
  assert.ok(audit.pyrometryResolution.flameTempK < 680);
});

test('Skeptic AI: Demotes accidental explosion claim to routine permitted flaring', () => {
  const engine = new SkepticVerificationEngine();
  // Refinery flare at Jamnagar: High persistence (85%), normal flare FRP (25 MW), high flame temp
  const flareDetection = {
    latitude: 22.47,
    longitude: 70.06, // Jamnagar refinery coords
    frp: 25,
    bright_ti4: 355,
    bright_ti5: 295,
    daynight: 'N',
    historicalPersistence: 0.85,
    confidence: 'h',
  };

  const audit = engine.auditAnomaly(flareDetection, { category: 'INDUSTRIAL_DISASTER' });
  assert.equal(audit.isDisproven, true);
  assert.equal(audit.action, SkepticVerdictAction.DEMOTE_TO_ROUTINE);
  assert.ok(audit.primaryDisproveReason.includes('persistence') || audit.primaryDisproveReason.includes('baseline'));
});

test('Skeptic AI: Confirms genuine industrial disaster runaway explosion', () => {
  const engine = new SkepticVerificationEngine();
  // HPCL Vizag refinery disaster: sudden surge FRP (185 MW), extreme deltaT, low prior persistence (new event)
  const disasterDetection = {
    latitude: 17.68,
    longitude: 83.21, // Vizag refinery
    frp: 185,
    bright_ti4: 367,
    bright_ti5: 300,
    daynight: 'N',
    historicalPersistence: 0.05,
    confidence: 'h',
  };

  const audit = engine.auditAnomaly(disasterDetection, { category: 'INDUSTRIAL_DISASTER' });
  assert.equal(audit.isDisproven, false);
  assert.equal(audit.action, SkepticVerdictAction.CONFIRMED_HAZARD);
  assert.ok(audit.passedCheckCount >= 4);
  assert.ok(audit.pyrometryResolution.flameTempK > 1000);
  assert.equal(audit.pyrometryResolution.regime.includes('High-Temp') || audit.pyrometryResolution.regime.includes('Hydrocarbon') || audit.pyrometryResolution.regime.includes('Industrial'), true);
});

test('Skeptic AI: Diverts claimed industrial fire in dense forest to Wildfire', () => {
  const engine = new SkepticVerificationEngine();
  // Bandipur/Similipal forest: NDVI = 0.72, no facility nearby
  const forestDetection = {
    latitude: 11.66,
    longitude: 76.62,
    frp: 45,
    bright_ti4: 335,
    bright_ti5: 298,
    daynight: 'D',
    ndvi: 0.72,
    landCover: 'forest',
    confidence: 'h',
  };

  const audit = engine.auditAnomaly(forestDetection, { category: 'INDUSTRIAL_DISASTER' });
  assert.equal(audit.isDisproven, true);
  assert.equal(audit.action, SkepticVerdictAction.DIVERT_TO_WILDFIRE);
});
