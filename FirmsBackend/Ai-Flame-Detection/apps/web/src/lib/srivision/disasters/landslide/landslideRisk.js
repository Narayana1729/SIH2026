/**
 * @module disasters/landslide/landslideRisk
 * @description Hyper-Local Landslide Hazard Prediction & Factor of Safety (FS) Lead-Time Engine.
 * Combines infinite slope limit equilibrium mechanics, 72h antecedent rainfall accumulation,
 * soil saturation, and historical susceptibility zonation to generate village-level early warning alerts.
 */

import { createDataProvenance, SOURCE_TYPES } from '../../core/provenance.js';

// Standard Geotechnical Baseline Constants for Vulnerable Tropical / Mountain Soils (e.g. Western Ghats, Himalayas)
const GEOTECH_DEFAULTS = {
  soilCohesionKPa: 12.5,        // Effective cohesion c' (kPa)
  unitWeightKNPerM3: 18.5,      // Total unit soil weight gamma (kN/m³)
  waterUnitWeightKNPerM3: 9.81, // Unit weight of water gamma_w (kN/m³)
  frictionAngleDeg: 31.0,       // Effective internal friction angle phi' (degrees)
  soilDepthMeters: 2.0,         // Overburden soil depth z (m)
};

/**
 * Compute the Factor of Safety (FS) on an infinite slope under transient hydraulic pore pressures.
 *
 * Formula:
 * FS = [c' + (gamma - m * gamma_w) * z * cos^2(beta) * tan(phi')] / [gamma * z * sin(beta) * cos(beta)]
 *
 * @param {Object} params
 * @param {number} params.slopeDegrees - Slope angle beta (degrees)
 * @param {number} params.soilSaturationPct - Soil moisture saturation m (0% to 100%)
 * @param {number} [params.soilDepthMeters=2.0]
 * @param {number} [params.soilCohesionKPa=12.5]
 * @param {number} [params.frictionAngleDeg=31.0]
 * @returns {number} Factor of Safety (FS)
 */
export function computeFactorOfSafety({
  slopeDegrees,
  soilSaturationPct,
  soilDepthMeters = GEOTECH_DEFAULTS.soilDepthMeters,
  soilCohesionKPa = GEOTECH_DEFAULTS.soilCohesionKPa,
  frictionAngleDeg = GEOTECH_DEFAULTS.frictionAngleDeg,
}) {
  const betaRad = (Math.max(1.0, Math.min(75.0, Number(slopeDegrees) || 20.0)) * Math.PI) / 180;
  const phiRad = (Math.max(5.0, Math.min(50.0, Number(frictionAngleDeg) || 31.0)) * Math.PI) / 180;

  const m = Math.max(0.0, Math.min(1.0, (Number(soilSaturationPct) || 50.0) / 100.0));
  const z = Math.max(0.5, Number(soilDepthMeters) || 2.0);
  const gamma = GEOTECH_DEFAULTS.unitWeightKNPerM3;
  const gammaW = GEOTECH_DEFAULTS.waterUnitWeightKNPerM3;
  const c = Math.max(1.0, Number(soilCohesionKPa) || 12.5);

  const cosBeta = Math.cos(betaRad);
  const sinBeta = Math.sin(betaRad);

  // Resisting Shear Strength (Numerator)
  const effectiveVerticalStress = (gamma - m * gammaW) * z * Math.pow(cosBeta, 2);
  const resistingStrength = c + Math.max(0, effectiveVerticalStress) * Math.tan(phiRad);

  // Mobilized Driving Shear Stress (Denominator)
  const drivingStress = gamma * z * sinBeta * cosBeta;

  if (drivingStress <= 1e-4) return 5.0; // Flat terrain is completely stable

  const fs = resistingStrength / drivingStress;
  return Math.round(Math.max(0.1, Math.min(10.0, fs)) * 100) / 100;
}

/**
 * Estimate available lead time before potential slope failure based on ongoing precipitation rate.
 * @param {number} currentFS - Current Factor of Safety
 * @param {number} rainfallRateMmPerHour - Current hourly precipitation intensity
 * @param {number} saturationPct - Current saturation percentage
 * @returns {{ estimatedLeadTimeHours: number | null, urgency: string }}
 */
export function estimateFailureLeadTime(currentFS, rainfallRateMmPerHour, saturationPct) {
  if (currentFS >= 1.5 && saturationPct < 70) {
    return { estimatedLeadTimeHours: null, urgency: 'STABLE_NO_IMMEDIATE_FAILURE' };
  }

  const rainRate = Math.max(0.5, Number(rainfallRateMmPerHour) || 5.0);
  const remainingSafetyMargin = Math.max(0, currentFS - 1.0);

  // Lead time shrinks as FS approaches 1.0 and rainfall rate accelerates
  const hoursToCritical = Math.round(((remainingSafetyMargin * 12.0) / (rainRate / 10.0)) * 10) / 10;
  const clampedHours = Math.max(0.5, Math.min(48.0, hoursToCritical));

  let urgency = 'MONITOR';
  if (currentFS < 1.0) urgency = 'IMMINENT_SLOPE_COLLAPSE';
  else if (clampedHours <= 3.0) urgency = 'CRITICAL_EVACUATION_IMMEDIATE';
  else if (clampedHours <= 8.0) urgency = 'HIGH_PREPAREDNESS_WARNING';
  else if (clampedHours <= 24.0) urgency = 'WATCH_ADVISORY';

  return {
    estimatedLeadTimeHours: currentFS < 1.0 ? 0.0 : clampedHours,
    urgency,
  };
}

/**
 * Generate a hyper-local village/ward-level landslide risk assessment.
 */
export function evaluateVillageLandslideRisk({
  villageId = 'VIL-001',
  villageName = 'Hilly Settlement',
  district = '',
  state = '',
  latitude = 0,
  longitude = 0,
  elevationM = 850,
  slopeDegrees = 32,
  soilSaturationPct = 85,
  rainfallCurrentRateMmPerHr = 22,
  rainfall24hMm = 145,
  rainfall72hAccumulationMm = 280,
  historicalLandslideIncidentsCount = 3,
} = {}) {
  const fs = computeFactorOfSafety({ slopeDegrees, soilSaturationPct });
  const leadTime = estimateFailureLeadTime(fs, rainfallCurrentRateMmPerHr, soilSaturationPct);

  // Cumulative Hazard Score (0 - 100)
  let hazardScore = 0;
  const factors = [];

  // 1. Factor of Safety Contribution (0 to 45 pts)
  if (fs < 1.0) {
    hazardScore += 45;
    factors.push({ factor: 'Critical Factor of Safety (FS < 1.0)', delta: 45, value: `FS = ${fs} (Slope Failure Unstable)` });
  } else if (fs <= 1.2) {
    hazardScore += 35;
    factors.push({ factor: 'Low Factor of Safety (1.0 <= FS <= 1.2)', delta: 35, value: `FS = ${fs} (Marginally Stable)` });
  } else if (fs <= 1.5) {
    hazardScore += 20;
    factors.push({ factor: 'Moderate Factor of Safety (1.2 < FS <= 1.5)', delta: 20, value: `FS = ${fs}` });
  }

  // 2. 72-Hour Cumulative Rainfall (0 to 30 pts)
  if (rainfall72hAccumulationMm >= 250) {
    hazardScore += 30;
    factors.push({ factor: 'Extreme 72h Antecedent Rainfall', delta: 30, value: `${rainfall72hAccumulationMm} mm` });
  } else if (rainfall72hAccumulationMm >= 150) {
    hazardScore += 20;
    factors.push({ factor: 'Heavy 72h Precipitation', delta: 20, value: `${rainfall72hAccumulationMm} mm` });
  } else if (rainfall72hAccumulationMm >= 75) {
    hazardScore += 10;
    factors.push({ factor: 'Moderate Rainfall Accumulation', delta: 10, value: `${rainfall72hAccumulationMm} mm` });
  }

  // 3. Soil Saturation Level (0 to 15 pts)
  if (soilSaturationPct >= 90) {
    hazardScore += 15;
    factors.push({ factor: 'Near-Total Soil Water Saturation', delta: 15, value: `${soilSaturationPct}%` });
  } else if (soilSaturationPct >= 75) {
    hazardScore += 10;
    factors.push({ factor: 'High Soil Saturation', delta: 10, value: `${soilSaturationPct}%` });
  }

  // 4. Historical Landslide Recurrence (0 to 10 pts)
  if (historicalLandslideIncidentsCount >= 2) {
    hazardScore += 10;
    factors.push({ factor: 'Historical Landslide Prone Zonation', delta: 10, value: `${historicalLandslideIncidentsCount} past slope events` });
  }

  const finalScore = Math.min(100, Math.max(5, hazardScore));

  let alertTier = 'GREEN_NORMAL';
  if (finalScore >= 75 || fs < 1.0) alertTier = 'RED_EVACUATE_IMMEDIATE';
  else if (finalScore >= 50 || fs <= 1.2) alertTier = 'ORANGE_PREPAREDNESS';
  else if (finalScore >= 30) alertTier = 'YELLOW_WATCH';

  return {
    village_id: villageId,
    village_name: villageName,
    administrative_area: { district, state },
    coordinates: { latitude, longitude, elevation_m: elevationM },
    hazard_score_100: finalScore,
    alert_tier: alertTier,
    factor_of_safety: fs,
    slope_stability_status: fs < 1.0 ? 'FAILURE_ACTIVE' : fs <= 1.2 ? 'UNSTABLE' : fs <= 1.5 ? 'CRITICAL_WATCH' : 'STABLE',
    lead_time_assessment: leadTime,
    antecedent_precipitation: {
      current_intensity_mm_hr: rainfallCurrentRateMmPerHr,
      rainfall_24h_mm: rainfall24hMm,
      rainfall_72h_mm: rainfall72hAccumulationMm,
      soil_saturation_pct: soilSaturationPct,
    },
    contributing_factors: factors,
    evacuation_directive: alertTier === 'RED_EVACUATE_IMMEDIATE'
      ? `CRITICAL ALERT: Move all residents of ${villageName} within 500m of >25° slope toes to designated high-ground shelters immediately. Estimated window: ${leadTime.estimatedLeadTimeHours ?? '0'} hours.`
      : alertTier === 'ORANGE_PREPAREDNESS'
        ? `HIGH WARNING: Prepare vulnerable households in ${villageName} for staged evacuation. Halt vehicular traffic on mountain pass roads.`
        : 'Maintain routine automated rain gauge and geotechnical monitoring.',
    provenance: createDataProvenance({
      source: 'sriVision Hyper-Local Landslide Prediction Engine',
      sourceType: SOURCE_TYPES.SIMULATED,
      confidenceType: 'INFINITE_SLOPE_LIMIT_EQUILIBRIUM_AND_ANTECEDENT_RAINFALL',
      limitations: [
        'Geotechnical parameters are calibrated for regional weathered basalt/gneiss profiles; local bedrock fracturing may alter failure thresholds.',
        'Continuous field validation and automated rain-gauge telemetry are advised for real-time operation.',
      ],
    }),
  };
}
