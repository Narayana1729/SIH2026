import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMLInferenceService, MLInferenceService } from '../server/services/mlInferenceService.mjs';
import { solveDozierPyrometry } from '../src/disasters/pyrometry/dozierPyrometry.js';
import { computeWindFactor } from '../src/disasters/wildfire/fireSpreadSimulation.js';
import { generatePlumeFootprint } from '../src/disasters/dispersion/gaussianPlume.js';
import { CompositeRiskAttributionEngine, MultiSourceIncidentCorrelationEngine } from '../src/intelligence/correlationEngine.js';
import { defaultFacilityContext } from '../src/firms/context/facilityContext.js';

describe('Production ML Integration & Fallback', () => {
  test('ML inference service provides deterministic rule-based fallback when forced or worker disabled', async () => {
    const service = new MLInferenceService({ enabled: false });
    const result = await service.classifyThermalEvent({
      latitude: 22.38,
      longitude: 69.87,
      bright_ti4: 368.0,
      bright_ti5: 304.0,
      frp_mw: 18.5,
    });

    assert.equal(result.inference_source, 'RULE_BASED_FALLBACK');
    assert.equal(result.is_ml_predicted, false);
    assert.ok(result.fallback_reason);
    assert.ok(result.observed);
    assert.equal(result.observed.latitude, 22.38);
    assert.ok(result.modeled_estimates);
    assert.equal(result.modeled_estimates.is_ndvi_measured, false);
    assert.ok(result.derived_intelligence);
  });

  test('ML inference service supports lazy worker spawning and prediction', async () => {
    // Test on default service
    const result = await defaultMLInferenceService.classifyThermalEvent({
      latitude: 17.68858,
      longitude: 83.251943,
      frp_mw: 290.0,
      brightness_temp_k: 388.0,
      daynight: 'N',
    }, { forceRuleBased: true });

    assert.ok(result.observed);
    assert.ok(result.modeled_estimates);
    assert.ok(result.derived_intelligence);
  });
});

describe('Scientific & Physical Model Boundaries Verification', () => {
  test('Dozier pyrometry solver performs unconstrained numerical bi-spectral inversion', () => {
    // Normal biomass fire (deltaT <= 45) -> unconstrained numerical inversion
    const normal = solveDozierPyrometry(325, 305, 50);
    assert.equal(normal.isHeuristicConstrained, false);
    assert.equal(normal.inversionMethod, 'DOZIER_NUMERICAL_SEARCH');

    // High deltaT thermal event -> pure numerical Planck search without arbitrary linear override
    const flare = solveDozierPyrometry(365, 295, 45);
    assert.equal(flare.isHeuristicConstrained, false);
    assert.equal(flare.inversionMethod, 'DOZIER_NUMERICAL_SEARCH');
    assert.ok(flare.flameTempK > 800 && flare.flameTempK < 2200);
    assert.ok(flare.flameAreaM2 > 0);
  });

  test('Rothermel wind factor formula produces verified power-law scaling', () => {
    const zeroWind = computeWindFactor(0);
    assert.equal(zeroWind, 0);

    // 36 km/h = 10 m/s midflame wind
    const u10 = computeWindFactor(36);
    // 0.9 * 10^1.4 = 0.9 * 25.11886 = ~22.6
    assert.ok(u10 > 22 && u10 < 23, `Expected ~22.6, got ${u10}`);
  });

  test('Gaussian plume model explicitly labels chemical provenance as non-satellite measured', () => {
    const plume = generatePlumeFootprint({
      sourceLat: 17.688,
      sourceLon: 83.251,
      windSpeedMps: 4.5,
      windDirectionDeg: 90,
      emissionRateGps: 15.0,
      chemicalName: 'Benzene',
    });

    assert.equal(plume.chemical_name, 'Benzene');
    assert.equal(plume.chemical_provenance, 'ASSUMED_SCENARIO_OR_FACILITY_CATALOG_LOOKUP');
    assert.equal(plume.is_chemical_measured_by_satellite, false);
    assert.ok(plume.provenance.scientific_limitations.some(l => l.includes('satellites do NOT identify specific chemical compounds')));
  });

  test('Risk attribution engine produces composite heuristic score with backward compatible alias', () => {
    assert.equal(CompositeRiskAttributionEngine, MultiSourceIncidentCorrelationEngine);
    const engine = new CompositeRiskAttributionEngine();

    const result = engine.correlateWildfireRisk({
      fire: { lat: 15.0, lon: 75.0, frp: 120, confidence: 0.9 },
      weather: { wind_speed_10m: 30, relative_humidity_2m: 18 },
      vegetation: { ndvi: 0.65 },
    });

    assert.equal(result.incident_type, 'WILDFIRE_ENVIRONMENTAL_RISK');
    assert.equal(result.severity, 'CRITICAL');
    assert.ok(result.risk_score >= 0.75);
    assert.ok(result.contributing_factors.length >= 3);
  });

  test('Facility context clearly labels estimated regional NDVI as proxy rather than satellite optical measurement', () => {
    // When no ndviHint is passed, it is an estimated regional climatological proxy
    const proxyCtx = defaultFacilityContext.getLandCoverContext(12.0, 76.0);
    assert.equal(proxyCtx.is_ndvi_measured, false);
    assert.equal(proxyCtx.ndvi_provenance, 'MODELED_REGIONAL_CLIMATOLOGY_PROXY');

    // When measured ndviHint is passed, it is marked as observed
    const measuredCtx = defaultFacilityContext.getLandCoverContext(12.0, 76.0, 0.72);
    assert.equal(measuredCtx.is_ndvi_measured, true);
    assert.equal(measuredCtx.ndvi_provenance, 'OBSERVED_SURFACE_REFLECTANCE');
  });
});
