/**
 * @module core/hazardNormalizer
 * @description Ingests heterogeneous backend payloads and transforms them into standardized HazardContract objects.
 */

import {
  createHazardContract,
  HAZARD_TYPES,
  DATA_CLASSIFICATIONS,
  SEVERITY_LEVELS,
} from './hazardContract.js';

/**
 * Normalizes a NASA FIRMS active fire record.
 */
export function normalizeWildfireRecord(record, simulationSpread = null) {
  const lat = Number(record.latitude || record.lat) || 0;
  const lon = Number(record.longitude || record.lon) || 0;
  const frp = Number(record.frp) || 0;
  const confidence = record.confidence || 'nominal';

  let severity = SEVERITY_LEVELS.LOW;
  if (frp >= 250 || record.confidence_numeric >= 85) severity = SEVERITY_LEVELS.CRITICAL;
  else if (frp >= 75 || record.confidence_numeric >= 60) severity = SEVERITY_LEVELS.HIGH;
  else if (frp >= 20) severity = SEVERITY_LEVELS.MODERATE;

  const metrics = [
    { label: 'Fire Radiative Power (FRP)', value: frp.toFixed(1), unit: 'MW', status: severity },
    { label: 'Detection Confidence', value: String(confidence), unit: '', status: 'NORMAL' },
    { label: 'Sensor Satellite', value: record.satellite || record.sensor || 'VIIRS NOAA-20', unit: '', status: 'NORMAL' },
    { label: 'Day / Night', value: record.daynight === 'D' ? 'Daytime' : 'Nighttime', unit: '', status: 'NORMAL' },
  ];

  const actions = [];
  if (severity === SEVERITY_LEVELS.CRITICAL || severity === SEVERITY_LEVELS.HIGH) {
    actions.push(`Stage aerial/ground wildfire containment within 5km radius of [${lat.toFixed(3)}, ${lon.toFixed(3)}].`);
    actions.push('Monitor downwind thermal spread and assess nearby vulnerable structures or fuel beds.');
  } else {
    actions.push('Maintain automated satellite thermal anomaly tracking.');
  }

  return createHazardContract({
    id: `fire-${lat.toFixed(4)}-${lon.toFixed(4)}-${record.acq_date || Date.now()}`,
    hazardType: HAZARD_TYPES.WILDFIRE,
    title: `Active Thermal Anomaly (${frp > 0 ? `${frp.toFixed(0)} MW` : 'Fire Hotspot'})`,
    subtitle: `${record.satellite || 'VIIRS'} Detection · ${record.acq_date || 'Live NRT'}`,
    dataClassification: simulationSpread ? DATA_CLASSIFICATIONS.SIMULATED : DATA_CLASSIFICATIONS.OBSERVED,
    severity,
    location: {
      latitude: lat,
      longitude: lon,
      locality: record.locality || '',
      district: record.district || '',
      state: record.state || '',
    },
    metrics,
    actions,
    simulation: simulationSpread,
    provenance: record.provenance || null,
    rawPayload: record,
  });
}

/**
 * Normalizes an Industrial GIS Facility record with HazMat profile.
 */
export function normalizeIndustrialFacility(facility, nearbyResponders = null) {
  const props = facility.properties || facility;
  const coords = facility.geometry?.coordinates || [props.longitude || 0, props.latitude || 0];
  const lon = Number(coords[0]) || 0;
  const lat = Number(coords[1]) || 0;

  const hazardScore = Number(props.hazard_score || props.hazardScore || 50);
  const hazmat = props.hazmat_profile || props.hazmatProfile || {};

  let severity = SEVERITY_LEVELS.LOW;
  if (hazardScore >= 75 || props.tier === 'TIER_1_CRITICAL') severity = SEVERITY_LEVELS.CRITICAL;
  else if (hazardScore >= 50 || props.tier === 'TIER_2_HIGH') severity = SEVERITY_LEVELS.HIGH;
  else if (hazardScore >= 30) severity = SEVERITY_LEVELS.MODERATE;

  const metrics = [
    { label: 'Facility Risk Score', value: hazardScore, unit: '/100', status: severity },
    { label: 'Primary Hazardous Material', value: hazmat.primary_chemical || props.primary_chemical || 'Refinery Hydrocarbons', unit: '', status: 'NORMAL' },
    { label: 'Initial Isolation Distance', value: hazmat.initial_isolation_distance_meters || 300, unit: 'm', status: 'WARNING' },
    { label: 'Protective Evacuation Radius', value: hazmat.protective_action_distance_km || 1.5, unit: 'km', status: 'CRITICAL' },
  ];

  const actions = [
    `Establish initial isolation perimeter: ${hazmat.initial_isolation_distance_meters || 300}m in all directions.`,
    `Evacuate downwind populated sectors within ${hazmat.protective_action_distance_km || 1.5}km radius upon uncontained release.`,
    `Notify nearest specialized HazMat fire response teams.`,
  ];

  return createHazardContract({
    id: `fac-${props.id || props.facility_id || `${lat.toFixed(3)}_${lon.toFixed(3)}`}`,
    hazardType: HAZARD_TYPES.INDUSTRIAL_HAZMAT,
    title: props.name || props.facility_name || 'Industrial Facility',
    subtitle: `${props.sector || 'Chemical / Energy'} · ${props.district || ''} ${props.state || ''}`,
    dataClassification: DATA_CLASSIFICATIONS.ESTIMATED,
    severity,
    location: {
      latitude: lat,
      longitude: lon,
      locality: props.city || props.locality || '',
      district: props.district || '',
      state: props.state || '',
    },
    metrics,
    actions,
    responders: nearbyResponders,
    provenance: facility.provenance || {
      source: 'National Industrial GIS & HazMat Registry',
      source_type: 'REAL_STATIC',
      confidence_basis: 'VERIFIED_REGULATORY_SITE_RECORDS',
      scientific_limitations: [
        'Static facility database snapshot. Operating capacities and live storage volumes may differ.',
      ],
    },
    rawPayload: facility,
  });
}

/**
 * Normalizes a Gaussian Chemical Plume Dispersion simulation result.
 */
export function normalizePlumeDispersion(plumeResult) {
  const origin = plumeResult.release_origin || { latitude: 0, longitude: 0 };
  const maxConc = Number(plumeResult.max_ground_concentration_ppm) || 0;
  const chemName = plumeResult.chemical_name || 'Toxic Vapor';
  const thresholds = plumeResult.thresholds || {
    advisory: 5.0,
    evacuation: 20.0,
    critical: 50.0,
  };

  let severity = SEVERITY_LEVELS.LOW;
  if (maxConc >= thresholds.critical) severity = SEVERITY_LEVELS.CRITICAL;
  else if (maxConc >= thresholds.evacuation) severity = SEVERITY_LEVELS.HIGH;
  else if (maxConc >= thresholds.advisory) severity = SEVERITY_LEVELS.MODERATE;

  const metrics = [
    { label: 'Chemical Agent', value: chemName, unit: '', status: 'NORMAL' },
    { label: 'Max Ground Concentration', value: maxConc.toFixed(1), unit: 'ppm', status: severity },
    { label: 'Wind Vector', value: `${plumeResult.wind_speed_m_s || 5} m/s @ ${plumeResult.wind_direction_degrees || 0}°`, unit: '', status: 'NORMAL' },
    { label: 'Atmospheric Stability', value: `Pasquill-Gifford Class ${plumeResult.stability_class || 'D'}`, unit: '', status: 'NORMAL' },
  ];

  return createHazardContract({
    id: `plume-${Date.now()}`,
    hazardType: HAZARD_TYPES.CHEMICAL_PLUME,
    title: `Chemical Plume Dispersion: ${chemName}`,
    subtitle: `Terrain-Draped Ground Dispersion Footprint`,
    dataClassification: DATA_CLASSIFICATIONS.SIMULATED,
    severity,
    location: {
      latitude: origin.latitude,
      longitude: origin.longitude,
    },
    geometry: plumeResult.geojson_footprint || null,
    metrics,
    actions: [
      `Immediate downwind evacuation for populations in the >${thresholds.evacuation} ppm zone.`,
      `Issue shelter-in-place and window-sealing advisory for sectors downwind within the >${thresholds.advisory} ppm zone.`,
      `Deploy air-quality hazmat monitoring units along the centerline plume axis.`,
    ],
    simulation: plumeResult,
    provenance: plumeResult.provenance || {
      source: 'sriVision Gaussian Plume Dispersion Engine',
      source_type: 'SIMULATED',
      confidence_basis: 'PASQUILL_GIFFORD_ATMOSPHERIC_DISPERSION',
      scientific_limitations: [
        'Terrain-draped ground-level concentration isopleths based on Gaussian dispersion; does not resolve complex microscale CFD turbulence or mountain ridge wind channeling.',
      ],
    },
    rawPayload: plumeResult,
  });
}

/**
 * Normalizes a Landslide Village Risk result.
 */
export function normalizeLandslideVillage(villageRisk) {
  const fs = Number(villageRisk.factor_of_safety) || 1.5;
  const score = Number(villageRisk.hazard_score_100) || 50;
  const lead = villageRisk.lead_time_assessment || {};

  let severity = SEVERITY_LEVELS.LOW;
  if (villageRisk.alert_tier === 'RED_EVACUATE_IMMEDIATE' || fs < 1.0) severity = SEVERITY_LEVELS.CRITICAL;
  else if (villageRisk.alert_tier === 'ORANGE_PREPAREDNESS' || fs <= 1.2) severity = SEVERITY_LEVELS.HIGH;
  else if (villageRisk.alert_tier === 'YELLOW_WATCH' || fs <= 1.5) severity = SEVERITY_LEVELS.MODERATE;

  const metrics = [
    { label: 'Factor of Safety (FS)', value: fs.toFixed(2), unit: '', status: fs < 1.0 ? 'CRITICAL' : fs <= 1.2 ? 'WARNING' : 'NORMAL' },
    { label: 'Model-Derived Lead Time', value: lead.estimatedLeadTimeHours != null ? `${lead.estimatedLeadTimeHours}h` : 'Stable', unit: '', status: severity },
    { label: '72h Antecedent Rain', value: villageRisk.antecedent_precipitation?.rainfall_72h_mm || 0, unit: 'mm', status: 'NORMAL' },
    { label: 'Soil Saturation', value: villageRisk.antecedent_precipitation?.soil_saturation_pct || 0, unit: '%', status: 'NORMAL' },
  ];

  return createHazardContract({
    id: `landslide-${villageRisk.village_id || villageRisk.village_name}`,
    hazardType: HAZARD_TYPES.LANDSLIDE,
    title: `${villageRisk.village_name || 'Mountain Ward'} Slope Stability`,
    subtitle: `${villageRisk.administrative_area?.district || ''}, ${villageRisk.administrative_area?.state || ''} · Model-Derived Assessment`,
    dataClassification: DATA_CLASSIFICATIONS.ESTIMATED,
    severity,
    location: {
      latitude: villageRisk.coordinates?.latitude || 0,
      longitude: villageRisk.coordinates?.longitude || 0,
      elevationM: villageRisk.coordinates?.elevation_m || null,
      locality: villageRisk.village_name || '',
      district: villageRisk.administrative_area?.district || '',
      state: villageRisk.administrative_area?.state || '',
    },
    metrics,
    contributingFactors: villageRisk.contributing_factors || [],
    actions: [villageRisk.evacuation_directive || 'Maintain routine monitoring.'],
    provenance: villageRisk.provenance,
    rawPayload: villageRisk,
  });
}

/**
 * Normalizes a Flash Flood Village Risk result.
 */
export function normalizeFlashFloodVillage(floodRisk) {
  const hydro = floodRisk.catchment_hydrology || {};
  const score = Number(floodRisk.hazard_score_100) || 50;
  const lead = floodRisk.lead_time_assessment || {};

  let severity = SEVERITY_LEVELS.LOW;
  if (floodRisk.alert_tier === 'RED_FLASH_FLOOD_EVACUATE' || hydro.surge_capacity_ratio >= 1.5) severity = SEVERITY_LEVELS.CRITICAL;
  else if (floodRisk.alert_tier === 'ORANGE_FLOOD_WARNING' || hydro.surge_capacity_ratio >= 1.0) severity = SEVERITY_LEVELS.HIGH;
  else if (floodRisk.alert_tier === 'YELLOW_FLOOD_WATCH') severity = SEVERITY_LEVELS.MODERATE;

  const metrics = [
    { label: 'Peak Runoff Surge (Qp)', value: hydro.peak_discharge_m3_per_sec || 0, unit: 'm³/s', status: severity },
    { label: 'Channel Capacity Ratio', value: `${((hydro.surge_capacity_ratio || 1) * 100).toFixed(0)}%`, unit: '', status: hydro.surge_capacity_ratio > 1 ? 'CRITICAL' : 'NORMAL' },
    { label: 'Inundation Surge Depth', value: hydro.estimated_inundation_depth_meters || 0, unit: 'm', status: severity },
    { label: 'Kirpich Time of Conc. (Tc)', value: hydro.time_of_concentration_hours || 0, unit: 'h', status: 'NORMAL' },
  ];

  return createHazardContract({
    id: `flood-${floodRisk.village_id || floodRisk.village_name}`,
    hazardType: HAZARD_TYPES.FLASH_FLOOD,
    title: `${floodRisk.village_name || 'Valley Settlement'} Flash Flood Risk`,
    subtitle: `${floodRisk.administrative_area?.district || ''}, ${floodRisk.administrative_area?.state || ''} · Catchment Hydrology`,
    dataClassification: DATA_CLASSIFICATIONS.ESTIMATED,
    severity,
    location: {
      latitude: floodRisk.coordinates?.latitude || 0,
      longitude: floodRisk.coordinates?.longitude || 0,
      elevationM: floodRisk.coordinates?.elevation_m || null,
      locality: floodRisk.village_name || '',
      district: floodRisk.administrative_area?.district || '',
      state: floodRisk.administrative_area?.state || '',
    },
    metrics,
    contributingFactors: floodRisk.contributing_factors || [],
    actions: [floodRisk.evacuation_directive || 'Maintain standard river gauge watch.'],
    provenance: floodRisk.provenance,
    rawPayload: floodRisk,
  });
}
