import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { solveDozierPyrometry, planckRadiance } from '../src/disasters/pyrometry/dozierPyrometry.js';
import { computeShapAttributions } from '../src/intelligence/shapExplainer.js';

describe('Planck / Dozier Sub-Pixel Pyrometry Inversion Solver', () => {
  it('computes Planck spectral radiance correctly', () => {
    const rad374 = planckRadiance(3.74, 1400);
    assert.ok(rad374 > 0, 'Radiance must be positive');
    assert.ok(rad374 > planckRadiance(3.74, 300), '1400K radiance must exceed 300K radiance');
  });

  it('accurately resolves gas flare combustion regime for high deltaT (>40K)', () => {
    const result = solveDozierPyrometry(365, 295, 45);
    assert.ok(result.flameTempK >= 1150, `Flame temp should be >= 1150K, got ${result.flameTempK}K`);
    assert.ok(result.flameTempC >= 850, `Flame temp C should be >= 850C, got ${result.flameTempC}C`);
    assert.ok(result.flameAreaM2 <= 100, `Combustion area should be <= 100m2, got ${result.flameAreaM2}m2`);
    assert.ok(result.regime.includes('Gas Flare'), `Regime must identify gas flare, got ${result.regime}`);
    assert.ok(result.radiantHeatFluxKwM2 > 50, 'Radiant flux must be high');
  });

  it('accurately resolves wildfire / biomass regime for moderate deltaT', () => {
    const result = solveDozierPyrometry(320, 298, 120);
    assert.ok(result.flameTempK < 1200, `Wildfire flame temp should be < 1200K, got ${result.flameTempK}K`);
    assert.ok(result.regime.includes('Wildfire') || result.regime.includes('Biomass') || result.regime.includes('Residue'), 'Regime should be biomass/wildfire');
  });
});

describe('SHAP & XAI Feature Attribution Engine', () => {
  it('generates strong positive proximity and recurrence attributions for refinery gas flares', () => {
    const attributions = computeShapAttributions({
      distKm: 0.8,
      recurrenceIndex: 12,
      frp: 35,
      bright_ti4: 360,
      bright_ti5: 295,
      daynight: 'N'
    }, { category: 'Gas Flare' });

    assert.ok(Array.isArray(attributions));
    assert.ok(attributions.length >= 3);

    const prox = attributions.find(a => a.feature.includes('Proximity'));
    assert.ok(prox && prox.isPositive && prox.impact >= 30, 'Refinery proximity should have high positive impact');

    const rec = attributions.find(a => a.feature.includes('Recurrence'));
    assert.ok(rec && rec.isPositive && rec.impact >= 20, 'Recurrence should have positive impact');
  });

  it('generates appropriate remoteness attributions for natural wildfires', () => {
    const attributions = computeShapAttributions({
      distKm: 18.5,
      recurrenceIndex: 1,
      frp: 150,
      bright_ti4: 330,
      bright_ti5: 298,
      daynight: 'D'
    }, { category: 'Wildfire' });

    const remote = attributions.find(a => a.feature.includes('Remoteness'));
    assert.ok(remote && remote.isPositive, 'Remoteness should positively drive wildfire classification');
  });
});
