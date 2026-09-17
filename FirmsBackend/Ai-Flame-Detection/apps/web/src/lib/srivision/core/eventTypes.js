/**
 * @module core/eventTypes
 * @description Standard Event Constants for the sriVision Event-Driven Architecture.
 */

export const SRI_EVENTS = Object.freeze({
  // Ingest & Telemetry Events
  HAZARD_INGESTED: 'srivision:hazard-ingested',
  HAZARDS_REFRESHED: 'srivision:hazards-refreshed',
  WEATHER_UPDATED: 'srivision:weather-updated',

  // Interactive & Selection Events
  HAZARD_SELECTED: 'srivision:hazard-selected',
  HAZARD_DESELECTED: 'srivision:hazard-deselected',
  TERRAIN_PROBE_CLICKED: 'srivision:terrain-probe-clicked',

  // Physical Simulation Lifecycle
  SIMULATION_REQUESTED: 'srivision:simulation-requested',
  SIMULATION_COMPLETED: 'srivision:simulation-completed',
  SIMULATION_FAILED: 'srivision:simulation-failed',

  // Alert & Incident Management
  ALERT_TRIGGERED: 'srivision:alert-triggered',
  ALERT_ESCALATED: 'srivision:alert-escalated',
  ALERT_RESOLVED: 'srivision:alert-resolved',

  // Tactical Actions
  DOSSIER_REQUESTED: 'srivision:dossier-requested',
  CAMERA_NAVIGATE: 'srivision:camera-navigate',
  LAYER_VISIBILITY_CHANGED: 'srivision:layer-visibility-changed',
});
