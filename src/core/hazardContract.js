/**
 * @module core/hazardContract
 * @description Universal Standard Hazard Contract for sriVision.
 * Normalizes disparate hazard telemetry (wildfires, industrial releases, landslides, floods, seismic events)
 * into a single canonical data structure consumed by Cesium layer renderers, the Hazard Inspector,
 * Alert Priority Queues, and the Tactical Incident Dossier.
 */

export const HAZARD_TYPES = Object.freeze({
  WILDFIRE: 'WILDFIRE',
  INDUSTRIAL_HAZMAT: 'INDUSTRIAL_HAZMAT',
  CHEMICAL_PLUME: 'CHEMICAL_PLUME',
  LANDSLIDE: 'LANDSLIDE',
  FLASH_FLOOD: 'FLASH_FLOOD',
  EARTHQUAKE: 'EARTHQUAKE',
  DEFORESTATION: 'DEFORESTATION',
});

export const DATA_CLASSIFICATIONS = Object.freeze({
  OBSERVED: 'OBSERVED',     // Direct satellite or sensor observation (e.g. NASA FIRMS, USGS)
  ESTIMATED: 'ESTIMATED',   // Heuristic risk score or indicator (e.g. Factor of Safety, Susceptibility)
  SIMULATED: 'SIMULATED',   // Calibrated physical propagation simulation (e.g. Rothermel ROS, Gaussian Plume)
});

export const SEVERITY_LEVELS = Object.freeze({
  CRITICAL: 'CRITICAL',     // Immediate life/infrastructure threat, active evacuation
  HIGH: 'HIGH',             // Severe condition, stage resources & warn
  MODERATE: 'MODERATE',     // Elevated condition, active monitoring
  LOW: 'LOW',               // Baseline / routine monitoring
});

/**
 * Creates a validated, standardized Hazard Object adhering to the common data contract.
 *
 * @param {Object} options
 * @param {string} options.id - Unique deterministic hazard identifier
 * @param {string} options.hazardType - One of HAZARD_TYPES
 * @param {string} options.title - Short descriptive title (e.g. "Chooralmala Slope Failure")
 * @param {string} options.subtitle - Secondary administrative or physical context
 * @param {string} options.dataClassification - One of DATA_CLASSIFICATIONS (OBSERVED, ESTIMATED, SIMULATED)
 * @param {string} options.severity - One of SEVERITY_LEVELS (CRITICAL, HIGH, MODERATE, LOW)
 * @param {Object} options.location - { latitude: number, longitude: number, elevationM?: number, locality?: string, district?: string, state?: string }
 * @param {Object} [options.geometry={}] - GeoJSON geometry (Point, Polygon, MultiPolygon) or Cesium geometry descriptor
 * @param {Array<Object>} [options.metrics=[]] - Key physical metrics [{ label, value, unit, status }]
 * @param {Array<Object>} [options.contributingFactors=[]] - Array of contributing risk factors
 * @param {Array<string>} [options.actions=[]] - Recommended tactical or evacuation directives
 * @param {Object} [options.simulation] - Optional simulation details (e.g. perimeters, isopleths, lead times)
 * @param {Object} [options.responders] - Optional emergency responders nearby
 * @param {Object} [options.provenance] - Standard data provenance metadata
 * @param {Object} [options.rawPayload] - Preserved upstream raw backend payload
 * @returns {Object} Normalized Hazard Contract instance
 */
export function createHazardContract({
  id,
  hazardType,
  title,
  subtitle = '',
  dataClassification = DATA_CLASSIFICATIONS.ESTIMATED,
  severity = SEVERITY_LEVELS.MODERATE,
  location = { latitude: 0, longitude: 0 },
  geometry = null,
  metrics = [],
  contributingFactors = [],
  actions = [],
  simulation = null,
  responders = null,
  provenance = null,
  rawPayload = null,
} = {}) {
  if (!id) throw new Error('createHazardContract: id is required');
  if (!hazardType || !HAZARD_TYPES[hazardType]) {
    throw new Error(`createHazardContract: invalid hazardType "${hazardType}"`);
  }

  return {
    id: String(id),
    hazard_type: hazardType,
    title: String(title || hazardType),
    subtitle: String(subtitle || ''),
    data_classification: dataClassification,
    severity: severity,
    timestamp: new Date().toISOString(),
    location: {
      latitude: Number(location.latitude) || 0,
      longitude: Number(location.longitude) || 0,
      elevation_m: location.elevationM ?? location.elevation_m ?? null,
      locality: location.locality || '',
      district: location.district || '',
      state: location.state || '',
    },
    geometry: geometry || {
      type: 'Point',
      coordinates: [Number(location.longitude) || 0, Number(location.latitude) || 0],
    },
    metrics: Array.isArray(metrics) ? metrics : [],
    contributing_factors: Array.isArray(contributingFactors) ? contributingFactors : [],
    actions: Array.isArray(actions) ? actions : [],
    simulation: simulation || null,
    responders: responders || null,
    provenance: provenance || null,
    raw_payload: rawPayload || null,
  };
}
