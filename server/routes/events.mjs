/**
 * @module server/routes/events
 * @description API route handler for Spatiotemporal Incident Clustering & Event Ingestion.
 */

import { clusterFirmsObservations } from '../../src/analytics/spatiotemporalClustering.js';
import { historicalFirmsStore } from '../services/historicalFirmsStore.mjs';
import { sendJson, sendError } from '../middleware/security.mjs';

export async function handleEventsRoute(req, res, url) {
  const pathname = url.pathname.replace(/^\/api\/v1\/firms\/clusters/, '');

  // 1. Cluster list: GET /api/v1/firms/clusters
  if (pathname === '' || pathname === '/') {
    const date = url.searchParams.get('date') || historicalFirmsStore.getAvailableDates().slice(-1)[0] || '2026-08-25';
    const spatialRadiusKm = Number(url.searchParams.get('spatial_radius_km') || 1.5);
    const temporalWindowHours = Number(url.searchParams.get('temporal_window_hours') || 72.0);
    const regionName = url.searchParams.get('region') || 'INDIA';

    // Retrieve real stored FIRMS observations
    const observations = historicalFirmsStore.getDetectionsByDate(date);

    const clusters = clusterFirmsObservations(observations, {
      spatialRadiusKm,
      temporalWindowHours,
      regionName
    });

    return sendJson(res, 200, {
      success: true,
      query: {
        date,
        spatial_radius_km: spatialRadiusKm,
        temporal_window_hours: temporalWindowHours,
        raw_observations_count: observations.length,
        incident_clusters_count: clusters.length
      },
      clusters
    }, { 'Cache-Control': 'public, max-age=120' }, req);
  }

  // 2. Cluster Detail: GET /api/v1/firms/clusters/:eventId
  const detailMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)$/);
  if (detailMatch) {
    const targetEventId = detailMatch[1];
    const date = url.searchParams.get('date') || historicalFirmsStore.getAvailableDates().slice(-1)[0] || '2026-08-25';
    const observations = historicalFirmsStore.getDetectionsByDate(date);
    const clusters = clusterFirmsObservations(observations);
    const found = clusters.find(c => c.event_id === targetEventId);

    if (!found) {
      return sendError(res, 404, 'EVENT_NOT_FOUND', `Incident cluster '${targetEventId}' not found for date ${date}.`, [], req);
    }

    return sendJson(res, 200, {
      success: true,
      data: found
    }, {}, req);
  }

  // 3. Cluster Timeline: GET /api/v1/firms/clusters/:eventId/timeline
  const timelineMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)\/timeline$/);
  if (timelineMatch) {
    const targetEventId = timelineMatch[1];
    const date = url.searchParams.get('date') || historicalFirmsStore.getAvailableDates().slice(-1)[0] || '2026-08-25';
    const observations = historicalFirmsStore.getDetectionsByDate(date);
    const clusters = clusterFirmsObservations(observations);
    const found = clusters.find(c => c.event_id === targetEventId);

    if (!found) {
      return sendError(res, 404, 'EVENT_NOT_FOUND', `Incident cluster '${targetEventId}' not found for date ${date}.`, [], req);
    }

    const timeline = found.observations.map(obs => ({
      detection_id: obs.id || obs.event_id,
      latitude: obs.latitude ?? obs.lat,
      longitude: obs.longitude ?? obs.lon,
      frp_mw: obs.frp ?? 10.0,
      timestamp: obs.acq_date ? `${obs.acq_date} ${obs.acq_time || '1200'}` : new Date().toISOString(),
      satellite: obs.satellite || 'VIIRS NOAA-20',
      confidence: obs.confidence || 'nominal'
    }));

    return sendJson(res, 200, {
      success: true,
      event_id: targetEventId,
      timeline_length: timeline.length,
      timeline
    }, {}, req);
  }

  return sendError(res, 404, 'ROUTE_NOT_FOUND', `Unknown clustering endpoint: ${pathname}`, [], req);
}
