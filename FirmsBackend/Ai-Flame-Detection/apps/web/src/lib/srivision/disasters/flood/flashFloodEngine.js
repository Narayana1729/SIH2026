/**
 * @module disasters/flood/flashFloodEngine
 * @description Hyper-Local Mountain Flash Flood Prediction & Catchment Lead-Time Engine.
 * Combines Kirpich Time of Concentration (Tc), Rational Method peak discharge (Qp),
 * upstream catchment slope, soil saturation, and 24h/72h rainfall intensity to forecast
 * downstream village inundation surge depth, arrival lead times, and trigger evacuation alerts.
 */

import { createDataProvenance, SOURCE_TYPES } from '../../core/provenance.js';

/**
 * Compute the Hydrological Time of Concentration (Tc) using the Kirpich Equation.
 * Tc is the time required for runoff to travel from the hydraulically most distant point in the catchment to the outlet.
 *
 * Formula:
 * Tc (hours) = 0.000324 * (L^0.77) / (S^0.385)
 * where:
 * - L is maximum hydraulic flow length (meters)
 * - S is catchment slope gradient (H / L, dimensionless)
 *
 * @param {Object} params
 * @param {number} params.flowLengthMeters - Length of upstream drainage path (m)
 * @param {number} params.elevationDropMeters - Catchment elevation drop from ridge to village (m)
 * @returns {number} Time of Concentration in hours
 */
export function computeTimeOfConcentration({
  flowLengthMeters = 3500,
  elevationDropMeters = 420,
}) {
  const L = Math.max(100, Number(flowLengthMeters) || 3500);
  const H = Math.max(10, Number(elevationDropMeters) || 420);
  const S = Math.max(0.001, H / L);

  // Kirpich equation: Tc (hours) = 0.000324 * (L^0.77) * (S^-0.385)
  const tcHours = 0.000324 * Math.pow(L, 0.77) * Math.pow(S, -0.385);
  return Math.round(Math.max(0.1, Math.min(24.0, tcHours)) * 100) / 100;
}

/**
 * Calculate Runoff Coefficient (C) calibrated by soil saturation & mountain terrain type.
 * @param {number} soilSaturationPct - Current soil moisture (0 - 100%)
 * @param {string} [terrainType='STEEP_ROCKY_MOUNTAIN'] - Catchment terrain category
 * @returns {number} Dimensionless runoff coefficient C (0.10 - 0.95)
 */
export function calculateRunoffCoefficient(soilSaturationPct, terrainType = 'STEEP_MOUNTAIN') {
  const sat = Math.max(0, Math.min(100, Number(soilSaturationPct) || 50));
  
  // Base runoff coefficients for steep terrain
  let baseC = 0.50;
  if (terrainType === 'STEEP_ROCKY_MOUNTAIN') baseC = 0.70;
  else if (terrainType === 'FORESTED_SLOPE') baseC = 0.35;
  else if (terrainType === 'AGRICULTURAL_TERRACE') baseC = 0.45;
  else if (terrainType === 'SETTLEMENT_VALLEY') baseC = 0.65;

  // As soil saturates towards 100%, infiltration capacity drops to near zero and C approaches 0.95
  const saturationMultiplier = 1.0 + (sat / 100.0) * 0.45;
  const c = Math.min(0.95, baseC * saturationMultiplier);
  return Math.round(c * 100) / 100;
}

/**
 * Compute Peak Discharge Runoff Surge (Qp) using the Rational Method.
 * Qp (m³/s) = 0.278 * C * I * A
 * @param {Object} params
 * @param {number} params.runoffCoefficient - Dimensionless C
 * @param {number} params.rainfallIntensityMmPerHr - Current rainfall intensity I (mm/hr)
 * @param {number} params.catchmentAreaKm2 - Drainage basin area A (km²)
 * @returns {number} Peak discharge Qp in m³/s
 */
export function computePeakDischarge({
  runoffCoefficient = 0.65,
  rainfallIntensityMmPerHr = 25,
  catchmentAreaKm2 = 12.5,
}) {
  const C = Math.max(0.1, Math.min(0.95, Number(runoffCoefficient) || 0.65));
  const I = Math.max(0, Number(rainfallIntensityMmPerHr) || 0);
  const A = Math.max(0.1, Number(catchmentAreaKm2) || 12.5);

  const qp = 0.278 * C * I * A;
  return Math.round(qp * 100) / 100;
}

/**
 * Estimate flash flood arrival lead time at the downstream village.
 * @param {number} tcHours - Time of Concentration
 * @param {number} stormDurationHours - Elapsed time since heavy cloudburst began
 * @param {number} peakDischargeM3s - Peak runoff rate
 * @returns {{ estimatedLeadTimeHours: number | null, urgency: string }}
 */
export function estimateFloodLeadTime(tcHours, stormDurationHours = 0.5, peakDischargeM3s = 40) {
  if (peakDischargeM3s < 5.0) {
    return { estimatedLeadTimeHours: null, urgency: 'NO_ACTIVE_FLOOD_SURGE' };
  }

  // Arrival time is Remaining Time of Concentration
  const remainingHours = Math.max(0.0, tcHours - (Number(stormDurationHours) || 0));
  const leadTimeHours = Math.round(remainingHours * 10) / 10;

  let urgency = 'MONITOR';
  if (leadTimeHours <= 0.25 || (peakDischargeM3s > 80 && leadTimeHours <= 0.5)) {
    urgency = 'IMMINENT_INUNDATION_SURGE';
  } else if (leadTimeHours <= 1.5) {
    urgency = 'FLASH_FLOOD_CRITICAL_EVACUATE';
  } else if (leadTimeHours <= 4.0) {
    urgency = 'FLASH_FLOOD_HIGH_WARNING';
  } else {
    urgency = 'WATCH_ADVISORY';
  }

  return {
    estimatedLeadTimeHours: leadTimeHours,
    urgency,
  };
}

/**
 * Generate a hyper-local village-level Flash Flood & Inundation Risk Assessment.
 */
export function evaluateVillageFlashFloodRisk({
  villageId = 'VIL-FF-001',
  villageName = 'Valley Outpost',
  district = '',
  state = '',
  latitude = 0,
  longitude = 0,
  elevationM = 450,
  flowLengthMeters = 4200,
  elevationDropMeters = 650,
  catchmentAreaKm2 = 18.0,
  soilSaturationPct = 85,
  rainfallIntensityMmPerHr = 35,
  rainfall24hAccumulationMm = 160,
  rainfall72hAccumulationMm = 310,
  streamChannelBankCapacityM3s = 45,
  stormDurationHours = 0.8,
  historicalFloodEventsCount = 4,
} = {}) {
  const tcHours = computeTimeOfConcentration({
    flowLengthMeters,
    elevationDropMeters,
  });

  const runoffCoeff = calculateRunoffCoefficient(soilSaturationPct, 'STEEP_ROCKY_MOUNTAIN');
  const peakDischarge = computePeakDischarge({
    runoffCoefficient: runoffCoeff,
    rainfallIntensityMmPerHr,
    catchmentAreaKm2,
  });

  const leadTime = estimateFloodLeadTime(tcHours, stormDurationHours, peakDischarge);

  // Compute stream bank overflow surge ratio
  const bankCapacity = Math.max(5.0, Number(streamChannelBankCapacityM3s) || 45.0);
  const surgeOverCapacityRatio = Math.round((peakDischarge / bankCapacity) * 100) / 100;
  
  // Estimated flood water depth above village street level (m)
  let estimatedFloodDepthMeters = 0.0;
  if (surgeOverCapacityRatio > 1.0) {
    estimatedFloodDepthMeters = Math.round((surgeOverCapacityRatio - 1.0) * 0.85 * 100) / 100;
  }

  // Composite Hazard Score (0 - 100)
  let hazardScore = 0;
  const factors = [];

  // 1. Peak Runoff vs Bank Capacity (0 to 45 pts)
  if (surgeOverCapacityRatio >= 2.0) {
    hazardScore += 45;
    factors.push({ factor: 'Massive Channel Overtopping Surge', delta: 45, value: `Discharge ${peakDischarge} m³/s vs ${bankCapacity} m³/s capacity (${surgeOverCapacityRatio}x exceedance)` });
  } else if (surgeOverCapacityRatio >= 1.2) {
    hazardScore += 35;
    factors.push({ factor: 'Stream Bank Overflowing', delta: 35, value: `Discharge ${peakDischarge} m³/s exceeds capacity` });
  } else if (surgeOverCapacityRatio >= 0.85) {
    hazardScore += 20;
    factors.push({ factor: 'Near-Bankfull Hydraulic Conditions', delta: 20, value: `Discharge at ${(surgeOverCapacityRatio * 100).toFixed(0)}% channel capacity` });
  }

  // 2. Cloudburst / High Intensity Rainfall (0 to 30 pts)
  if (rainfallIntensityMmPerHr >= 50) {
    hazardScore += 30;
    factors.push({ factor: 'Cloudburst Rainfall Intensity (>=50 mm/hr)', delta: 30, value: `${rainfallIntensityMmPerHr} mm/hr` });
  } else if (rainfallIntensityMmPerHr >= 25) {
    hazardScore += 20;
    factors.push({ factor: 'Heavy Convective Downpour', delta: 20, value: `${rainfallIntensityMmPerHr} mm/hr` });
  } else if (rainfallIntensityMmPerHr >= 12) {
    hazardScore += 10;
    factors.push({ factor: 'Moderate Rainfall Rate', delta: 10, value: `${rainfallIntensityMmPerHr} mm/hr` });
  }

  // 3. Soil Saturated Catchment Infiltration Loss (0 to 15 pts)
  if (soilSaturationPct >= 85) {
    hazardScore += 15;
    factors.push({ factor: 'Catchment Saturated: Maximum Surface Runoff', delta: 15, value: `${soilSaturationPct}% saturation (C = ${runoffCoeff})` });
  } else if (soilSaturationPct >= 70) {
    hazardScore += 10;
    factors.push({ factor: 'High Soil Saturation', delta: 10, value: `${soilSaturationPct}% saturation` });
  }

  // 4. Historical Flood Recurrence (0 to 10 pts)
  if (historicalFloodEventsCount >= 3) {
    hazardScore += 10;
    factors.push({ factor: 'Vulnerable Valley Inundation Zone', delta: 10, value: `${historicalFloodEventsCount} prior historical inundation events` });
  }

  const finalScore = Math.min(100, Math.max(5, hazardScore));

  let alertTier = 'GREEN_NORMAL';
  if (finalScore >= 75 || surgeOverCapacityRatio >= 1.5) alertTier = 'RED_FLASH_FLOOD_EVACUATE';
  else if (finalScore >= 50 || surgeOverCapacityRatio >= 1.0) alertTier = 'ORANGE_FLOOD_WARNING';
  else if (finalScore >= 25) alertTier = 'YELLOW_FLOOD_WATCH';

  return {
    village_id: villageId,
    village_name: villageName,
    administrative_area: { district, state },
    coordinates: { latitude, longitude, elevation_m: elevationM },
    hazard_score_100: finalScore,
    alert_tier: alertTier,
    catchment_hydrology: {
      flow_length_meters: flowLengthMeters,
      elevation_drop_meters: elevationDropMeters,
      catchment_area_km2: catchmentAreaKm2,
      time_of_concentration_hours: tcHours,
      runoff_coefficient_c: runoffCoeff,
      peak_discharge_m3_per_sec: peakDischarge,
      channel_capacity_m3_per_sec: bankCapacity,
      surge_capacity_ratio: surgeOverCapacityRatio,
      estimated_inundation_depth_meters: estimatedFloodDepthMeters,
    },
    lead_time_assessment: leadTime,
    antecedent_precipitation: {
      current_intensity_mm_hr: rainfallIntensityMmPerHr,
      rainfall_24h_mm: rainfall24hAccumulationMm,
      rainfall_72h_mm: rainfall72hAccumulationMm,
      soil_saturation_pct: soilSaturationPct,
    },
    contributing_factors: factors,
    evacuation_directive: alertTier === 'RED_FLASH_FLOOD_EVACUATE'
      ? `CRITICAL FLASH FLOOD DIRECTIVE: Immediate evacuation of all households in ${villageName} residing within riverbanks and valley floors to elevated relief shelters. Expected flood surge arrival in ${leadTime.estimatedLeadTimeHours ?? '0'} hours with ~${estimatedFloodDepthMeters}m inundation.`
      : alertTier === 'ORANGE_FLOOD_WARNING'
        ? `HIGH FLOOD WARNING: Move livestock and vulnerable populations to higher tiers. Clear stormwater outlets in ${villageName}.`
        : 'Maintain standard stream gauge and Doppler precipitation monitoring.',
    provenance: createDataProvenance({
      source: 'sriVision Hyper-Local Flash Flood Prediction Engine',
      sourceType: SOURCE_TYPES.SIMULATED,
      confidenceType: 'KIRPICH_TC_AND_RATIONAL_PEAK_DISCHARGE_RUNOFF_MODEL',
      limitations: [
        'Runoff calculations use lumped catchment parameters; sudden upstream natural dam breaches (landslide dam bursts) may produce extreme unmodeled surges.',
        'Continuous calibration against local stream telemetry is strongly recommended.',
      ],
    }),
  };
}
