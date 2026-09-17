/**
 * @module core/risk
 * @description Visual styling tokens, Cesium Color mappings, classification badges, and formatters for sriVision.
 */

import * as Cesium from 'cesium';
import { SEVERITY_LEVELS, DATA_CLASSIFICATIONS, HAZARD_TYPES } from './hazardContract.js';

export const SEVERITY_COLORS = Object.freeze({
  [SEVERITY_LEVELS.CRITICAL]: {
    hex: '#ff3344',
    rgb: [255, 51, 68],
    cesium: Cesium.Color.fromCssColorString('#ff3344'),
    cesiumAlpha: (alpha = 0.35) => Cesium.Color.fromCssColorString('#ff3344').withAlpha(alpha),
    badgeClass: 'badge-critical',
    label: 'CRITICAL',
  },
  [SEVERITY_LEVELS.HIGH]: {
    hex: '#ff8800',
    rgb: [255, 136, 0],
    cesium: Cesium.Color.fromCssColorString('#ff8800'),
    cesiumAlpha: (alpha = 0.35) => Cesium.Color.fromCssColorString('#ff8800').withAlpha(alpha),
    badgeClass: 'badge-high',
    label: 'HIGH WARNING',
  },
  [SEVERITY_LEVELS.MODERATE]: {
    hex: '#ffcc00',
    rgb: [255, 204, 0],
    cesium: Cesium.Color.fromCssColorString('#ffcc00'),
    cesiumAlpha: (alpha = 0.35) => Cesium.Color.fromCssColorString('#ffcc00').withAlpha(alpha),
    badgeClass: 'badge-moderate',
    label: 'MODERATE WATCH',
  },
  [SEVERITY_LEVELS.LOW]: {
    hex: '#00cc88',
    rgb: [0, 204, 136],
    cesium: Cesium.Color.fromCssColorString('#00cc88'),
    cesiumAlpha: (alpha = 0.35) => Cesium.Color.fromCssColorString('#00cc88').withAlpha(alpha),
    badgeClass: 'badge-low',
    label: 'ROUTINE MONITOR',
  },
});

export const CLASSIFICATION_TAGS = Object.freeze({
  [DATA_CLASSIFICATIONS.OBSERVED]: {
    label: 'OBSERVED',
    desc: 'Real-time sensor/satellite telemetry observation',
    bg: '#0066cc',
    text: '#ffffff',
  },
  [DATA_CLASSIFICATIONS.ESTIMATED]: {
    label: 'ESTIMATED',
    desc: 'Input-based mathematical risk indicator',
    bg: '#8844cc',
    text: '#ffffff',
  },
  [DATA_CLASSIFICATIONS.SIMULATED]: {
    label: 'SIMULATED',
    desc: 'Physical equation dynamic propagation simulation',
    bg: '#cc6600',
    text: '#ffffff',
  },
});

export const HAZARD_ICONS = Object.freeze({
  [HAZARD_TYPES.WILDFIRE]: '🔥',
  [HAZARD_TYPES.INDUSTRIAL_HAZMAT]: '🏭',
  [HAZARD_TYPES.CHEMICAL_PLUME]: '☁️',
  [HAZARD_TYPES.LANDSLIDE]: '🏔️',
  [HAZARD_TYPES.FLASH_FLOOD]: '🌊',
  [HAZARD_TYPES.EARTHQUAKE]: '⚡',
  [HAZARD_TYPES.DEFORESTATION]: '🌳',
});

/**
 * Returns the Cesium Color for a given severity level.
 */
export function getSeverityCesiumColor(severity, alpha = 1.0) {
  const conf = SEVERITY_COLORS[severity] || SEVERITY_COLORS[SEVERITY_LEVELS.MODERATE];
  return conf.cesium.withAlpha(alpha);
}
