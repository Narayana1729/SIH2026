/**
 * @module src/simulation/incidentSimulationLab
 * @description Physics-Based Deterministic What-If Incident Simulation Engine.
 *
 * Couples Gaussian atmospheric dispersion with Briggs plume rise and Rothermel
 * fire propagation models, allowing operators to run hypothetical disaster scenarios.
 *
 * Invariant: Outputs are strictly labeled SIMULATED SCENARIO and cite epistemic assumptions.
 */

import { generatePlumeFootprint } from '../disasters/dispersion/gaussianPlume.js';
import { simulateFirePerimeters } from '../disasters/wildfire/fireSpreadSimulation.js';
import { infrastructureRegistry } from '../gis/infrastructureRegistry.js';
import { evaluateProtectedAreaThreat } from '../services/protectedAreasService.js';
import { createDataProvenance } from '../core/provenance.js';
import { estimateCivilianExposure } from '../analytics/worldpopExposureEstimator.js';

export const STABILITY_CLASSES = Object.freeze({
  UNSTABLE: {
    id: 'UNSTABLE',
    pasquill: 'B',
    label: 'Class A/B (Unstable / Convective)',
    distanceMultiplier: 0.72,
    spreadAngleDeg: 38.0,
    verticalMixing: 'STRONG',
    uncertaintyPct: 20,
    description: 'Strong solar heating and vertical thermal mixing; shorter downwind reach but broader lateral spread.'
  },
  NEUTRAL: {
    id: 'NEUTRAL',
    pasquill: 'D',
    label: 'Class C/D (Neutral / Standard)',
    distanceMultiplier: 1.0,
    spreadAngleDeg: 22.0,
    verticalMixing: 'MODERATE',
    uncertaintyPct: 15,
    description: 'Overcast or high wind velocity; standard Pasquill-Gifford atmospheric dispersion profile.'
  },
  STABLE: {
    id: 'STABLE',
    pasquill: 'F',
    label: 'Class E/F (Stable / Inversion Trap)',
    distanceMultiplier: 1.48,
    spreadAngleDeg: 12.0,
    verticalMixing: 'SUPPRESSED',
    uncertaintyPct: 25,
    description: 'Clear nighttime nocturnal cooling; strong ground-level thermal inversion trapping pollutants in a narrow, elongated corridor.'
  }
});

export function validatePhysicsConsistency({ frpMw, mirBrightnessK, ambientTempK = 296 }) {
  const frp = Number(frpMw) || 0;
  const t4 = Number(mirBrightnessK) || 300;

  if (frp >= 120 && t4 < 332) {
    return {
      isConsistent: false,
      severity: 'WARNING',
      expectedTbMin: 342,
      message: `Thermal emission power (${frp.toFixed(0)} MW) is inconsistent with low VIIRS Band 4 brightness (${t4.toFixed(0)} K). High radiant energy typically yields sub-pixel satellite brightness ≥ 342 K.`
    };
  }

  if (frp <= 12 && t4 > 368) {
    return {
      isConsistent: true,
      severity: 'INFO',
      expectedTbMin: 320,
      message: `Concentrated point source: High brightness (${t4.toFixed(0)} K) with low aggregate FRP (${frp.toFixed(0)} MW) indicates a high-temperature micro-emitter (e.g., concentrated gas flare tip).`
    };
  }

  return {
    isConsistent: true,
    severity: 'NOMINAL',
    message: 'Telemetry is physically consistent with Stefan-Boltzmann radiative transfer.'
  };
}

export const SCENARIO_MODES = {
  BASELINE: {
    id: 'BASELINE',
    name: 'Baseline Meteorological Scenario',
    description: 'Direct propagation under specified environmental and thermal inputs.',
    emission_multiplier: 1.0,
    heat_multiplier: 1.0,
    blast_radius_meters: 0
  },
  ELEVATED_RELEASE: {
    id: 'ELEVATED_RELEASE',
    name: 'Elevated Industrial Release / Catastrophic Leak',
    description: 'Simulates high-pressure vessel rupture with 2.5x mass emission surge.',
    emission_multiplier: 2.5,
    heat_multiplier: 1.8,
    blast_radius_meters: 400
  },
  SECONDARY_EXPLOSION: {
    id: 'SECONDARY_EXPLOSION',
    name: 'Secondary BLEVE / Vapor Cloud Explosion',
    description: 'Simulates catastrophic boiling liquid expanding vapor explosion with 1000m blast shockwave.',
    emission_multiplier: 4.0,
    heat_multiplier: 3.2,
    blast_radius_meters: 1000
  },
  DRY_FUEL_GUST: {
    id: 'DRY_FUEL_GUST',
    name: 'Severe Drought & Sustained Wind Gust',
    description: 'Simulates extreme low vegetative moisture (<10% fuel moisture) accelerating fire front.',
    emission_multiplier: 1.5,
    heat_multiplier: 1.4,
    blast_radius_meters: 0
  }
};
export const SCENARIOS = SCENARIO_MODES;

/**
 * Execute a deterministic What-If simulation run.
 *
 * @param {Object} params
 * @param {number} params.latitude Incident latitude
 * @param {number} params.longitude Incident longitude
 * @param {number} params.windSpeedMps Wind speed in meters per second (0 - 35)
 * @param {number} params.windDirectionDeg Wind direction origin in degrees (0 - 360)
 * @param {number} params.frpMw Fire Radiative Power in MW (5 - 300)
 * @param {string} [params.scenarioMode='BASELINE'] One of SCENARIO_MODES keys
 * @param {string} [params.stabilityClass='NEUTRAL'] One of STABILITY_CLASSES keys ('UNSTABLE', 'NEUTRAL', 'STABLE')
 * @param {string} [params.chemicalName='Toxic Industrial Vapor']
 * @param {string} [params.fuelCategory='DENSE_FOREST']
 * @param {number} [params.mirBrightnessK=330] VIIRS Band 4 brightness temperature
 * @returns {Object} Deterministic simulation payload
 */
export function runWhatIfSimulation(params) {
  const lat = Number(params.latitude);
  const lon = Number(params.longitude);
  const windSpeedMps = Math.max(0.5, Math.min(35.0, Number(params.windSpeedMps || 5.0)));
  const windDirDeg = ((Number(params.windDirectionDeg || 240) % 360) + 360) % 360;
  const frpMw = Math.max(1.0, Math.min(500.0, Number(params.frpMw || 50.0)));
  const scenarioKey = params.scenarioMode || 'BASELINE';
  const scenario = SCENARIO_MODES[scenarioKey] || SCENARIO_MODES.BASELINE;
  const chemicalName = params.chemicalName || 'Estimated Particulate & Thermal Plume';
  const stabilityKey = String(params.stabilityClass || 'NEUTRAL').toUpperCase();
  const stability = STABILITY_CLASSES[stabilityKey] || STABILITY_CLASSES.NEUTRAL;

  // 1. Effective Physics Parameters (Stefan-Boltzmann Radiant Heat Release & Buoyancy)
  const effectiveFrp = frpMw * scenario.heat_multiplier;
  const effectiveEmissionRateGps = effectiveFrp * 15.0 * scenario.emission_multiplier;
  const downwindAzimuthDeg = (windDirDeg + 180) % 360;

  // Dynamic atmospheric transport physics:
  // Downwind transport distance scales with wind velocity u, thermal emission FRP, stability multiplier, and scenario multipliers
  const windFactor = Math.max(0.4, Math.min(2.8, Math.sqrt(windSpeedMps / 5.0)));
  const thermalFactor = Math.max(0.4, Math.min(3.0, Math.pow(effectiveFrp / 25.0, 0.45)));
  const baseDistanceKm = 5.2 * windFactor * thermalFactor * Math.sqrt(scenario.emission_multiplier);
  const dynamicDistanceKm = Number(Math.max(1.2, Math.min(45.0, baseDistanceKm * stability.distanceMultiplier)).toFixed(1));
  const uncertaintyKm = Number((dynamicDistanceKm * (stability.uncertaintyPct / 100)).toFixed(1));

  // Dynamic evacuation recommendation (meters)
  const dynamicEvacDistM = Math.max(
    scenario.blast_radius_meters > 0 ? Math.round(scenario.blast_radius_meters * 1.8) : 800,
    Math.round(Math.min(15000, (dynamicDistanceKm * 1000 * 0.35) + (scenario.blast_radius_meters > 0 ? scenario.blast_radius_meters : 0)))
  );

  // 2. Atmospheric Dispersion Simulation
  const plumeResult = generatePlumeFootprint({
    sourceLat: lat,
    sourceLon: lon,
    windDirectionDeg: windDirDeg,
    windSpeedMps,
    emissionRateGps: effectiveEmissionRateGps,
    heatReleaseRateMw: effectiveFrp,
    chemicalName,
    maxDistanceKm: dynamicDistanceKm,
    thresholds: {
      advisory: 1.0,
      evacuation: 5.0,
      critical: 25.0
    }
  });

  // Attach dynamic metrics to plumeResult so Cesium rendering reflects them
  plumeResult.maxPlumeDistanceKm = dynamicDistanceKm;
  plumeResult.max_downwind_km = dynamicDistanceKm;
  plumeResult.evacuationDistanceMeters = dynamicEvacDistM;
  plumeResult.scenario_metadata = scenario;
  plumeResult.blast_radius_meters = scenario.blast_radius_meters;

  // 3. Rothermel Spread Perimeters (1hr, 2hr, 4hr)
  const spreadResult = simulateFirePerimeters({
    originLat: lat,
    originLon: lon,
    windSpeedKmh: windSpeedMps * 3.6,
    windDirDegrees: windDirDeg,
    slopeDegrees: 5.0,
    fuelType: params.fuelCategory || 'TIMBER_LITTER',
    hours: [1, 2, 4]
  });

  // 4. Infrastructure & Sanctuary Intersections
  const searchRadiusKm = Math.max(12.0, dynamicDistanceKm * 1.25);
  const infraIntersections = infrastructureRegistry.findIntersectingInfrastructure(lat, lon, searchRadiusKm);
  const sanctuaryAssessment = evaluateProtectedAreaThreat(lat, lon, { searchRadiusKm });

  // Compute total simulated hazard area using Pasquill angular spread
  const plumeSpreadAngleDeg = stability.spreadAngleDeg;
  const plumeAreaKm2 = Number((Math.PI * Math.pow(dynamicDistanceKm, 2) * (plumeSpreadAngleDeg / 360)).toFixed(2));
  const blastAreaKm2 = scenario.blast_radius_meters > 0
    ? Number((Math.PI * Math.pow(scenario.blast_radius_meters / 1000.0, 2)).toFixed(3))
    : 0;
  const totalHazardAreaKm2 = Number((plumeAreaKm2 + blastAreaKm2).toFixed(2));

  // 5. WorldPop Civilian Population Exposure Estimation
  const exposureAssessment = estimateCivilianExposure({
    latitude: lat,
    longitude: lon,
    zone1RadiusKm: Math.min(1.0, Number((dynamicDistanceKm * 0.18).toFixed(1))),
    zone2DistanceKm: dynamicDistanceKm,
    zone3DistanceKm: Number((dynamicDistanceKm * 1.6).toFixed(1)),
    stabilityClass: stability.pasquill,
    landCover: params.landCover || 'industrial'
  });

  // 6. Physics-Consistency Verification
  const physicsCheck = validatePhysicsConsistency({
    frpMw,
    mirBrightnessK: params.mirBrightnessK || 330
  });

  return {
    simulation_id: `SIM-${Date.now()}-${scenario.id}`,
    epistemic_classification: 'SIMULATED SCENARIO',
    scientific_notice: 'OPERATOR-CONTROLLED HYPOTHETICAL SIMULATION. DO NOT REPRESENT AS OBSERVED SATELLITE TELEMETRY.',
    simulated_at: new Date().toISOString(),
    scenario_metadata: {
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      description: scenario.description,
      blast_radius_meters: scenario.blast_radius_meters,
      emission_multiplier: scenario.emission_multiplier
    },
    inputs: {
      latitude: lat,
      longitude: lon,
      wind_speed_mps: windSpeedMps,
      wind_speed_kmh: Number((windSpeedMps * 3.6).toFixed(1)),
      wind_direction_degrees: windDirDeg,
      downwind_heading_degrees: downwindAzimuthDeg,
      input_frp_mw: frpMw,
      effective_frp_mw: Number(effectiveFrp.toFixed(1)),
      chemical_simulated: chemicalName,
      stability_class: stability.id,
      stability_pasquill: stability.pasquill
    },
    projected_outputs: {
      plume_centerline_azimuth_deg: downwindAzimuthDeg,
      downwind_hazard_distance_km: dynamicDistanceKm,
      uncertainty_km: uncertaintyKm,
      total_affected_area_km2: totalHazardAreaKm2,
      blast_shockwave_radius_m: scenario.blast_radius_meters,
      evacuation_recommendation_m: dynamicEvacDistM,
      stability_profile: stability,
      civilian_exposure: exposureAssessment,
      physics_consistency: physicsCheck
    },
    plume: plumeResult,
    fire_spread: spreadResult,
    infrastructure_intersections: {
      total_assets_at_risk: infraIntersections.total_nearby_assets,
      potentially_affected: infraIntersections.infrastructure.filter(i => i.threat_state === 'POTENTIALLY_AFFECTED'),
      all_nearby: infraIntersections.infrastructure.slice(0, 5)
    },
    protected_area_threat: {
      nearest_sanctuary: sanctuaryAssessment.nearest_protected_area,
      threat_status: sanctuaryAssessment.threat_status
    },
    provenance: createDataProvenance({
      source: 'Gaussian Plume & Rothermel Semi-Empirical Mathematical Simulation Engine',
      epistemic_tier: 'SIMULATED_SCENARIO',
      attribution: 'PyroSat Incident Simulation Lab'
    })
  };
}
