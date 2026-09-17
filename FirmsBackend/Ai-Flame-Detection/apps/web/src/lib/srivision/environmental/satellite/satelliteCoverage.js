/**
 * @module environmental/satellite/satelliteCoverage
 * @description Computes approximate observation geometry and orbital footprint bounds for Earth-Observation satellites.
 * Explicitly labeled as APPROXIMATE OBSERVATION GEOMETRY (without claiming exact sensor instrument swath physics).
 */

import { haversineDistanceKm } from '../forest/forestFireCorrelation.js';
import { createDataProvenance, SOURCE_TYPES } from '../../core/provenance.js';

export function computeObservationGeometry({
  satelliteLat = 0,
  satelliteLon = 0,
  satelliteAltitudeKm = 700,
  approxSwathKm = 290, // Typical Sentinel-2 swath width
  targetLat = 0,
  targetLon = 0,
} = {}) {
  const groundDistanceKm = haversineDistanceKm(satelliteLat, satelliteLon, targetLat, targetLon);
  const isWithinApproxFootprint = groundDistanceKm <= (approxSwathKm / 2);

  // Elevation angle from target to satellite (rough spherical geometry)
  const earthRadiusKm = 6371.0;
  const centralAngleRad = groundDistanceKm / earthRadiusKm;
  const elevationDeg = Math.max(0, Math.round(
    (Math.atan2(
      Math.cos(centralAngleRad) - (earthRadiusKm / (earthRadiusKm + satelliteAltitudeKm)),
      Math.sin(centralAngleRad)
    ) * (180 / Math.PI)) * 10
  ) / 10);

  return {
    geometry_type: 'APPROXIMATE_OBSERVATION_GEOMETRY',
    sub_satellite_point: { lat: satelliteLat, lon: satelliteLon, altitude_km: satelliteAltitudeKm },
    target_point: { lat: targetLat, lon: targetLon },
    ground_distance_km: groundDistanceKm,
    approx_swath_km: approxSwathKm,
    is_within_approx_footprint: isWithinApproxFootprint,
    approx_elevation_angle_deg: elevationDeg,
    provenance: createDataProvenance({
      source: 'sriVision Orbital Geometry Estimator',
      sourceType: SOURCE_TYPES.RULE_BASED,
      processing: ['sgp4_subsatellite_projection', 'approximate_swath_geometric_intersection'],
      confidenceType: 'GEOMETRIC_APPROXIMATION',
      limitations: [
        'Footprint represents an idealized geometric circle/swath along sub-satellite track.',
        'Actual sensor line-of-sight, off-nadir tilt angles, and scan optics are approximated.',
      ],
    }),
  };
}
