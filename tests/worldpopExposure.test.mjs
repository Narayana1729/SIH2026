import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePopulationDensity,
  estimateCivilianExposure,
  INDIAN_REGIONAL_POPULATION_DENSITY,
} from '../src/analytics/worldpopExposureEstimator.js';

test('WorldPop Exposure: Resolves nearest empirical Indian industrial anchor', () => {
  // HPCL Vizag Refinery (17.688 N, 83.251 E)
  const profile = resolvePopulationDensity(17.688, 83.251);
  assert.equal(profile.matchType, 'REGIONAL_ANCHOR_MATCH');
  assert.equal(profile.district, 'Visakhapatnam');
  assert.equal(profile.state, 'Andhra Pradesh');
  assert.ok(profile.densityPerKm2 >= 1500);

  // Jamnagar Refinery (22.47 N, 70.06 E)
  const jamProfile = resolvePopulationDensity(22.47, 70.06);
  assert.equal(jamProfile.district, 'Jamnagar');
  assert.equal(jamProfile.state, 'Gujarat');
  assert.ok(jamProfile.densityPerKm2 === 420);
});

test('WorldPop Exposure: Calculates concrete headcounts in Zone 1, Zone 2, and Zone 3', () => {
  // Run exposure estimation for Vizag explosion
  const exposure = estimateCivilianExposure({
    latitude: 17.688,
    longitude: 83.251,
    zone1RadiusKm: 0.8,   // 800m isolation
    zone2DistanceKm: 2.5, // 2.5km evacuation
    zone3DistanceKm: 6.0, // 6.0km advisory
    stabilityClass: 'D',
    landCover: 'industrial',
  });

  assert.ok(exposure.zones.zone1_immediate_danger.estimatedHeadcount > 0);
  assert.ok(exposure.zones.zone2_downwind_evacuation.estimatedHeadcount > 0);
  assert.ok(exposure.zones.zone3_air_quality_advisory.estimatedHeadcount > 0);
  assert.ok(exposure.totals.totalExposedHeadcount > exposure.zones.zone1_immediate_danger.estimatedHeadcount);

  // Check explicit readable format string
  assert.ok(exposure.zones.zone1_immediate_danger.formattedHeadcount.startsWith('~'));
  assert.ok(exposure.zones.zone1_immediate_danger.formattedHeadcount.includes('people'));
  assert.ok(exposure.executiveSummary.includes('Zone 1 (Immediate Danger)'));
  assert.ok(exposure.vulnerableDemographics.childrenUnderFive > 0);
  assert.ok(exposure.vulnerableDemographics.elderlyOverSixty > 0);
});

test('WorldPop Exposure: Distinguishes dense urban industrial from forest wilderness', () => {
  // Similipal Tiger Reserve (21.65 N, 86.35 E)
  const forestExposure = estimateCivilianExposure({
    latitude: 21.65,
    longitude: 86.35,
    zone1RadiusKm: 1.0,
    zone2DistanceKm: 3.0,
    landCover: 'forest',
  });

  // Mumbai-Thane Industrial (19.07 N, 72.87 E)
  const urbanExposure = estimateCivilianExposure({
    latitude: 19.07,
    longitude: 72.87,
    zone1RadiusKm: 1.0,
    zone2DistanceKm: 3.0,
    landCover: 'urban',
  });

  assert.ok(forestExposure.populationProfile.densityPerKm2 < 100);
  assert.ok(urbanExposure.populationProfile.densityPerKm2 > 5000);
  assert.ok(urbanExposure.zones.zone1_immediate_danger.estimatedHeadcount > forestExposure.zones.zone1_immediate_danger.estimatedHeadcount * 50);
});
