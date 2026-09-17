/**
 * @module layers/layerManager
 * @description Central Hazard Layer Orchestrator and Entity Picker for sriVision.
 */

import * as Cesium from 'cesium';
import { eventBus, SRI_EVENTS } from '../core/eventBus.js';

export class HazardLayerManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.layers = new Map();
    this.selectedHazard = null;
    this._listeners = new Set();
    this._screenSpaceHandler = null;

    this._setupEntityPicking();
  }

  registerLayer(layer) {
    if (!layer || !layer.id) throw new Error('Invalid layer passed to registerLayer');
    this.layers.set(layer.id, layer);
    void layer.initialize(this.viewer, this);
    return layer;
  }

  getLayer(id) {
    return this.layers.get(id);
  }

  getAllLayers() {
    return Array.from(this.layers.values());
  }

  async loadAll() {
    const promises = Array.from(this.layers.values()).map(async (l) => {
      try {
        await l.load();
      } catch (err) {
        console.warn(`[LayerManager] Error loading layer ${l.id}:`, err);
      }
    });
    await Promise.all(promises);

    // Collect all loaded hazard records and publish to event bus
    const allHazards = [];
    for (const layer of this.layers.values()) {
      if (layer.hotspots) allHazards.push(...layer.hotspots.map((r) => r.hazardContract || { hazard_type: 'WILDFIRE', location: { latitude: r.latitude, longitude: r.longitude } }));
      if (layer.facilities) allHazards.push(...layer.facilities.map((f) => ({ hazard_type: 'INDUSTRIAL_HAZMAT', title: f.properties?.name || 'Facility', location: { latitude: f.geometry?.coordinates?.[1], longitude: f.geometry?.coordinates?.[0] } })));
    }
    eventBus.emit(SRI_EVENTS.HAZARDS_REFRESHED, allHazards);
  }

  toggleLayer(id, visible) {
    const layer = this.layers.get(id);
    if (!layer) return;
    if (visible === undefined) visible = !layer.visible;
    if (visible) layer.show();
    else layer.hide();
    this._notifyStateChange(layer);
  }

  onHazardSelected(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  notifyHazardSelected(hazardContract) {
    this.selectedHazard = hazardContract;
    for (const listener of this._listeners) {
      try { listener(hazardContract); } catch (e) { console.error('[LayerManager] Listener error:', e); }
    }
    eventBus.emit(SRI_EVENTS.HAZARD_SELECTED, hazardContract);
  }

  _notifyStateChange(layer) {
    eventBus.emit(SRI_EVENTS.LAYER_VISIBILITY_CHANGED, {
      layerId: layer?.id,
      visible: layer?.visible,
      layers: this.getAllLayers().map((l) => ({ id: l.id, name: l.name, visible: l.visible })),
    });
  }

  _setupEntityPicking() {
    if (!this.viewer || this.viewer.isDestroyed()) return;

    this._screenSpaceHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this._screenSpaceHandler.setInputAction((click) => {
      let pickedObject = this.viewer.scene.pick(click.position);
      let entity = pickedObject?.id;
      if (!entity?._sriHazardContract && this.viewer.scene.drillPick) {
        const drilled = this.viewer.scene.drillPick(click.position, 10);
        for (const p of drilled) {
          if (p?.id?._sriHazardContract) {
            entity = p.id;
            break;
          }
        }
      }
      if (entity && entity._sriHazardContract) {
        this.notifyHazardSelected(entity._sriHazardContract);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  destroy() {
    if (this._screenSpaceHandler) {
      this._screenSpaceHandler.destroy();
      this._screenSpaceHandler = null;
    }
    for (const layer of this.layers.values()) {
      try { layer.destroy(); } catch (e) {}
    }
    this.layers.clear();
    this._listeners.clear();
  }
}
