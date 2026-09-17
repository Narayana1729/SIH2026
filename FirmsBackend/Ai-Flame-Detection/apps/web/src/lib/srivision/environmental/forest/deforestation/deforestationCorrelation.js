/**
 * @module environmental/forest/deforestation/deforestationCorrelation
 * @description Correlates observed forest loss polygons with infrastructure, agricultural frontiers, and access corridors.
 */

import { haversineDistanceKm } from '../../../core/geospatial.js';
import { createDataProvenance } from '../../../core/provenance.js';

/**
 * Correlates detected forest loss points with nearest access roads and agricultural clearings.
 */
export function correlateDeforestationWithEncroachment({
  clearedPoints = [],
  infrastructurePoints = [],
  maxDistanceKm = 10,
} = {}) {
  const correlations = [];

  for (const cp of clearedPoints) {
    let nearestInfra = null;
    let minDistance = Number.POSITIVE_INFINITY;

    for (const ip of infrastructurePoints) {
      const dist = haversineDistanceKm(cp.lat, cp.lon, ip.lat, ip.lon);
      if (dist < minDistance) {
        minDistance = dist;
        nearestInfra = ip;
      }
    }

    const isEncroachment = minDistance <= maxDistanceKm;

    correlations.push({
      cleared_point: cp,
      nearest_infrastructure: nearestInfra,
      distance_km: Number.isFinite(minDistance) ? Math.round(minDistance * 100) / 100 : null,
      suspected_driver: isEncroachment ? (nearestInfra?.type || 'ROAD_OR_AGRICULTURAL_EXPANSION') : 'INTERIOR_DISTURBANCE',
      spatial_confidence: isEncroachment ? 'HIGH' : 'MODERATE',
    });
  }

  return {
    correlation_count: correlations.length,
    correlations,
    provenance: createDataProvenance({
      source: 'sriVision Deforestation Encroachment Spatial Engine',
      sourceType: 'SPATIAL_JOIN',
      confidenceBasis: 'PROXIMITY_HEURISTIC',
      limitations: [
        'Proximity correlation does not establish legal causality without ground verification.',
      ],
    }),
  };
}
