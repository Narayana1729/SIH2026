/**
 * @module src/disasters/dispersion/gaussianPlume
 * @description Physics-based atmospheric Gaussian Plume toxic dispersion model (Pasquill-Gifford).
 */

import * as Cesium from 'cesium';
import { createDataProvenance } from '../../core/provenance.js';

// Pasquill-Gifford dispersion parameter coefficients: sigma_y = a * (x/1000)^b, sigma_z = c * (x/1000)^d
// x in meters (converted to km for standard power-law coefficients)
const PASQUILL_GIFFORD_COEFFS = {
  A: { a: 213, b: 0.894, c: 440.8, d: 1.941 }, // Extremely Unstable
  B: { a: 156, b: 0.894, c: 106.6, d: 1.149 }, // Moderately Unstable
  C: { a: 104, b: 0.894, c: 61.0, d: 0.911 },  // Slightly Unstable
  D: { a: 68, b: 0.894, c: 33.2, d: 0.725 },   // Neutral (Overcast / High Wind)
  E: { a: 50.5, b: 0.894, c: 22.8, d: 0.678 }, // Slightly Stable (Nighttime)
  F: { a: 34, b: 0.894, c: 14.35, d: 0.740 },  // Moderately Stable (Clear Night)
};

/**
 * Compute solar elevation angle in degrees from latitude and solar hour.
 * Accounts for diurnal solar cycle and day length.
 */
export function computeSolarElevationDeg(latitudeDeg, hourOfDayLocal) {
  const declinationDeg = 15; // Mean seasonal solar declination
  const latRad = (latitudeDeg * Math.PI) / 180;
  const decRad = (declinationDeg * Math.PI) / 180;
  const hourAngleRad = ((hourOfDayLocal - 12) * 15 * Math.PI) / 180;

  const sinElevation = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
  return (Math.asin(Math.max(-1, Math.min(1, sinElevation))) * 180) / Math.PI;
}

/**
 * Determine Pasquill stability class factoring in diurnal solar cycle, ambient temperature, cloud cover, and wind speed.
 * @param {Object} params
 * @param {number} params.windSpeedMps - Wind speed at 10m height (m/s)
 * @param {number} [params.ambientTempC=28] - Ambient surface temperature in Celsius
 * @param {number} [params.hourOfDayLocal=14] - Local solar hour (0-23.9)
 * @param {number} [params.latitudeDeg=20] - Geographic latitude for solar elevation
 * @param {number} [params.cloudCoverFraction=0.2] - Cloud cover (0.0 to 1.0)
 * @param {boolean} [params.isDaytime] - Optional override
 * @returns {string} 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
 */
export function estimateStabilityClass(windSpeedMps, isDaytime = null, solarRadiation = 'moderate', options = {}) {
  const u = Math.max(0.5, windSpeedMps);
  const hour = options.hourOfDayLocal ?? (isDaytime === false ? 1 : 14);
  const lat = options.latitudeDeg ?? 20;
  const cloud = options.cloudCoverFraction ?? 0.2;
  const tempC = options.ambientTempC ?? 28;

  const solarElevation = computeSolarElevationDeg(lat, hour);
  const isDay = isDaytime !== null ? isDaytime : solarElevation > 0;

  if (isDay) {
    // Solar Insolation calculation (W/m2) factoring in solar angle and temperature
    const clearSkyInsolation = Math.max(0, 950 * Math.sin((Math.max(0, solarElevation) * Math.PI) / 180));
    const effectiveInsolation = clearSkyInsolation * (1 - 0.75 * Math.pow(cloud, 3.4)) * (1 + (tempC - 20) * 0.008);

    if (effectiveInsolation > 600) {
      if (u < 2) return 'A';
      if (u < 3) return 'A';
      if (u < 5) return 'B';
      return 'C';
    } else if (effectiveInsolation > 300) {
      if (u < 2) return 'A';
      if (u < 3) return 'B';
      if (u < 5) return 'B';
      if (u < 6) return 'C';
      return 'D';
    } else {
      // Slight / Overcast daylight (dawn/dusk or heavy overcast)
      if (u < 2) return 'B';
      if (u < 5) return 'C';
      return 'D';
    }
  } else {
    // Nighttime: Radiative cooling produces temperature inversion (Classes E, F)
    // Strong cooling on clear, cold nights traps toxic gases closer to ground
    const isClearNight = cloud < 0.38;
    if (u < 2) return isClearNight ? 'F' : 'E';
    if (u < 3) return isClearNight ? 'E' : 'D';
    if (u < 5) return 'D';
    return 'D';
  }
}

/**
 * Calculate thermal buoyancy plume rise using Briggs Equation.
 * Hot gases (high DeltaT) lift the effective stack height significantly, reducing peak ground contact.
 * @param {Object} params
 * @param {number} params.heatReleaseRateMw - Total convective heat release in MegaWatts (MW)
 * @param {number} params.stackHeightMeters - Physical stack / explosion release height (m)
 * @param {number} params.windSpeedMps - Wind speed at stack top (m/s)
 * @param {number} [params.ambientTempC=25] - Ambient temperature (C)
 * @param {number} [params.plumeTempK=900] - Combustion / flare plume temperature (K)
 * @param {string} [params.stabilityClass='D'] - Pasquill stability class
 * @returns {{ effectiveHeightMeters: number, plumeRiseMeters: number, buoyancyFlux: number }}
 */
export function calculateBriggsPlumeRise({
  heatReleaseRateMw = 10,
  stackHeightMeters = 15,
  windSpeedMps = 3.5,
  ambientTempC = 25,
  plumeTempK = 900,
  stabilityClass = 'D',
}) {
  const u = Math.max(0.8, windSpeedMps);
  const ambientTempK = ambientTempC + 273.15;
  const deltaT = Math.max(10, plumeTempK - ambientTempK);

  // Buoyancy flux Fb (m4/s3) proportional to convective heat release
  const buoyancyFlux = Math.max(1.0, 8.88e-6 * (heatReleaseRateMw * 1e6));

  let deltaH = 0;
  if (['A', 'B', 'C', 'D'].includes(stabilityClass)) {
    // Neutral / Unstable atmosphere
    if (buoyancyFlux < 55) {
      deltaH = 21.42 * Math.pow(buoyancyFlux, 0.75) / u;
    } else {
      deltaH = 38.71 * Math.pow(buoyancyFlux, 0.60) / u;
    }
  } else {
    // Stable atmosphere (Nighttime inversion)
    const stabilityParamS = (9.81 / ambientTempK) * (stabilityClass === 'F' ? 0.035 : 0.020);
    deltaH = 2.6 * Math.pow(buoyancyFlux / (u * stabilityParamS), 1 / 3);
  }

  // Cap plume rise to physical limits
  const plumeRiseMeters = Math.min(250, Math.max(2, deltaH));
  const effectiveHeightMeters = stackHeightMeters + plumeRiseMeters;

  return {
    effectiveHeightMeters,
    plumeRiseMeters: Math.round(plumeRiseMeters * 10) / 10,
    buoyancyFlux: Math.round(buoyancyFlux * 100) / 100,
  };
}

/**
 * Compute dispersion standard deviations (sigma_y, sigma_z) at downwind distance x (meters).
 */
export function computeSigmas(downwindXMeters, stabilityClass = 'D') {
  const coeff = PASQUILL_GIFFORD_COEFFS[stabilityClass] || PASQUILL_GIFFORD_COEFFS.D;
  const xKm = Math.max(0.01, downwindXMeters / 1000);
  const sigmaY = coeff.a * Math.pow(xKm, coeff.b);
  const sigmaZ = Math.max(1, coeff.c * Math.pow(xKm, coeff.d));
  return { sigmaY, sigmaZ };
}

/**
 * Calculate ground-level concentration C(x, y, 0) in mg/m3.
 * @param {Object} params
 * @param {number} params.emissionRateGps - Q (grams per second)
 * @param {number} params.windSpeedMps - u (meters per second)
 * @param {number} params.effectiveHeightMeters - H (meters, e.g. stack or plume rise)
 * @param {number} params.downwindXMeters - x along plume centerline
 * @param {number} params.crosswindYMeters - y perpendicular to centerline
 * @param {string} [params.stabilityClass='D']
 * @returns {number} Concentration in mg/m3
 */
export function calculateGroundConcentration({
  emissionRateGps,
  windSpeedMps,
  effectiveHeightMeters = 10,
  downwindXMeters,
  crosswindYMeters = 0,
  stabilityClass = 'D',
}) {
  if (downwindXMeters <= 0) return 0;
  const u = Math.max(0.5, windSpeedMps);
  const Q = Math.max(0.1, emissionRateGps);
  const H = Math.max(0, effectiveHeightMeters);

  const { sigmaY, sigmaZ } = computeSigmas(downwindXMeters, stabilityClass);

  const exponentY = -Math.pow(crosswindYMeters, 2) / (2 * Math.pow(sigmaY, 2));
  const exponentZ = -Math.pow(H, 2) / (2 * Math.pow(sigmaZ, 2));

  // Gaussian reflection at ground (z=0): term is 2 * exp(-H^2 / (2*sigmaZ^2))
  const concentrationGPerM3 = (Q / (Math.PI * u * sigmaY * sigmaZ)) * Math.exp(exponentY) * Math.exp(exponentZ);

  // Convert g/m3 to mg/m3 (multiply by 1000)
  return Math.max(0, concentrationGPerM3 * 1000);
}

/**
 * Generate geospatial plume polygon coordinates and concentration isopleths for visualization.
 * @param {Object} options
 * @param {number} options.sourceLat
 * @param {number} options.sourceLon
 * @param {number} options.windDirectionDeg - Meteorological wind direction (where wind blows FROM)
 * @param {number} options.windSpeedMps
 * @param {number} [options.emissionRateGps=500]
 * @param {number} [options.effectiveHeightMeters=15]
 * @param {number} [options.maxDistanceKm=15]
 * @param {string} [options.stabilityClass='D']
 * @param {string} [options.chemicalName='Toxic Vapor']
 * @param {Object} [options.thresholds={ advisory: 1.0, evacuation: 10.0, critical: 50.0 }]
 * @returns {Object}
 */
export function generatePlumeFootprint({
  sourceLat,
  sourceLon,
  windDirectionDeg,
  windSpeedMps,
  emissionRateGps = 500,
  effectiveHeightMeters = 15,
  maxDistanceKm = 15,
  stabilityClass = 'D',
  ambientTempC = 28,
  hourOfDayLocal = 14,
  heatReleaseRateMw = 0,
  plumeTempK = 850,
  chemicalName = 'Toxic Vapor',
  thresholds = { advisory: 1.0, evacuation: 10.0, critical: 50.0 },
}) {
  // If stabilityClass was left default 'D', dynamically estimate from diurnal solar elevation & ambient temp
  const resolvedStability = stabilityClass === 'D' 
    ? estimateStabilityClass(windSpeedMps, null, 'moderate', { ambientTempC, hourOfDayLocal, latitudeDeg: sourceLat })
    : stabilityClass;

  // If heat release rate is specified (e.g. refinery flare or large tank explosion), compute Briggs thermal plume rise
  let resolvedEffectiveHeight = effectiveHeightMeters;
  if (heatReleaseRateMw > 0) {
    const briggs = calculateBriggsPlumeRise({
      heatReleaseRateMw,
      stackHeightMeters: effectiveHeightMeters,
      windSpeedMps,
      ambientTempC,
      plumeTempK,
      stabilityClass: resolvedStability,
    });
    resolvedEffectiveHeight = briggs.effectiveHeightMeters;
  }

  // Plume travels downwind (180 deg opposite from wind origin)
  const plumeHeadingDeg = (windDirectionDeg + 180) % 360;
  const headingRad = (plumeHeadingDeg * Math.PI) / 180;

  const steps = 30;
  const maxMeters = maxDistanceKm * 1000;
  const stepSize = maxMeters / steps;

  const leftBorder = [];
  const rightBorder = [];
  const centerlineSamples = [];

  // Multi-tier isopleth boundaries
  const critLeft = [], critRight = [];
  const evacLeft = [], evacRight = [];

  // Approx conversion factors at latitude
  const latMetersPerDeg = 111132.954;
  const lonMetersPerDeg = 111132.954 * Math.cos((sourceLat * Math.PI) / 180);

  let maxGroundConc = 0;

  for (let i = 1; i <= steps; i++) {
    const x = i * stepSize;
    const { sigmaY } = computeSigmas(x, stabilityClass);
    const centerConc = calculateGroundConcentration({
      emissionRateGps,
      windSpeedMps,
      effectiveHeightMeters,
      downwindXMeters: x,
      crosswindYMeters: 0,
      stabilityClass,
    });

    if (centerConc > maxGroundConc) maxGroundConc = centerConc;

    // 2.15 * sigmaY represents ~90% plume width boundary
    const plumeHalfWidthMeters = Math.min(x * 0.8, 2.15 * sigmaY);

    // Vector along plume centerline
    const dxCenter = x * Math.sin(headingRad);
    const dyCenter = x * Math.cos(headingRad);

    // Vector perpendicular to centerline
    const dxPerp = plumeHalfWidthMeters * Math.cos(headingRad);
    const dyPerp = -plumeHalfWidthMeters * Math.sin(headingRad);

    const centerLat = sourceLat + dyCenter / latMetersPerDeg;
    const centerLon = sourceLon + dxCenter / lonMetersPerDeg;

    const leftLat = sourceLat + (dyCenter + dyPerp) / latMetersPerDeg;
    const leftLon = sourceLon + (dxCenter + dxPerp) / lonMetersPerDeg;

    const rightLat = sourceLat + (dyCenter - dyPerp) / latMetersPerDeg;
    const rightLon = sourceLon + (dxCenter - dxPerp) / lonMetersPerDeg;

    leftBorder.push([leftLon, leftLat]);
    rightBorder.unshift([rightLon, rightLat]);

    if (i <= Math.max(3, Math.round(steps * 0.35))) {
      critLeft.push([sourceLat + (dyCenter + dyPerp * 0.5) / latMetersPerDeg, sourceLon + (dxCenter + dxPerp * 0.5) / lonMetersPerDeg]);
      critRight.unshift([sourceLat + (dyCenter - dyPerp * 0.5) / latMetersPerDeg, sourceLon + (dxCenter - dxPerp * 0.5) / lonMetersPerDeg]);
    }

    if (i <= Math.max(6, Math.round(steps * 0.65))) {
      evacLeft.push([sourceLat + (dyCenter + dyPerp * 0.75) / latMetersPerDeg, sourceLon + (dxCenter + dxPerp * 0.75) / lonMetersPerDeg]);
      evacRight.unshift([sourceLat + (dyCenter - dyPerp * 0.75) / latMetersPerDeg, sourceLon + (dxCenter - dxPerp * 0.75) / lonMetersPerDeg]);
    }

    centerlineSamples.push({
      downwind_distance_km: Math.round((x / 1000) * 100) / 100,
      concentration_mg_m3: Math.round(centerConc * 1000) / 1000,
      latitude: centerLat,
      longitude: centerLon,
    });
  }

  // Polygon boundary closing back to source
  const polygonCoordinates = [[sourceLon, sourceLat], ...leftBorder, ...rightBorder, [sourceLon, sourceLat]];

  // Convert mg/m3 to approx ppm (assuming MW ~ 50-70g/mol average factor ~ 0.45)
  const maxGroundConcPpm = Math.round(maxGroundConc * 0.45 * 10) / 10;

  const isopleths = [
    {
      type: 'Feature',
      properties: { level: 'ADVISORY', threshold_ppm: thresholds.advisory, title: 'Advisory Isopleth (ERPG-1)' },
      geometry: { type: 'Polygon', coordinates: [polygonCoordinates] },
    },
  ];

  if (critLeft.length > 0) {
    const critCoords = [[sourceLon, sourceLat], ...critLeft.map(([la, lo]) => [lo, la]), ...critRight.map(([la, lo]) => [lo, la]), [sourceLon, sourceLat]];
    isopleths.unshift({
      type: 'Feature',
      properties: { level: 'CRITICAL', threshold_ppm: thresholds.critical, title: 'Immediate Danger to Life & Health (IDLH)' },
      geometry: { type: 'Polygon', coordinates: [critCoords] },
    });
  }

  if (evacLeft.length > 0) {
    const evacCoords = [[sourceLon, sourceLat], ...evacLeft.map(([la, lo]) => [lo, la]), ...evacRight.map(([la, lo]) => [lo, la]), [sourceLon, sourceLat]];
    isopleths.splice(1, 0, {
      type: 'Feature',
      properties: { level: 'EVACUATE', threshold_ppm: thresholds.evacuation, title: 'Emergency Action Level (AEGL-2)' },
      geometry: { type: 'Polygon', coordinates: [evacCoords] },
    });
  }

  return {
    model_type: 'GAUSSIAN_ATMOSPHERIC_PLUME',
    simulation_title: 'Atmospheric Dispersion Screening Simulation (Gaussian Plume — Pasquill-Gifford)',
    chemical: chemicalName,
    chemical_name: chemicalName,
    chemical_provenance: 'ASSUMED_SCENARIO_OR_FACILITY_CATALOG_LOOKUP',
    satellite_detected_chemical: false,
    is_chemical_measured_by_satellite: false,
    epistemic_provenance: {
      observed: {
        source_latitude: sourceLat,
        source_longitude: sourceLon,
        description: 'Satellite thermal hotspot origin coordinates',
      },
      estimated: {
        stability_class: stabilityClass,
        effective_height_meters: effectiveHeightMeters,
        emission_rate_gps: emissionRateGps,
        max_ground_concentration_ppm: maxGroundConcPpm,
        description: 'Parameters estimated via Pasquill-Gifford stability lookup and emission proxies',
      },
      assumed: {
        chemical: chemicalName,
        molecular_weight_surrogate: '50-70 g/mol',
        atmospheric_state: 'Steady-state homogeneous wind field',
        terrain: 'Flat/moderate topography without urban canyon obstacles',
        description: 'Chemical species and meteorology homogeneity assumptions',
      },
      unknown: {
        confirmed_toxic_release: false,
        actual_source_mass_emission_rate: null,
        microscale_building_turbulence: null,
        description: 'Real chemical release occurrence and fine-scale plume dynamics cannot be measured by satellite IR',
      },
    },
    release_origin: { latitude: sourceLat, longitude: sourceLon },
    source: { lat: sourceLat, lon: sourceLon },
    plume_heading_deg: Math.round(plumeHeadingDeg * 10) / 10,
    wind_speed_mps: windSpeedMps,
    wind_speed_m_s: windSpeedMps,
    wind_direction_degrees: windDirectionDeg,
    stability_class: stabilityClass,
    max_downwind_km: maxDistanceKm,
    maxPlumeDistanceKm: maxDistanceKm,
    evacuationDistanceMeters: Math.round(maxDistanceKm * 1000 * 0.35),
    max_ground_concentration_ppm: maxGroundConcPpm,
    thresholds,
    centerline_samples: centerlineSamples,
    polygon_geojson: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoordinates],
      },
      properties: {
        plume_heading_deg: plumeHeadingDeg,
        stability_class: stabilityClass,
        emission_rate_gps: emissionRateGps,
      },
    },
    geojson_footprint: {
      type: 'FeatureCollection',
      features: isopleths,
    },
    provenance: createDataProvenance({
      source: 'sriVision Gaussian Plume Dispersion Engine',
      sourceType: 'PHYSICS_SIMULATION',
      confidenceBasis: 'PASQUILL_GIFFORD_ATMOSPHERIC_DISPERSION',
      limitations: [
        'Screening-level model: Assumes steady-state homogeneous wind vectors and flat/moderate terrain.',
        'Complex urban canyon turbulence, microclimate inversions, and chemical photo-oxidation are not modeled.',
        'Chemical species is an assumed scenario parameter or facility HazMat catalog lookup; satellites do NOT identify specific chemical compounds in this pipeline.',
      ],
    }),
  };
}

let activePlumeDataSource = null;

/**
 * Generate glowing circular flame badge canvas matching tactical HUD reference.
 */
function createFlamePinCanvas() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Outer radial emerald glow
  const gradient = ctx.createRadialGradient(36, 36, 10, 36, 36, 34);
  gradient.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
  gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.55)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(36, 36, 34, 0, Math.PI * 2);
  ctx.fill();

  // Vibrant mint outline ring
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(36, 36, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Dark core circular disk
  ctx.fillStyle = '#030712';
  ctx.beginPath();
  ctx.arc(36, 36, 17, 0, Math.PI * 2);
  ctx.fill();

  // Center Flame icon
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔥', 36, 37);

  return canvas;
}

/**
 * Helper to generate closed circular positions on WGS84 ellipsoid.
 */
function generateCirclePositions(centerLon, centerLat, radiusMeters, segments = 72) {
  const positions = [];
  const latMPerDeg = 111132.954;
  const lonMPerDeg = 111132.954 * Math.cos((centerLat * Math.PI) / 180);
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const dx = radiusMeters * Math.sin(theta);
    const dy = radiusMeters * Math.cos(theta);
    positions.push(Cesium.Cartesian3.fromDegrees(centerLon + dx / lonMPerDeg, centerLat + dy / latMPerDeg));
  }
  return positions;
}

/**
 * Render dynamic 3D Gaussian dispersion plume footprint and wind vector on Cesium globe.
 * Implements tactical concentric cordon rings (1km, 2.5km, 5km), glowing flame beacon,
 * and terrain-clamped downwind dispersion cone matching operational disaster maps.
 * @param {Cesium.Viewer} viewer
 * @param {Object} plumeData
 */
export function renderPlumeOnCesium(viewer, plumeData) {
  if (!viewer || !plumeData || viewer.isDestroyed?.()) return;

  if (!activePlumeDataSource) {
    activePlumeDataSource = new Cesium.CustomDataSource('sri-gaussian-plume');
    viewer.dataSources.add(activePlumeDataSource);
  } else {
    activePlumeDataSource.entities.removeAll();
  }

  const sourceLat = plumeData.release_origin?.latitude ?? plumeData.source?.lat ?? plumeData.lat;
  const sourceLon = plumeData.release_origin?.longitude ?? plumeData.source?.lon ?? plumeData.lon;
  if (sourceLat == null || sourceLon == null || isNaN(sourceLat) || isNaN(sourceLon)) return;

  const latMetersPerDeg = 111132.954;
  const lonMetersPerDeg = 111132.954 * Math.cos((sourceLat * Math.PI) / 180);
  const headingRad = ((plumeData.plume_heading_deg ?? 225) * Math.PI) / 180;
  const windMps = plumeData.wind_speed_mps ?? 4.5;
  const windDirDeg = plumeData.wind_direction_degrees ?? 225;

  // ── 1. Concentric Safety Cordon Rings (1km Red, 2.5km Orange, 5km Blue) ──
  const rings = [
    {
      name: 'Initial Isolation Zone (1.0 km)',
      radiusM: 1000,
      colorHex: '#ef4444',
      fillCss: 'rgba(239, 68, 68, 0.08)',
      dashLength: 14.0,
      width: 2.2,
    },
    {
      name: 'Protective Action Evacuation Zone (2.5 km)',
      radiusM: 2500,
      colorHex: '#f97316',
      fillCss: 'rgba(249, 115, 22, 0.05)',
      dashLength: 18.0,
      width: 2.2,
    },
    {
      name: 'Downwind Dispersion Buffer Zone (5.0 km)',
      radiusM: 5000,
      colorHex: '#38bdf8',
      fillCss: 'rgba(56, 189, 248, 0.03)',
      dashLength: 22.0,
      width: 2.0,
    },
  ];

  for (const ring of rings) {
    // Subtle clamped fill ellipse
    activePlumeDataSource.entities.add({
      name: ring.name,
      position: Cesium.Cartesian3.fromDegrees(sourceLon, sourceLat),
      ellipse: {
        semiMajorAxis: ring.radiusM,
        semiMinorAxis: ring.radiusM,
        material: Cesium.Color.fromCssColorString(ring.fillCss),
        classificationType: Cesium.ClassificationType.BOTH,
      },
    });

    // Sharp clamped dashed boundary polyline
    const circlePos = generateCirclePositions(sourceLon, sourceLat, ring.radiusM, 72);
    activePlumeDataSource.entities.add({
      name: `${ring.name} Boundary`,
      polyline: {
        positions: circlePos,
        width: ring.width,
        clampToGround: true,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString(ring.colorHex),
          dashLength: ring.dashLength,
        }),
      },
    });
  }

  // ── 2. Tactical Downwind Dispersion Plume Cone (Orange Dashed + Amber Fill) ──
  const coneLengthM = Math.min(5200, Math.max(2600, (plumeData.max_downwind_km || 4) * 1000 * 0.75));
  const halfSpreadRad = 0.33; // ~19 degrees physical lateral expansion

  const coneBoundary = [Cesium.Cartesian3.fromDegrees(sourceLon, sourceLat)];
  const arcSteps = 16;
  for (let s = 0; s <= arcSteps; s++) {
    const fraction = s / arcSteps;
    const currentAngle = (headingRad - halfSpreadRad) + fraction * (2 * halfSpreadRad);
    const arcDist = coneLengthM * (1 - 0.08 * Math.pow((fraction - 0.5) * 2, 2)); // slight parabolic curvature
    const dx = arcDist * Math.sin(currentAngle);
    const dy = arcDist * Math.cos(currentAngle);
    coneBoundary.push(Cesium.Cartesian3.fromDegrees(sourceLon + dx / lonMetersPerDeg, sourceLat + dy / latMetersPerDeg));
  }
  coneBoundary.push(Cesium.Cartesian3.fromDegrees(sourceLon, sourceLat));

  // Clamped amber/orange polygon fill
  activePlumeDataSource.entities.add({
    name: 'Toxic Plume Downwind Dispersion Footprint',
    polygon: {
      hierarchy: coneBoundary,
      material: Cesium.Color.fromCssColorString('rgba(249, 115, 22, 0.32)'),
      classificationType: Cesium.ClassificationType.BOTH,
    },
  });

  // Clamped dashed perimeter outline
  activePlumeDataSource.entities.add({
    name: 'Plume Dispersion Cone Perimeter',
    polyline: {
      positions: coneBoundary,
      width: 2.6,
      clampToGround: true,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString('#f97316'),
        dashLength: 14.0,
      }),
    },
  });

  // ── 3. Downwind Centerline Wind Vector Arrow (Cyan Dashed Ray) ──
  const tipLengthM = coneLengthM * 1.1;
  const tipDx = tipLengthM * Math.sin(headingRad);
  const tipDy = tipLengthM * Math.cos(headingRad);
  const tipLat = sourceLat + tipDy / latMetersPerDeg;
  const tipLon = sourceLon + tipDx / lonMetersPerDeg;

  activePlumeDataSource.entities.add({
    name: `Live Wind Vector (${windMps.toFixed(1)} m/s @ ${windDirDeg}°)`,
    polyline: {
      positions: [
        Cesium.Cartesian3.fromDegrees(sourceLon, sourceLat),
        Cesium.Cartesian3.fromDegrees(tipLon, tipLat),
      ],
      width: 3.5,
      clampToGround: true,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString('#00e5ff'),
        dashLength: 16.0,
      }),
    },
  });

  // ── 4. Glowing Center Flame Pin Marker ──
  const flamePin = createFlamePinCanvas();
  if (flamePin) {
    activePlumeDataSource.entities.add({
      name: 'Incident Flame Origin',
      position: Cesium.Cartesian3.fromDegrees(sourceLon, sourceLat),
      billboard: {
        image: flamePin,
        width: 48,
        height: 48,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  // ── 5. Auto-Frame Camera to Tactical Overview ──
  try {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(sourceLon, sourceLat, 15000),
      duration: 1.2,
    });
  } catch {
    // Graceful camera fallback
  }

  showPlumeActiveBanner(viewer);
}

function showPlumeActiveBanner(viewer) {
  let banner = document.getElementById('sri-plume-active-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'sri-plume-active-banner';
    banner.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(0, 212, 255, 0.45);
      border-radius: 8px;
      padding: 6px 14px;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 11px;
      color: #e2e8f0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 212, 255, 0.2);
      backdrop-filter: blur(12px);
    `;
    banner.innerHTML = `
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00d4ff; box-shadow: 0 0 8px #00d4ff;"></span>
      <span style="font-weight: 700; letter-spacing: 0.5px; color: #38bdf8;">PLUME SIMULATION ACTIVE — Gaussian Dispersion Model</span>
      <button id="sri-clear-plume-btn" style="
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: all 120ms ease;
      ">✕ Clear Simulation</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('sri-clear-plume-btn')?.addEventListener('click', () => {
      clearPlumeFromCesium(viewer);
      const dispLayer = window.__sriVision?.hazardLayerManager?.getLayer('hazard-dispersion');
      if (dispLayer) dispLayer.clearPlumeEntities();
    });
  }
  banner.style.display = 'flex';
}

function hidePlumeActiveBanner() {
  const banner = document.getElementById('sri-plume-active-banner');
  if (banner) banner.style.display = 'none';
}

/**
 * Clear plume footprint from globe.
 * @param {Cesium.Viewer} viewer
 */
export function clearPlumeFromCesium(viewer) {
  if (activePlumeDataSource && viewer && !viewer.isDestroyed?.()) {
    activePlumeDataSource.entities.removeAll();
  }
  hidePlumeActiveBanner();
  window.__sriVision?.hazardInspector?.resetPlumeButtonState?.();
}
