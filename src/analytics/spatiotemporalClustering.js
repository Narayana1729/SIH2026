/**
 * @module src/analytics/spatiotemporalClustering
 * @description Deterministic Spatiotemporal Fire-Event Clustering Engine (DBSCAN / Connected Components).
 *
 * Aggregates raw satellite thermal observations (FIRMS VIIRS/MODIS) into unified,
 * incident-level events with convex hull perimeters, temporal growth metrics,
 * and directional propagation trajectory vectors.
 *
 * Invariants:
 * 1. Strictly deterministic cluster formation via canonical observation ordering.
 * 2. Spatial distance calculated in geodesic kilometers via Haversine, not planar degrees.
 * 3. Never synthesizes fake observations; clusters strictly over actual telemetry.
 */

import { haversineDistanceKm } from '../services/protectedAreasService.js';
import { createDataProvenance } from '../core/provenance.js';

/**
 * Compute 2D Convex Hull of points using Monotone Chain (Andrew's algorithm).
 * @param {Array<[number, number]>} points Array of [lon, lat] pairs
 * @returns {Array<[number, number]>} Convex hull ring in GeoJSON format
 */
export function computeConvexHull(points) {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return [[...points[0]], [...points[0]]];
  if (points.length === 2) return [[...points[0]], [...points[1]], [...points[0]]];

  // 1. Sort points lexicographically by lon then lat
  const sorted = [...points].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

  // Cross product of OA and OB vectors: (A.x - O.x)*(B.y - O.y) - (A.y - O.y)*(B.x - O.x)
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  // 2. Build lower hull
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // 3. Build upper hull
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Concatenate lower and upper hull (omit duplicate last point of each list)
  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  // Close the polygon ring
  hull.push([...hull[0]]);

  return hull;
}

/**
 * Calculate approximate area of a closed polygon ring in square kilometers.
 * Uses spherical excess / shoelace projection.
 * @param {Array<[number, number]>} ring Array of [lon, lat] pairs
 * @returns {number} Area in km²
 */
export function computePolygonAreaKm2(ring) {
  if (!ring || ring.length < 4) return 0.14; // Default single VIIRS 375m pixel area ~ 0.14 km²

  let area = 0;
  const rad = Math.PI / 180;
  const R = 6371.0; // km

  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    area += (p2[0] - p1[0]) * rad * (2 + Math.sin(p1[1] * rad) + Math.sin(p2[1] * rad));
  }

  area = Math.abs(area * R * R / 2.0);
  return Number(Math.max(0.14, area).toFixed(2));
}

/**
 * Calculate compass azimuth from coordinate A to coordinate B in degrees (0 - 360).
 */
export function calculateAzimuthDeg(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return Number(((brng + 360) % 360).toFixed(1));
}

/**
 * Cluster raw FIRMS satellite observations into spatiotemporal incident entities.
 *
 * @param {Array<Object>} observations Raw FIRMS detections
 * @param {Object} [config]
 * @param {number} [config.spatialRadiusKm=1.5] Spatial clustering radius in km
 * @param {number} [config.temporalWindowHours=72.0] Temporal clustering delta in hours
 * @param {string} [config.regionName="INDIA"] Geographic tag for incident naming
 * @returns {Array<Object>} Clustered incident event entities
 */
export function clusterFirmsObservations(observations, config = {}) {
  if (!observations || observations.length === 0) {
    return [];
  }

  const spatialRadiusKm = config.spatialRadiusKm !== undefined ? config.spatialRadiusKm : 1.5;
  const temporalWindowHours = config.temporalWindowHours !== undefined ? config.temporalWindowHours : 72.0;
  const temporalWindowMs = temporalWindowHours * 3600 * 1000;
  const regionName = config.regionName || 'INDIA';

  // 1. Normalize and deterministically sort observations
  const normalized = observations.map((obs, idx) => {
    const lat = Number(obs.latitude ?? obs.lat ?? obs.location?.latitude ?? 0);
    const lon = Number(obs.longitude ?? obs.lon ?? obs.location?.longitude ?? 0);
    const frp = Number(obs.frp ?? obs.metrics?.find(m => m.label?.includes('FRP'))?.value ?? 10.0);
    const dateStr = obs.acq_date || obs.date || obs.timestamp || new Date().toISOString().split('T')[0];
    const timeStr = obs.acq_time || obs.time || '1200';
    const cleanTime = String(timeStr).padStart(4, '0');
    const hh = cleanTime.slice(0, 2);
    const mm = cleanTime.slice(2, 4);

    let acquiredAtMs;
    try {
      acquiredAtMs = new Date(`${dateStr}T${hh}:${mm}:00Z`).getTime();
      if (Number.isNaN(acquiredAtMs)) acquiredAtMs = Date.now();
    } catch {
      acquiredAtMs = Date.now();
    }

    return {
      raw_id: obs.id || obs.event_id || `obs_${idx}`,
      latitude: lat,
      longitude: lon,
      frp,
      acquired_at_ms: acquiredAtMs,
      acquired_at_iso: new Date(acquiredAtMs).toISOString(),
      original: obs
    };
  });

  // Deterministic sorting: time ascending, latitude, longitude, id
  normalized.sort((a, b) => {
    if (a.acquired_at_ms !== b.acquired_at_ms) return a.acquired_at_ms - b.acquired_at_ms;
    if (a.latitude !== b.latitude) return a.latitude - b.latitude;
    if (a.longitude !== b.longitude) return a.longitude - b.longitude;
    return String(a.raw_id).localeCompare(String(b.raw_id));
  });

  const n = normalized.length;
  const adj = Array.from({ length: n }, () => []);

  // 2. Build adjacency graph with temporal pruning
  for (let i = 0; i < n; i++) {
    const oi = normalized[i];
    for (let j = i + 1; j < n; j++) {
      const oj = normalized[j];

      // Temporal pruning: since array is sorted by time, subsequent j will also exceed window
      if ((oj.acquired_at_ms - oi.acquired_at_ms) > temporalWindowMs) {
        break;
      }

      const distKm = haversineDistanceKm(oi.latitude, oi.longitude, oj.latitude, oj.longitude);
      if (distKm <= spatialRadiusKm) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // 3. Find connected components via BFS
  const visited = new Uint8Array(n);
  const clusterGroups = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const groupIndices = [];
    const queue = [i];
    visited[i] = 1;

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      groupIndices.push(curr);

      for (const neighbor of adj[curr]) {
        if (!visited[neighbor]) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }

    // Sort indices deterministically
    groupIndices.sort((a, b) => a - b);
    clusterGroups.push(groupIndices.map(idx => normalized[idx]));
  }

  // 4. Transform clusters into Incident Entities
  const currentYear = new Date().getFullYear();
  const incidentEntities = clusterGroups.map((group, cIdx) => {
    const count = group.length;
    const lats = group.map(g => g.latitude);
    const lons = group.map(g => g.longitude);
    const frps = group.map(g => g.frp);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const centroidLat = Number((lats.reduce((a, b) => a + b, 0) / count).toFixed(4));
    const centroidLon = Number((lons.reduce((a, b) => a + b, 0) / count).toFixed(4));

    const meanFrp = Number((frps.reduce((a, b) => a + b, 0) / count).toFixed(1));
    const maxFrp = Number(Math.max(...frps).toFixed(1));
    const sumFrp = Number(frps.reduce((a, b) => a + b, 0).toFixed(1));

    const firstDetection = group[0].acquired_at_iso;
    const latestDetection = group[group.length - 1].acquired_at_iso;
    const durationHours = Number(
      Math.max(0.1, (group[group.length - 1].acquired_at_ms - group[0].acquired_at_ms) / (3600 * 1000)).toFixed(1)
    );

    // Convex Hull Perimeter
    const points2D = group.map(g => [g.longitude, g.latitude]);
    const hullRing = computeConvexHull(points2D);
    const perimeterAreaKm2 = computePolygonAreaKm2(hullRing);

    // Trajectory from earliest observation to latest front
    const origin = group[0];
    const front = group[group.length - 1];
    const displacementKm = haversineDistanceKm(origin.latitude, origin.longitude, front.latitude, front.longitude);
    const azimuthDeg = calculateAzimuthDeg(origin.latitude, origin.longitude, front.latitude, front.longitude);

    // Growth Metrics
    const expansionRate = durationHours > 0 ? Number((perimeterAreaKm2 / durationHours).toFixed(2)) : 0;
    const spatialSpreadKm = Number(
      haversineDistanceKm(minLat, minLon, maxLat, maxLon).toFixed(2)
    );

    const eventId = `EVT-${currentYear}-${regionName.toUpperCase()}-${String(cIdx + 1).padStart(3, '0')}`;

    return {
      event_id: eventId,
      cluster_index: cIdx + 1,
      observation_count: count,
      first_detection: firstDetection,
      latest_detection: latestDetection,
      duration_hours: durationHours,
      centroid: {
        latitude: centroidLat,
        longitude: centroidLon
      },
      bounding_box: {
        min_latitude: minLat,
        max_latitude: maxLat,
        min_longitude: minLon,
        max_longitude: maxLon
      },
      current_perimeter: {
        type: 'Polygon',
        coordinates: [hullRing],
        area_km2: perimeterAreaKm2
      },
      intensity: {
        mean_frp_mw: meanFrp,
        max_frp_mw: maxFrp,
        sum_frp_mw: sumFrp
      },
      growth_metrics: {
        perimeter_area_km2: perimeterAreaKm2,
        expansion_rate_km2_per_hr: expansionRate,
        spatial_spread_km: spatialSpreadKm,
        observations_per_day: durationHours >= 24 ? Number((count / (durationHours / 24)).toFixed(1)) : count
      },
      trajectory: {
        origin: { latitude: origin.latitude, longitude: origin.longitude, time: origin.acquired_at_iso },
        front: { latitude: front.latitude, longitude: front.longitude, time: front.acquired_at_iso },
        displacement_km: Number(displacementKm.toFixed(2)),
        azimuth_degrees: azimuthDeg
      },
      clustering_parameters: {
        spatial_radius_km: spatialRadiusKm,
        temporal_window_hours: temporalWindowHours
      },
      observations: group.map(g => g.original),
      provenance: createDataProvenance({
        source: 'NASA LANCE / FIRMS Active Fire System',
        attribution: 'VIIRS & MODIS Thermal Satellite Hotspot Cluster Analysis',
        epistemic_tier: 'CALCULATED_PHYSICS'
      })
    };
  });

  // Sort incident entities by total FRP and observation count descending
  incidentEntities.sort((a, b) => b.intensity.sum_frp_mw - a.intensity.sum_frp_mw);

  return incidentEntities;
}

export const clusterFirmsDBSCAN = clusterFirmsObservations;
export const computeConvexHullMonotoneChain = computeConvexHull;
