/**
 * @module core/provenance
 * @description Standardized data provenance metadata model.
 * Provides explicit tracking of data sources, processing history, quality tiers, and scientific limitations.
 */

export const SOURCE_TYPES = Object.freeze({
  REAL_LIVE: 'REAL_LIVE',             // Live API feed polled or streamed in real time
  REAL_STATIC: 'REAL_STATIC',         // Verified historical or reference dataset
  SIMULATED: 'SIMULATED',             // Calibrated mathematical simulation
  RULE_BASED: 'RULE_BASED',           // Deterministic expert heuristic
  EXPERIMENTAL: 'EXPERIMENTAL',       // Prototype algorithm
});

/**
 * Creates a standardized data provenance metadata object.
 *
 * @param {object} options
 * @param {string} options.source - Upstream provider name (e.g., 'NASA FIRMS', 'USGS', 'Open-Meteo')
 * @param {string} options.sourceType - One of SOURCE_TYPES
 * @param {string} [options.observedAt] - ISO timestamp of sensor observation
 * @param {string[]} [options.processing=[]] - Transformation pipeline steps applied
 * @param {string} [options.confidenceType='SOURCE_REPORTED'] - Basis of confidence score
 * @param {string[]} [options.limitations=[]] - Explicit scientific boundaries and caveats
 * @returns {object} Standardized Provenance Metadata
 */
export function createDataProvenance({
  source,
  sourceType = SOURCE_TYPES.REAL_LIVE,
  observedAt = new Date().toISOString(),
  processing = [],
  confidenceType = 'SOURCE_REPORTED',
  limitations = [],
} = {}) {
  return {
    source,
    source_type: sourceType,
    observed_at: observedAt,
    processed_at: new Date().toISOString(),
    processing_pipeline: processing,
    confidence_basis: confidenceType,
    scientific_limitations: limitations,
  };
}
