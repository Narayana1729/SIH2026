/**
 * Gaussian Plume Dispersion Simulation Engine
 * 
 * Implements deterministic smoke/gas dispersion approximations
 * calculating downwind transport, lateral spreading, and Pasquill-Gifford atmospheric stability.
 */

export type AtmosphericStability = 'STABLE' | 'NEUTRAL' | 'UNSTABLE';

export interface PlumeWeatherInput {
  windSpeed: number; // m/s or km/h
  windDirection: number; // degrees (0-360, where wind originates)
  stability: AtmosphericStability;
}

export interface PlumeTelemetry {
  status: 'ACTIVE' | 'NOT_APPLICABLE' | 'ZERO_WIND';
  statusMessage: string;
  windSpeed: number;
  windDirection: number;
  downwindHeading: number;
  stability: AtmosphericStability;
  plumeLengthKm: number;
  maxWidthMeters: number;
  areaSqKm: number;
  sourceFireId: string;
  sourceFireName: string;
  sourceSeverity: string;
}

export interface PlumePolygonFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][]; // [lon, lat] pairs
  };
  properties: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    riskLevel: string;
    distanceKm: number;
    widthMeters: number;
    zoneName: string;
  };
}

export interface PlumeFeatureCollection {
  type: 'FeatureCollection';
  features: PlumePolygonFeature[];
}

export const PLUME_CONFIG = {
  MIN_WIND_SPEED_MS: 0.5,
  LATERAL_COEFFS: {
    STABLE: 0.12,   // Thermal inversion / narrow plume
    NEUTRAL: 0.22,  // Standard atmospheric mixing
    UNSTABLE: 0.38, // Strong convective solar mixing / wide plume
  } as Record<AtmosphericStability, number>,
  DISPERSION_EXPONENT: 0.85,
  STEPS_COUNT: 30,
  EARTH_RADIUS_METERS: 6371000,
};

/**
 * Spherical forward geodesic projection helper.
 * Computes destination coordinates [lon, lat] given start point, distance (meters), and bearing (degrees).
 */
export function forwardGeodesic(
  startLon: number,
  startLat: number,
  distanceMeters: number,
  bearingDegrees: number
): [number, number] {
  if (distanceMeters === 0) return [startLon, startLat];

  const R = PLUME_CONFIG.EARTH_RADIUS_METERS;
  const d = distanceMeters / R;
  const lat1 = (startLat * Math.PI) / 180;
  const lon1 = (startLon * Math.PI) / 180;
  const brng = (bearingDegrees * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [
    Number(((lon2 * 180) / Math.PI).toFixed(6)),
    Number(((lat2 * 180) / Math.PI).toFixed(6)),
  ];
}

export interface CalculatePlumeParams {
  sourceLon: number;
  sourceLat: number;
  severity: string;
  frpMw: number;
  category: string;
  weather: PlumeWeatherInput;
  sourceId?: string;
  sourceName?: string;
}

export function calculatePlumeContours(params: CalculatePlumeParams): {
  featureCollection: PlumeFeatureCollection;
  telemetry: PlumeTelemetry;
} {
  const {
    sourceLon,
    sourceLat,
    severity,
    frpMw,
    category,
    weather,
    sourceId = 'INC-SOURCE',
    sourceName = 'Industrial Source',
  } = params;

  const { windSpeed, windDirection, stability } = weather;

  // Downwind transport heading (opposite of wind origin)
  const downwindHeading = ((windDirection + 180) % 360 + 360) % 360;

  // Exclude low-risk non-smoke incidents
  if (category === 'glint') {
    return {
      featureCollection: { type: 'FeatureCollection', features: [] },
      telemetry: {
        status: 'NOT_APPLICABLE',
        statusMessage: 'Plume simulation not applicable for solar glint optical anomalies',
        windSpeed,
        windDirection,
        downwindHeading,
        stability,
        plumeLengthKm: 0,
        maxWidthMeters: 0,
        areaSqKm: 0,
        sourceFireId: sourceId,
        sourceFireName: sourceName,
        sourceSeverity: severity,
      },
    };
  }

  if (windSpeed < PLUME_CONFIG.MIN_WIND_SPEED_MS) {
    return {
      featureCollection: { type: 'FeatureCollection', features: [] },
      telemetry: {
        status: 'ZERO_WIND',
        statusMessage: 'Calm atmospheric conditions (< 0.5 m/s) — radial stagnant stagnation',
        windSpeed,
        windDirection,
        downwindHeading,
        stability,
        plumeLengthKm: 0.5,
        maxWidthMeters: 500,
        areaSqKm: 0.78,
        sourceFireId: sourceId,
        sourceFireName: sourceName,
        sourceSeverity: severity,
      },
    };
  }

  // Atmospheric physics: Plume reach scales with wind advection (u) and thermal stability
  const stabilityReachFactors: Record<AtmosphericStability, number> = {
    STABLE: 1.35,   // Night inversion traps smoke near ground, increasing downwind reach
    NEUTRAL: 1.0,   // Standard neutral boundary layer
    UNSTABLE: 0.75, // Solar convective mixing dilutes smoke faster aloft
  };

  const stabilityFactor = stabilityReachFactors[stability] || 1.0;
  // Wind advection factor: higher wind speed carries plume further before ground dilution
  const windFactor = Math.pow(Math.max(0.5, windSpeed) / 3.5, 0.55);

  let baseLengthMeters = Math.max(1200, frpMw * 30 + 1800) * windFactor * stabilityFactor;
  if (severity === 'high' || severity === 'critical') baseLengthMeters *= 1.3;
  if (severity === 'low') baseLengthMeters *= 0.7;

  // Tactical bounds: 800m to 30km
  const totalLengthMeters = Math.min(30000, Math.max(800, baseLengthMeters));
  const k = PLUME_CONFIG.LATERAL_COEFFS[stability] || 0.22;

  // Generate 3 nested concentration zones: Zone 1 (Core toxic), Zone 2 (Heavy smoke), Zone 3 (Dispersal boundary)
  const zones = [
    { fraction: 1.0, severity: 'critical' as const, name: 'Hazard Outer Dispersal (PM2.5)' },
    { fraction: 0.65, severity: 'high' as const, name: 'Toxic Gas Dispersion Zone' },
    { fraction: 0.35, severity: 'medium' as const, name: 'Immediate Flammable / Thermal Core' },
  ];

  const features: PlumePolygonFeature[] = [];
  let maxPlumeWidthMeters = 0;

  zones.forEach((zone) => {
    const zoneLength = totalLengthMeters * zone.fraction;
    const steps = PLUME_CONFIG.STEPS_COUNT;
    const leftCoords: [number, number][] = [];
    const rightCoords: [number, number][] = [];

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * zoneLength;
      // Gaussian lateral standard deviation: sigma_y(x) = k * x^0.85
      const sigmaY = k * Math.pow(Math.max(1, x), PLUME_CONFIG.DISPERSION_EXPONENT);
      const halfWidth = sigmaY * 2.14 * (zone.fraction > 0.8 ? 1.0 : zone.fraction > 0.5 ? 0.7 : 0.4);

      if (halfWidth * 2 > maxPlumeWidthMeters) {
        maxPlumeWidthMeters = halfWidth * 2;
      }

      // Compute centerline downwind point
      const [centerLon, centerLat] = forwardGeodesic(sourceLon, sourceLat, x, downwindHeading);

      // Compute left and right perimeter bounds perpendicular to downwind heading
      const leftBearing = (downwindHeading - 90 + 360) % 360;
      const rightBearing = (downwindHeading + 90) % 360;

      const leftPt = forwardGeodesic(centerLon, centerLat, halfWidth, leftBearing);
      const rightPt = forwardGeodesic(centerLon, centerLat, halfWidth, rightBearing);

      leftCoords.push(leftPt);
      rightCoords.push(rightPt);
    }

    // Assemble polygon ring: Source -> Left side downwind -> Tip curve -> Right side back to source -> Source
    const polygonCoords: [number, number][] = [
      [sourceLon, sourceLat],
      ...leftCoords,
      ...rightCoords.reverse(),
      [sourceLon, sourceLat],
    ];

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoords],
      },
      properties: {
        severity: zone.severity,
        riskLevel: zone.severity.toUpperCase(),
        distanceKm: Number((zoneLength / 1000).toFixed(2)),
        widthMeters: Math.round(maxPlumeWidthMeters),
        zoneName: zone.name,
      },
    });
  });

  const areaSqKm = Number(((totalLengthMeters * (maxPlumeWidthMeters / 2) * Math.PI) / 2000000).toFixed(2));

  return {
    featureCollection: {
      type: 'FeatureCollection',
      features,
    },
    telemetry: {
      status: 'ACTIVE',
      statusMessage: `Active Gaussian dispersion footprint · ${features.length} concentration isolines`,
      windSpeed,
      windDirection,
      downwindHeading,
      stability,
      plumeLengthKm: Number((totalLengthMeters / 1000).toFixed(2)),
      maxWidthMeters: Math.round(maxPlumeWidthMeters),
      areaSqKm,
      sourceFireId: sourceId,
      sourceFireName: sourceName,
      sourceSeverity: severity,
    },
  };
}
