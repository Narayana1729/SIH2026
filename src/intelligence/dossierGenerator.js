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
  const nearestFacility = nearbyFacilities[0] || null;
  const hazmat = nearestFacility?.hazmat_profile || null;

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

    const chemName = hazmat?.default_dispersion_chemical || 'Toxic Hydrocarbon Vapor';
    const thresholds = hazmat?.dispersion_thresholds || { advisory: 1.0, evacuation: 10.0, critical: 50.0 };

    plumeDispersion = generatePlumeFootprint({
      sourceLat: latitude,
      sourceLon: longitude,
      windDirectionDeg,
      windSpeedMps: windSpeedKmh / 3.6,
      emissionRateGps: frp ? frp * 5 : 400,
      heatReleaseRateMw: frp || 35,
      chemicalName: chemName,
      thresholds: thresholds,
      maxDistanceKm: 15,
    });
  }

  // 4. Checklist & Tactical Directives
  const tacticalChecklist = [
    `Deploy wildfire containment line on ${spreadSimulation?.spread_heading_deg || 90}° downwind flank.`,
  ];

  if (nearestFacility && hazmat) {
    tacticalChecklist.push(
      `🚨 ERG HazMat Isolation: Establish ${hazmat.initial_isolation_distance_meters || 800}m perimeter around ${nearestFacility.name}; evacuate downwind ${hazmat.downwind_evacuation_day_meters || 1600}m (Day) / ${hazmat.downwind_evacuation_night_meters || 2400}m (Night).`
    );
    if (hazmat.un_na_numbers?.length) {
      tacticalChecklist.push(`Placard Identification: Verify HazMat UN placards [${hazmat.un_na_numbers.join(', ')}] on storage vessels.`);
    }
    if (hazmat.firefighting_protocol) {
      tacticalChecklist.push(`🚒 CAMEO Firefighting Directive: ${hazmat.firefighting_protocol}`);
    }
    if (hazmat.toxic_combustion_byproducts?.length) {
      tacticalChecklist.push(`☣️ Toxic Byproduct Monitoring: Test downwind air for ${hazmat.toxic_combustion_byproducts.join(', ')}.`);
    }
  } else if (nearbyFacilities.length > 0) {
    tacticalChecklist.push(`Alert ${nearbyFacilities.length} industrial facilities within ${radiusKm}km; verify fixed water deluge monitors at ${nearbyFacilities[0].name}.`);
  } else {
    tacticalChecklist.push('No high-hazard industrial infrastructure within primary radius; maintain vegetative fuel breaks.');
  }

  if (nearbyResponders.fire_stations.length > 0) {
    tacticalChecklist.push(`Dispatch primary response from ${nearbyResponders.fire_stations[0].name} (${nearbyResponders.fire_stations[0].distance_km}km away).`);
  } else {
    tacticalChecklist.push('Dispatch regional mutual-aid units.');
  }
  tacticalChecklist.push('Issue public health air quality advisory in downwind plume zone.');

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
      nearest_facility: nearestFacility,
      nearby_facilities: nearbyFacilities.slice(0, 5),
    },
    hazmat_briefing: (nearestFacility && hazmat) ? {
      facility_name: nearestFacility.name,
      sector: nearestFacility.sector,
      distance_km: nearestFacility.distance_km,
      primary_chemicals: hazmat.primary_chemicals || [],
      un_na_numbers: hazmat.un_na_numbers || [],
      cameo_hazmat_class: hazmat.cameo_hazmat_class || '',
      disaster_risk: hazmat.primary_disaster_risk || '',
      initial_isolation_distance_meters: hazmat.initial_isolation_distance_meters || 800,
      downwind_evacuation_day_meters: hazmat.downwind_evacuation_day_meters || 1600,
      downwind_evacuation_night_meters: hazmat.downwind_evacuation_night_meters || 2400,
      toxic_combustion_byproducts: hazmat.toxic_combustion_byproducts || [],
      firefighting_protocol: hazmat.firefighting_protocol || '',
      idlh_ppm: hazmat.idlh_ppm || {},
      dispersion_chemical: hazmat.default_dispersion_chemical || 'Toxic Vapor',
    } : null,
    emergency_resources: {
      nearest_fire_station: nearbyResponders.fire_stations[0] || null,

      nearest_hospital: nearbyResponders.hospitals[0] || null,
      nearest_ndrf_unit: nearbyResponders.ndrf_sdrf[0] || null,
    },
    simulation_models: {
      rate_of_spread: spreadSimulation,
      smoke_plume: plumeDispersion ? {
        ...plumeDispersion,
        simulation_disclaimer: 'Screening model: plume footprint is simulated from hotspot origin; satellite does NOT detect toxic vapor concentration directly.',
      } : null,
    },
    tactical_directives: tacticalChecklist,
    provenance: createDataProvenance({
      source: 'sriVision Tactical Dossier Synthesis Engine',
      sourceType: 'MULTI_SOURCE_SYNTHESIS',
      confidenceBasis: 'INTEGRATED_DISASTER_INTELLIGENCE',
      limitations: [
        'Tactical checklist is an automated decision-support guideline and requires field commander verification.',
        'Smoke/vapor plume is a hypothetical atmospheric dispersion screening simulation based on meteorological wind fields and thermal hotspot origin; chemical identity is not measured by satellite.',
      ],
    }),
  };
}
