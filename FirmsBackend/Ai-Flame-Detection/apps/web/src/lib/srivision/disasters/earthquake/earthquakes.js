/**
 * @module disasters/earthquake/earthquakes
 * @description Renders USGS live earthquakes with magnitude-scaled concentric rings and depth color coding.
 */

import * as Cesium from 'cesium';

export class EarthquakeLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    this.events = [];
    this.visible = true;
  }

  async loadData() {
    try {
      const res = await fetch('/api/earthquakes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.setData(data.features || []);
    } catch (err) {
      console.warn('[sriVision Earthquakes] Error loading USGS data:', err);
    }
  }

  setData(features = []) {
    this.points.removeAll();
    this.events = features;

    for (const feat of features) {
      const coords = feat.geometry?.coordinates || [0, 0, 10];
      const lon = coords[0];
      const lat = coords[1];
      const depthKm = coords[2];
      const mag = Number(feat.properties?.mag) || 2.5;

      // Color code by depth: Shallow (<30km) is Red, Intermediate (<100km) is Yellow, Deep (>100km) is Blue
      let color = Cesium.Color.fromCssColorString('#ffd700'); // Yellow
      if (depthKm < 30) {
        color = Cesium.Color.fromCssColorString('#ff2244'); // Red (Shallow / High damage)
      } else if (depthKm > 100) {
        color = Cesium.Color.fromCssColorString('#00d2ff'); // Cyan/Blue (Deep)
      }

      const pixelSize = Math.max(5, Math.min(24, Math.round(mag * 3.5)));

      this.points.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        pixelSize,
        color: color.withAlpha(0.8),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.7),
        outlineWidth: 1.5,
        id: feat,
      });
    }

    this.viewer.scene.requestRender();
  }

  setVisible(visible) {
    this.visible = visible;
    this.points.show = visible;
    this.viewer.scene.requestRender();
  }

  destroy() {
    this.viewer.scene.primitives.remove(this.points);
  }
}
