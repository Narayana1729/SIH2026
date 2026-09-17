/**
 * @module core/state
 * @description Central reactive pub/sub store for sriVision active layers, selection, and alerts.
 */

class StateStore {
  constructor() {
    this.layers = {
      wildfire: true,
      earthquakes: true,
      weather: true,
      forest: true,
      satellites: true,
    };
    this.selectedIncident = null;
    this.activeAlerts = [];
    this.cameraPosition = { lat: 20.0, lon: 0.0, altitudeM: 15000000 };
    this.listeners = new Set();
  }

  getLayerState(key) {
    return this.layers[key] ?? false;
  }

  setLayerState(key, enabled) {
    this.layers[key] = Boolean(enabled);
    this.emit('layerChange', { key, enabled: this.layers[key] });
  }

  toggleLayer(key) {
    this.setLayerState(key, !this.getLayerState(key));
  }

  setSelectedIncident(incident) {
    this.selectedIncident = incident;
    this.emit('incidentSelect', incident);
  }

  setAlerts(alerts = []) {
    this.activeAlerts = alerts;
    this.emit('alertsUpdate', alerts);
  }

  setCameraPosition(pos) {
    this.cameraPosition = { ...this.cameraPosition, ...pos };
    this.emit('cameraMove', this.cameraPosition);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('[sriVision state listener error]', err);
      }
    }
  }
}

export const appState = new StateStore();
