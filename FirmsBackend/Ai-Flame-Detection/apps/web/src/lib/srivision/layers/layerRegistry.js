/**
 * @module layers/layerRegistry
 * @description Layer Lifecycle Contract and Registry for sriVision.
 * Prevents Cesium memory/event leaks by enforcing explicit initialize, load, render, show, hide, and destroy hooks.
 */

export class BaseHazardLayer {
  constructor(options = {}) {
    this.id = options.id || 'unnamed-layer';
    this.name = options.name || 'Unnamed Layer';
    this.icon = options.icon || '📍';
    this.type = options.type || 'HAZARD';
    this.visible = options.visible !== false;

    this.viewer = null;
    this.layerManager = null;
    this.dataSource = null;
    this._initialized = false;
    this._loaded = false;
    this._disposables = [];
  }

  async initialize(viewer, layerManager) {
    if (this._initialized) return;
    this.viewer = viewer;
    this.layerManager = layerManager;
    this._initialized = true;
  }

  async load() {
    this._loaded = true;
  }

  render() {}

  update() {}

  show() {
    this.visible = true;
    if (this.dataSource) this.dataSource.show = true;
  }

  hide() {
    this.visible = false;
    if (this.dataSource) this.dataSource.show = false;
  }

  destroy() {
    this.hide();
    for (const dispose of this._disposables) {
      try { dispose(); } catch (e) { console.warn(`[${this.id}] Dispose error:`, e); }
    }
    this._disposables = [];
    if (this.dataSource && this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.dataSources.remove(this.dataSource, true);
    }
    this.dataSource = null;
    this._initialized = false;
    this._loaded = false;
  }

  onSelect(hazardContract) {
    if (this.layerManager) {
      this.layerManager.notifyHazardSelected(hazardContract);
    }
  }

  registerDisposable(fn) {
    if (typeof fn === 'function') this._disposables.push(fn);
  }
}
