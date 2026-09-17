/**
 * Centralized Z-Index system for PYROSAT UI
 * Enforces predictable stacking and prevents arbitrary z-index conflicts
 */
export const Z_INDEX = {
  map: 0,
  mapMarkers: 10,
  mapControls: 20,
  overlays: 100,
  activeOverlay: 200,
  modal: 500,
  notification: 600,
} as const;
