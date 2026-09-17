/**
 * @module environmental/forest/vegetation/vegetationIndices
 * @description Standardized multispectral vegetation indices (NDVI, NDMI, NBR, EVI, SAVI).
 * Implements rigorous divide-by-zero guards, NaN safeguards, and spectral clamping.
 */

export function clampIndex(value) {
  if (!Number.isFinite(value)) return 0;
  if (value > 1.0) return 1.0;
  if (value < -1.0) return -1.0;
  return Math.round(value * 10000) / 10000;
}

export function isValidBand(val) {
  return val !== null && val !== undefined && typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

/**
 * Computes Normalized Difference Vegetation Index (NDVI).
 * Formula: (NIR - RED) / (NIR + RED)
 */
export function computeNdvi(nir, red) {
  if (!isValidBand(nir) || !isValidBand(red)) return 0;
  const denominator = nir + red;
  if (denominator <= 1e-6) return 0;
  return clampIndex((nir - red) / denominator);
}

/**
 * Computes Normalized Difference Moisture Index (NDMI).
 * Formula: (NIR - SWIR1) / (NIR + SWIR1)
 */
export function computeNdmi(nir, swir1) {
  if (!isValidBand(nir) || !isValidBand(swir1)) return 0;
  const denominator = nir + swir1;
  if (denominator <= 1e-6) return 0;
  return clampIndex((nir - swir1) / denominator);
}

/**
 * Computes Normalized Burn Ratio (NBR).
 * Formula: (NIR - SWIR2) / (NIR + SWIR2)
 */
export function computeNbr(nir, swir2) {
  if (!isValidBand(nir) || !isValidBand(swir2)) return 0;
  const denominator = nir + swir2;
  if (denominator <= 1e-6) return 0;
  return clampIndex((nir - swir2) / denominator);
}

/**
 * Enhanced Vegetation Index (EVI).
 * Formula: 2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1)
 */
export function computeEvi(nir, red, blue) {
  if (!isValidBand(nir) || !isValidBand(red) || !isValidBand(blue)) return 0;
  const denominator = nir + 6 * red - 7.5 * blue + 1.0;
  if (Math.abs(denominator) <= 1e-6) return 0;
  return clampIndex((2.5 * (nir - red)) / denominator);
}

/**
 * Soil-Adjusted Vegetation Index (SAVI).
 * Formula: ((NIR - RED) / (NIR + RED + L)) * (1 + L)
 */
export function computeSavi(nir, red, l = 0.5) {
  if (!isValidBand(nir) || !isValidBand(red)) return 0;
  const denominator = nir + red + l;
  if (Math.abs(denominator) <= 1e-6) return 0;
  return clampIndex(((nir - red) / denominator) * (1 + l));
}

// Aliases
export const calculateNDVI = computeNdvi;
export const calculateNDMI = computeNdmi;
export const calculateNBR = computeNbr;
