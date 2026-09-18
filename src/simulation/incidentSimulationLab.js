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
 * @param {string} [params.chemicalName='Toxic Industrial Vapor']
 * @param {string} [params.fuelCategory='DENSE_FOREST']
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
  const chemicalName = params.chemicalName || 'Toxic Industrial Hydrocarbon Vapor';

  // 1. Effective Physics Parameters
  const effectiveFrp = frpMw * scenario.heat_multiplier;
  const effectiveEmissionRateGps = effectiveFrp * 15.0 * scenario.emission_multiplier;
  const downwindAzimuthDeg = (windDirDeg + 180) % 360;

  // 2. Atmospheric Dispersion Simulation
  const plumeResult = generatePlumeFootprint({
    sourceLat: lat,
    sourceLon: lon,
    windDirectionDeg: windDirDeg,
    windSpeedMps,
    emissionRateGps: effectiveEmissionRateGps,
    heatReleaseRateMw: effectiveFrp,
    chemicalName,
    maxDistanceKm: Math.min(25.0, 5.0 + (effectiveFrp / 10.0)),
    thresholds: {
      advisory: 1.0,
      evacuation: 5.0,
      critical: 25.0
    }
  });

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
  const searchRadiusKm = Math.max(10.0, plumeResult.maxPlumeDistanceKm || 12.0);
  const infraIntersections = infrastructureRegistry.findIntersectingInfrastructure(lat, lon, searchRadiusKm);
  const sanctuaryAssessment = evaluateProtectedAreaThreat(lat, lon, { searchRadiusKm });

  // Compute total simulated hazard area
  const plumeAreaKm2 = Number((Math.PI * Math.pow(plumeResult.maxPlumeDistanceKm || 5.0, 2) * (35 / 360)).toFixed(2));
  const blastAreaKm2 = scenario.blast_radius_meters > 0
    ? Number((Math.PI * Math.pow(scenario.blast_radius_meters / 1000.0, 2)).toFixed(3))
    : 0;
  const totalHazardAreaKm2 = Number((plumeAreaKm2 + blastAreaKm2).toFixed(2));

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
      chemical_simulated: chemicalName
    },
    projected_outputs: {
      plume_centerline_azimuth_deg: downwindAzimuthDeg,
      downwind_hazard_distance_km: plumeResult.maxPlumeDistanceKm || 8.5,
      total_affected_area_km2: totalHazardAreaKm2,
      blast_shockwave_radius_m: scenario.blast_radius_meters,
      evacuation_recommendation_m: Math.max(plumeResult.evacuationDistanceMeters || 1600, scenario.blast_radius_meters * 2.0)
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
