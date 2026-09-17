/**
 * @module disasters/landslide/data/sentinelSlopesData
 * @description Curated High-Vulnerability Sentinel Slopes across Western Ghats and Himalayas.
 * Every slope twin explicitly declares telemetry sources and data provenance to ensure scientific honesty.
 */

export const TELEMETRY_PROVENANCE = {
  OBSERVED: 'OBSERVED',     // Real ground telemetry (AWS station, calibrated rain gauge, in-situ piezometer)
  MODELLED: 'MODELLED',     // High-resolution physics/hydrology reanalysis or spatial interpolation
  FORECAST: 'FORECAST',     // Multi-model weather ensemble projection (IMD / ECMWF / GFS)
  SYNTHETIC: 'SYNTHETIC',   // Calibrated simulation scenario / historical playback
  UNAVAILABLE: 'UNAVAILABLE'// Not instrumented or data link down
};

export const SENTINEL_SLOPES = [
  {
    slopeId: 'WY-MEPPADI-01',
    name: 'Chooralmala / Mundakkai Catchment',
    region: 'Wayanad, Kerala (Western Ghats)',
    coordinates: { latitude: 11.5512, longitude: 76.1264, elevationM: 980 },
    regionalProfileId: 'WESTERN_GHATS_LATERITIC',
    terrain: {
      slopeDegrees: 34.5,
      twiNormalized: 0.78,           // High flow convergence in concave amphitheater
      profileCurvature: -0.042,      // Concave profile (flow acceleration into hollow)
      soilVulnerability: 0.85,       // Thick saprolite on steep gneissic bedrock
      historicalFailureDensity: 0.90,// Repeated severe debris flow scars (2019, 2024)
    },
    telemetry: {
      rainfallIntensity: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMmPerHour: 28.0 },
      rainfall24h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 185.0 },
      rainfall72h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 340.0 },
      soilMoisture: { source: TELEMETRY_PROVENANCE.MODELLED, available: true, valueSaturationPct: 92.0 },
      groundDeformation: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMm: null },
      piezometricHead: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMeters: null },
    },
    historicalMemory: {
      fastMm: 42.0,
      mediumMm: 165.0,
      slowMm: 380.0,
    },
    geotechnical: {
      cohesionKPa: 11.5,
      frictionAngleDeg: 29.5,
      unitWeightKNM3: 18.2,
      soilDepthM: 2.2,
    },
    administrativeUnit: {
      district: 'Wayanad',
      taluk: 'Vythiri',
      panchayat: 'Meppadi',
      ward: 'Chooralmala / Mundakkai',
      vulnerablePopulation: 1450,
    },
  },

  {
    slopeId: 'IDK-PETTIMUDI-02',
    name: 'Pettimudi / Rajamala Ridge Escarpment',
    region: 'Idukki, Kerala (Western Ghats)',
    coordinates: { latitude: 10.1583, longitude: 77.0167, elevationM: 1560 },
    regionalProfileId: 'WESTERN_GHATS_LATERITIC',
    terrain: {
      slopeDegrees: 36.0,
      twiNormalized: 0.72,
      profileCurvature: -0.038,
      soilVulnerability: 0.80,
      historicalFailureDensity: 0.85,
    },
    telemetry: {
      rainfallIntensity: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMmPerHour: 22.0 },
      rainfall24h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 160.0 },
      rainfall72h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 310.0 },
      soilMoisture: { source: TELEMETRY_PROVENANCE.MODELLED, available: true, valueSaturationPct: 88.0 },
      groundDeformation: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMm: null },
      piezometricHead: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMeters: null },
    },
    historicalMemory: {
      fastMm: 35.0,
      mediumMm: 140.0,
      slowMm: 320.0,
    },
    geotechnical: {
      cohesionKPa: 12.0,
      frictionAngleDeg: 30.0,
      unitWeightKNM3: 18.5,
      soilDepthM: 2.0,
    },
    administrativeUnit: {
      district: 'Idukki',
      taluk: 'Devikulam',
      panchayat: 'Munnar',
      ward: 'Pettimudi Settlement',
      vulnerablePopulation: 820,
    },
  },

  {
    slopeId: 'UTK-JOSHIMATH-03',
    name: 'Helang Valley / Joshimath Upper Escarpment',
    region: 'Chamoli, Uttarakhand (Himalayas)',
    coordinates: { latitude: 30.5564, longitude: 79.5667, elevationM: 1890 },
    regionalProfileId: 'HIMALAYAN_COLLUVIAL',
    terrain: {
      slopeDegrees: 38.0,
      twiNormalized: 0.65,
      profileCurvature: -0.055,
      soilVulnerability: 0.90,       // Crushed tectonized quartzite and loose moraine
      historicalFailureDensity: 0.95,// Active subsidence & chronic slope toe erosion
    },
    telemetry: {
      rainfallIntensity: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMmPerHour: 14.0 },
      rainfall24h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 85.0 },
      rainfall72h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 175.0 },
      soilMoisture: { source: TELEMETRY_PROVENANCE.MODELLED, available: true, valueSaturationPct: 79.0 },
      groundDeformation: { source: TELEMETRY_PROVENANCE.MODELLED, available: true, valueMm: 18.5 }, // InSAR baseline displacement
      piezometricHead: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMeters: null },
    },
    historicalMemory: {
      fastMm: 22.0,
      mediumMm: 90.0,
      slowMm: 190.0,
    },
    geotechnical: {
      cohesionKPa: 8.5,
      frictionAngleDeg: 28.0,
      unitWeightKNM3: 19.0,
      soilDepthM: 3.5,
    },
    administrativeUnit: {
      district: 'Chamoli',
      taluk: 'Joshimath',
      panchayat: 'Joshimath Municipality',
      ward: 'Sunil / Manohar Bagh',
      vulnerablePopulation: 3100,
    },
  },

  {
    slopeId: 'HP-BHAGSUNAG-04',
    name: 'Dharamkot / Bhagsu Waterfall Upper Catchment',
    region: 'Kangra, Himachal Pradesh (Himalayas)',
    coordinates: { latitude: 32.2472, longitude: 76.3364, elevationM: 1980 },
    regionalProfileId: 'HIMALAYAN_COLLUVIAL',
    terrain: {
      slopeDegrees: 31.0,
      twiNormalized: 0.68,
      profileCurvature: -0.030,
      soilVulnerability: 0.70,
      historicalFailureDensity: 0.60,
    },
    telemetry: {
      rainfallIntensity: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMmPerHour: 10.0 },
      rainfall24h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 65.0 },
      rainfall72h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 125.0 },
      soilMoisture: { source: TELEMETRY_PROVENANCE.MODELLED, available: true, valueSaturationPct: 68.0 },
      groundDeformation: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMm: null },
      piezometricHead: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMeters: null },
    },
    historicalMemory: {
      fastMm: 15.0,
      mediumMm: 55.0,
      slowMm: 130.0,
    },
    geotechnical: {
      cohesionKPa: 14.0,
      frictionAngleDeg: 32.0,
      unitWeightKNM3: 18.8,
      soilDepthM: 1.8,
    },
    administrativeUnit: {
      district: 'Kangra',
      taluk: 'Dharamshala',
      panchayat: 'Bhagsu Nag',
      ward: 'Upper Waterfall Sector',
      vulnerablePopulation: 1200,
    },
  },

  {
    slopeId: 'WB-MIRIK-05',
    name: 'Tindharia / Mirik Ridge Flank',
    region: 'Darjeeling, West Bengal (Eastern Himalayas)',
    coordinates: { latitude: 26.8622, longitude: 88.1819, elevationM: 1495 },
    regionalProfileId: 'DARJEELING_GNEISSIC',
    terrain: {
      slopeDegrees: 29.0,
      twiNormalized: 0.58,
      profileCurvature: -0.020,
      soilVulnerability: 0.65,
      historicalFailureDensity: 0.50,
    },
    telemetry: {
      rainfallIntensity: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMmPerHour: 6.0 },
      rainfall24h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 35.0 },
      rainfall72h: { source: TELEMETRY_PROVENANCE.SYNTHETIC, available: true, valueMm: 75.0 },
      soilMoisture: { source: TELEMETRY_PROVENANCE.MODELLED, available: true, valueSaturationPct: 62.0 },
      groundDeformation: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMm: null },
      piezometricHead: { source: TELEMETRY_PROVENANCE.UNAVAILABLE, available: false, valueMeters: null },
    },
    historicalMemory: {
      fastMm: 8.0,
      mediumMm: 30.0,
      slowMm: 85.0,
    },
    geotechnical: {
      cohesionKPa: 15.0,
      frictionAngleDeg: 31.0,
      unitWeightKNM3: 18.4,
      soilDepthM: 1.5,
    },
    administrativeUnit: {
      district: 'Darjeeling',
      taluk: 'Kurseong',
      panchayat: 'Mirik Rural',
      ward: 'Ridge Sector 3',
      vulnerablePopulation: 950,
    },
  },
];

export function getAllSentinelSlopes() {
  return SENTINEL_SLOPES;
}

export function getSentinelSlopeById(slopeId) {
  return SENTINEL_SLOPES.find((s) => s.slopeId === slopeId) || null;
}
