/**
 * @module environmental/forest/deforestation/deforestationDetection
 * @description Rapid deforestation alert detection, sudden canopy loss detection, and patch fragmentation.
 */

import { computeGeodesicPolygonAreaKm2 } from '../change/forestChangeDetection.js';
import { clampIndex } from '../vegetation/vegetationIndices.js';

/**
 * Detect sudden deforestation event within a monitored polygon.
 */
export function detectSuddenDeforestation({
  coordinates = [],
  t1Ndvi = 0.70,
  t2Ndvi = 0.35,
  confidence = 90,
} = {}) {
  const deltaNdvi = clampIndex(t2Ndvi - t1Ndvi);
  const totalAreaKm2 = computeGeodesicPolygonAreaKm2(coordinates);
  const isLoss = deltaNdvi <= -0.20;

  return {
    is_deforestation_event: isLoss,
    delta_ndvi: deltaNdvi,
    polygon_area_km2: totalAreaKm2,
    confidence_score: confidence,
    alert_level: deltaNdvi <= -0.30 ? 'CRITICAL' : isLoss ? 'HIGH' : 'LOW',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Compute forest patch shape complexity / fragmentation index: P / (2 * sqrt(pi * A)).
 */
export function computePatchFragmentation(areaKm2, perimeterKm) {
  if (areaKm2 <= 0 || perimeterKm <= 0) return 1.0;
  const circularPerimeter = 2 * Math.sqrt(Math.PI * areaKm2);
  return Math.round((perimeterKm / circularPerimeter) * 100) / 100;
}
