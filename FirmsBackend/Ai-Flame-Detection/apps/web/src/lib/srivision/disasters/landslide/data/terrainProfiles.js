/**
 * @module disasters/landslide/data/terrainProfiles
 * @description Calibrated regional terrain and hydrological decay profiles.
 * Provides half-life drainage parameters, regional baseline critical rainfall thresholds,
 * and empirical vulnerability weights for distinct geotechnical domains (e.g. Western Ghats vs Himalayas).
 */

export const REGIONAL_PROFILES = {
  WESTERN_GHATS_LATERITIC: {
    id: 'WESTERN_GHATS_LATERITIC',
    name: 'Western Ghats Humid Lateritic / Weathered Basalt',
    description: 'Deep weathered red laterite overlying crystalline gneiss/granulite. High monsoon infiltration, rapid drainage of macropores with high antecedent retention in subsoil.',
    memory: {
      fastHalfLifeHours: 6.0,       // T_1/2 for rapid surficial drainage (hours)
      mediumHalfLifeHours: 36.0,    // T_1/2 for perched water table decay (hours)
      slowHalfLifeHours: 240.0,     // T_1/2 for deep soil moisture retention (10 days)
    },
    criticalThresholds: {
      intensity1hMmPerHour: 35.0,   // Critical 1-hour burst threshold (mm/hr)
      storm24hMm: 140.0,            // Critical 24-hour storm accumulation (mm)
      storm72hMm: 260.0,            // Critical 72-hour cumulative rainfall (mm)
      fastMemoryCritMm: 60.0,       // Critical fast memory scale
      mediumMemoryCritMm: 180.0,    // Critical medium memory scale
      slowMemoryCritMm: 450.0,      // Critical seasonal slow memory scale
    },
    stressWeights: {
      intensity: 0.35,              // Short burst weight (w_I)
      storm: 0.35,                  // Storm accumulation weight (w_P)
      memory: 0.30,                 // Multi-timescale memory weight (w_M)
    },
    memoryWeights: {
      fast: 0.25,                   // w_f
      medium: 0.45,                 // w_m
      slow: 0.30,                   // w_s
    },
    vulnerabilityWeights: {
      terrain: 0.45,                // Slope, TWI, curvature
      soil: 0.30,                   // Texture, thickness, permeability
      history: 0.25,                // Historical landslide recurrence/density
    },
  },

  HIMALAYAN_COLLUVIAL: {
    id: 'HIMALAYAN_COLLUVIAL',
    name: 'Himalayas Weathered Metamorphic / Steep Colluvium',
    description: 'Steep crushed quartzites, phyllites, and glacial colluvium. Rapid runoff, low cohesion, highly prone to short intense cloudburst triggers.',
    memory: {
      fastHalfLifeHours: 4.0,       // Faster surficial runoff on steep Himalayan rock
      mediumHalfLifeHours: 24.0,    // Perched water decays rapidly through loose scree
      slowHalfLifeHours: 168.0,     // 7 days seasonal baseline
    },
    criticalThresholds: {
      intensity1hMmPerHour: 40.0,   // Cloudburst burst trigger (mm/hr)
      storm24hMm: 110.0,            // Critical 24h storm
      storm72hMm: 200.0,            // Critical 72h storm
      fastMemoryCritMm: 50.0,
      mediumMemoryCritMm: 140.0,
      slowMemoryCritMm: 320.0,
    },
    stressWeights: {
      intensity: 0.45,              // Cloudburst intensity dominates
      storm: 0.30,
      memory: 0.25,
    },
    memoryWeights: {
      fast: 0.40,
      medium: 0.40,
      slow: 0.20,
    },
    vulnerabilityWeights: {
      terrain: 0.50,
      soil: 0.30,
      history: 0.20,
    },
  },

  DARJEELING_GNEISSIC: {
    id: 'DARJEELING_GNEISSIC',
    name: 'Eastern Himalayas / Darjeeling Gneissic Escarpment',
    description: 'High monsoon rainfall on folded Golden Gneiss and mica schists with widespread tea plantation deforestation.',
    memory: {
      fastHalfLifeHours: 5.0,
      mediumHalfLifeHours: 30.0,
      slowHalfLifeHours: 200.0,
    },
    criticalThresholds: {
      intensity1hMmPerHour: 30.0,
      storm24hMm: 130.0,
      storm72hMm: 240.0,
      fastMemoryCritMm: 55.0,
      mediumMemoryCritMm: 160.0,
      slowMemoryCritMm: 400.0,
    },
    stressWeights: {
      intensity: 0.35,
      storm: 0.35,
      memory: 0.30,
    },
    memoryWeights: {
      fast: 0.30,
      medium: 0.45,
      slow: 0.25,
    },
    vulnerabilityWeights: {
      terrain: 0.40,
      soil: 0.35,
      history: 0.25,
    },
  },
};

/**
 * Get profile by ID with fallback.
 * @param {string} profileId
 * @returns {Object}
 */
export function getRegionalProfile(profileId) {
  return REGIONAL_PROFILES[profileId] || REGIONAL_PROFILES.WESTERN_GHATS_LATERITIC;
}
