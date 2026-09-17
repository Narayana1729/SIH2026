/**
 * Rothermel Wildfire Surface Fire Spread & Elliptical Growth Modeling.
 * Generates 1-hour, 2-hour, and 4-hour simulated burn perimeters with wind vectors
 * for 3D terrain projection.
 */

export interface FireSpreadSimulationOptions {
  originLat: number;
  originLon: number;
  windSpeedKmh?: number;
  windDirDegrees?: number; // meteorological direction (where wind comes FROM)
  frpMw?: number;
  fuelType?: "GRASS" | "SHRUB_BRUSH" | "TIMBER_LITTER" | "LOGGING_SLASH";
  slopeDegrees?: number;
}

export interface SpreadPerimeter {
  hour: number;
  areaHectares: number;
  forwardSpreadMeters: number;
  flankSpreadMeters: number;
  backingSpreadMeters: number;
  coordinates: [number, number][]; // [lon, lat] pairs
}

export interface FireSpreadSimulationResult {
  origin: { latitude: number; longitude: number };
  wind: {
    speedKmh: number;
    directionFromDeg: number;
    directionToDeg: number;
  };
  rateOfSpreadMPerMin: number;
  flameLengthMeters: number;
  fireIntensityKwM: number;
  perimeters: SpreadPerimeter[];
}

/**
 * Fuel parameters based on standard Anderson (1982) Fire Behavior Fuel Models.
 */
const FUEL_MODELS = {
  GRASS: { baseRos: 12.0, windFactor: 0.85, heatContent: 18000 },
  SHRUB_BRUSH: { baseRos: 6.5, windFactor: 0.65, heatContent: 19000 },
  TIMBER_LITTER: { baseRos: 2.2, windFactor: 0.45, heatContent: 18500 },
  LOGGING_SLASH: { baseRos: 4.8, windFactor: 0.55, heatContent: 20000 },
};

/**
 * Calculates Rothermel-based elliptical fire expansion perimeters.
 */
export function simulateRothermelFireSpread(
  options: FireSpreadSimulationOptions
): FireSpreadSimulationResult {
  const {
    originLat,
    originLon,
    windSpeedKmh = 18.0,
    windDirDegrees = 225.0, // South-West wind -> spreads North-East (45 deg)
    frpMw = 25.0,
    fuelType = "SHRUB_BRUSH",
    slopeDegrees = 5.0,
  } = options;

  const fuel = FUEL_MODELS[fuelType] || FUEL_MODELS.SHRUB_BRUSH;

  // Meteorological wind is "direction FROM", spread is "direction TO"
  const spreadDirectionDeg = (windDirDegrees + 180) % 360;
  const spreadDirRad = (spreadDirectionDeg * Math.PI) / 180;

  // Rate of spread (ROS) calculation (m/min)
  // Base ROS + Wind multiplier + Slope multiplier
  const windFactor = 1.0 + Math.pow(windSpeedKmh / 10.0, 1.4) * fuel.windFactor;
  const slopeFactor = 1.0 + 5.275 * Math.pow(Math.tan((slopeDegrees * Math.PI) / 180), 2);
  const frpMultiplier = 1.0 + Math.min(2.5, Math.log10(Math.max(1, frpMw)) * 0.4);

  const rosForwardMPerMin = fuel.baseRos * windFactor * slopeFactor * frpMultiplier * 0.15; // m/min
  const lengthToWidthRatio = 1.0 + 0.125 * windSpeedKmh; // Alexander (1985)
  const rosBackingMPerMin = rosForwardMPerMin / (lengthToWidthRatio + Math.sqrt(Math.max(1, lengthToWidthRatio * lengthToWidthRatio - 1)));
  const rosFlankMPerMin = (rosForwardMPerMin + rosBackingMPerMin) / (2.0 * lengthToWidthRatio);

  // Byram's Fireline Intensity (I = H * w * R) and Byram's Flame Length (L = 0.0775 * I^0.46)
  const intensityKwM = frpMw * 120.0;
  const flameLengthMeters = 0.0775 * Math.pow(Math.max(10, intensityKwM), 0.46);

  const timeStepsHours = [1, 2, 4];
  const R_EARTH = 6371000.0; // Earth radius in meters
  const numEllipsePoints = 48;

  const perimeters: SpreadPerimeter[] = timeStepsHours.map((hours) => {
    const totalMinutes = hours * 60;
    const forwardDist = rosForwardMPerMin * totalMinutes;
    const backingDist = rosBackingMPerMin * totalMinutes;
    const flankDist = rosFlankMPerMin * totalMinutes;

    // Semi-major axis (a) and semi-minor axis (b)
    const semiMajor = (forwardDist + backingDist) / 2.0;
    const semiMinor = flankDist;
    const centerOffset = (forwardDist - backingDist) / 2.0;

    // Ellipse center shifted downwind from ignition origin
    const centerDistRad = centerOffset / R_EARTH;
    const latRad = (originLat * Math.PI) / 180;
    const lonRad = (originLon * Math.PI) / 180;

    const centerLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(centerDistRad) +
        Math.cos(latRad) * Math.sin(centerDistRad) * Math.cos(spreadDirRad)
    );
    const centerLonRad =
      lonRad +
      Math.atan2(
        Math.sin(spreadDirRad) * Math.sin(centerDistRad) * Math.cos(latRad),
        Math.cos(centerDistRad) - Math.sin(latRad) * Math.sin(centerLatRad)
      );

    const perimeterCoords: [number, number][] = [];

    for (let i = 0; i <= numEllipsePoints; i++) {
      const theta = (i * (2 * Math.PI)) / numEllipsePoints;
      // Local ellipse parametric coordinates (x = flank, y = forward/back)
      const lx = semiMinor * Math.cos(theta);
      const ly = semiMajor * Math.sin(theta);

      // Rotate by spread azimuth angle
      const rotAngle = Math.PI / 2 - spreadDirRad;
      const rx = lx * Math.cos(rotAngle) - ly * Math.sin(rotAngle);
      const ry = lx * Math.sin(rotAngle) + ly * Math.cos(rotAngle);

      const dLat = (ry / R_EARTH) * (180 / Math.PI);
      const dLon = ((rx / R_EARTH) * (180 / Math.PI)) / Math.cos(centerLatRad);

      const pLat = Number(((centerLatRad * 180) / Math.PI + dLat).toFixed(6));
      const pLon = Number(((centerLonRad * 180) / Math.PI + dLon).toFixed(6));

      perimeterCoords.push([pLon, pLat]);
    }

    const areaSqMeters = Math.PI * semiMajor * semiMinor;
    const areaHectares = Number((areaSqMeters / 10000).toFixed(2));

    return {
      hour: hours,
      areaHectares,
      forwardSpreadMeters: Number(forwardDist.toFixed(1)),
      flankSpreadMeters: Number(flankDist.toFixed(1)),
      backingSpreadMeters: Number(backingDist.toFixed(1)),
      coordinates: perimeterCoords,
    };
  });

  return {
    origin: { latitude: originLat, longitude: originLon },
    wind: {
      speedKmh: windSpeedKmh,
      directionFromDeg: windDirDegrees,
      directionToDeg: spreadDirectionDeg,
    },
    rateOfSpreadMPerMin: Number(rosForwardMPerMin.toFixed(2)),
    flameLengthMeters: Number(flameLengthMeters.toFixed(2)),
    fireIntensityKwM: Number(intensityKwM.toFixed(1)),
    perimeters,
  };
}
