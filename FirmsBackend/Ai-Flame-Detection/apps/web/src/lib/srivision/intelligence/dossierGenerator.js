/**
 * @module src/intelligence/dossierGenerator
 * @description Generates structured, tactical incident briefing dossiers for disaster commanders.
 */

import { findFacilitiesNearby } from '../disasters/industrial/industrialFacilities.js';
import { findCategorizedRespondersNearby } from '../disasters/responders/emergencyResponders.js';
import { simulateFirePerimeters } from '../disasters/wildfire/fireSpreadSimulation.js';
import { generatePlumeFootprint } from '../disasters/dispersion/gaussianPlume.js';
import { createDataProvenance } from '../core/provenance.js';

/**
 * Generate a comprehensive incident briefing dossier.
 * @param {Object} incident
 * @returns {Object}
 */
export function generateIncidentDossier(incident = {}) {
  const {
    id = `INC-${Date.now()}`,
    type = 'WILDFIRE',
    latitude = 0,
    longitude = 0,
    severity = 'HIGH',
    frp = 0,
    magnitude = null,
    weather = {},
    radiusKm = 25,
  } = incident;

  const windSpeedKmh = Number(weather.windSpeedKmh || weather.windSpeed10m || 15);
  const windDirectionDeg = Number(weather.windDirectionDeg || weather.windDirection10m || 270);
  const relativeHumidity = Number(weather.relativeHumidity || weather.relativeHumidity2m || 30);
  const tempC = Number(weather.temperature2m || 32);

  // 1. Nearby Industrial & HazMat Infrastructure
  const nearbyFacilities = findFacilitiesNearby(latitude, longitude, radiusKm);

  // 2. Nearby Emergency Responders
  const nearbyResponders = findCategorizedRespondersNearby(latitude, longitude, Math.max(50, radiusKm * 2));

  // 3. Situational Physics Modeling
  let spreadSimulation = null;
  let plumeDispersion = null;

  if (type.toUpperCase().includes('FIRE') || type.toUpperCase().includes('ANOMALY')) {
    spreadSimulation = simulateFirePerimeters({
      lat: latitude,
      lon: longitude,
      windSpeedKmh,
      windDirectionDeg,
      fuelCategory: 'DENSE_FOREST',
      relativeHumidity,
      timeHorizonsHours: [1, 2, 4],
    });

    plumeDispersion = generatePlumeFootprint({
      sourceLat: latitude,
      sourceLon: longitude,
      windDirectionDeg,
      windSpeedMps: windSpeedKmh / 3.6,
      emissionRateGps: frp ? frp * 5 : 400,
      maxDistanceKm: 15,
    });
  }

  // 4. Checklist & Tactical Directives
  const tacticalChecklist = [
    `Deploy containment line on ${spreadSimulation?.spread_heading_deg || 90}° downwind flank.`,
    nearbyFacilities.length > 0
      ? `Alert ${nearbyFacilities.length} industrial facilities within ${radiusKm}km; verify water deluge systems at ${nearbyFacilities[0].name}.`
      : 'No high-hazard industrial plants within primary radius; maintain vegetative fuel breaks.',
    nearbyResponders.fire_stations.length > 0
      ? `Dispatch primary response from ${nearbyResponders.fire_stations[0].name} (${nearbyResponders.fire_stations[0].distance_km}km away).`
      : 'Dispatch regional mutual-aid units.',
    'Issue public health air quality advisory in downwind plume zone.',
  ];

  return {
    dossier_id: id,
    generated_at: new Date().toISOString(),
    incident_overview: {
      type,
      severity,
      coordinates: { latitude, longitude },
      thermal_frp_mw: frp || null,
      seismic_magnitude: magnitude || null,
    },
    meteorology: {
      wind_speed_kmh: windSpeedKmh,
      wind_direction_deg: windDirectionDeg,
      temperature_c: tempC,
      relative_humidity_pct: relativeHumidity,
    },
    threat_assessment: {
      high_hazard_facilities_count: nearbyFacilities.length,
      nearest_facility: nearbyFacilities[0] || null,
      nearby_facilities: nearbyFacilities.slice(0, 5),
    },
    emergency_resources: {
      nearest_fire_station: nearbyResponders.fire_stations[0] || null,
      nearest_hospital: nearbyResponders.hospitals[0] || null,
      nearest_ndrf_unit: nearbyResponders.ndrf_sdrf[0] || null,
    },
    simulation_models: {
      rate_of_spread: spreadSimulation,
      smoke_plume: plumeDispersion,
    },
    tactical_directives: tacticalChecklist,
    provenance: createDataProvenance({
      source: 'sriVision Tactical Dossier Synthesis Engine',
      sourceType: 'MULTI_SOURCE_SYNTHESIS',
      confidenceBasis: 'INTEGRATED_DISASTER_INTELLIGENCE',
      limitations: [
        'Tactical checklist is an automated decision-support guideline and requires field commander verification.',
      ],
    }),
  };
}
