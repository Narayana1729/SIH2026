/**
 * @module environmental/forest/change/canopyAnalysis
 * @description Fine-grained forest canopy density, closure metrics, and spectral degradation analysis.
 */

import { clampIndex } from '../vegetation/vegetationIndices.js';

/**
 * Compute canopy density distribution from an array of pixel NDVI values.
 * @param {Array<number>} ndviArray 
 * @param {number} [forestThreshold=0.40] 
 * @returns {Object}
 */
export function computeCanopyDensity(ndviArray = [], forestThreshold = 0.40) {
  if (!Array.isArray(ndviArray) || ndviArray.length === 0) {
    return {
      sample_count: 0,
      mean_ndvi: 0,
      canopy_cover_percent: 0,
      dense_canopy_percent: 0,
      degraded_percent: 0,
    };
  }

  let sum = 0;
  let forestPixels = 0;
  let densePixels = 0;
  let degradedPixels = 0;

  for (const raw of ndviArray) {
    const val = clampIndex(raw);
    sum += val;
    if (val >= forestThreshold) forestPixels++;
    if (val >= 0.60) densePixels++;
    if (val < 0.20) degradedPixels++;
  }

  const n = ndviArray.length;
  const meanNdvi = Math.round((sum / n) * 10000) / 10000;
  const canopyCoverPercent = Math.round((forestPixels / n) * 10000) / 100;
  const denseCanopyPercent = Math.round((densePixels / n) * 10000) / 100;
  const degradedPercent = Math.round((degradedPixels / n) * 10000) / 100;

  return {
    sample_count: n,
    mean_ndvi: meanNdvi,
    canopy_cover_percent: canopyCoverPercent,
    dense_canopy_percent: denseCanopyPercent,
    degraded_percent: degradedPercent,
  };
}

/**
 * Classify overall canopy health status from baseline and current density metrics.
 */
export function classifyCanopyHealth(baselineDensity, currentDensity) {
  const baseCover = baselineDensity?.canopy_cover_percent || 0;
  const currCover = currentDensity?.canopy_cover_percent || 0;
  const diff = Math.round((currCover - baseCover) * 100) / 100;

  let healthStatus = 'STABLE';
  if (diff <= -15.0) healthStatus = 'SEVERE_LOSS';
  else if (diff <= -5.0) healthStatus = 'MODERATE_LOSS';
  else if (diff >= 5.0) healthStatus = 'CANOPY_GROWTH';

  return {
    baseline_cover_percent: baseCover,
    current_cover_percent: currCover,
    cover_difference_percent: diff,
    health_status: healthStatus,
  };
}
