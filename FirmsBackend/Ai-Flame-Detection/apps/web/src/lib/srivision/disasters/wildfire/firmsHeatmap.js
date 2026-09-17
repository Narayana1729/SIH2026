/**
 * @module disasters/wildfire/firmsHeatmap
 * @description Renders NASA FIRMS active fire hotspots on Cesium 3D Globe using PointPrimitiveCollection.
 */

import * as Cesium from 'cesium';
import { adaptFirmsRecords } from './firmsAdapt.js';

export class WildfireLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    this.fires = [];
    this.visible = true;
  }

  async loadData() {
    try {
      const res = await fetch('/api/firms');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.setData(data.fires || []);
    } catch (err) {
      console.warn('[sriVision Wildfire] Error loading FIRMS data:', err);
    }
  }

  setData(records = []) {
    this.points.removeAll();
    this.fires = adaptFirmsRecords(records);

    for (const fire of this.fires) {
      const frp = fire.frp;
      let color = Cesium.Color.fromCssColorString('#ff4500'); // Orange-red
      let size = 4;

      if (frp >= 100) {
        color = Cesium.Color.fromCssColorString('#ff1100'); // Intense Red
        size = 8;
      } else if (frp >= 30) {
        color = Cesium.Color.fromCssColorString('#ff6600'); // Orange
        size = 6;
      }

      this.points.add({
        position: Cesium.Cartesian3.fromDegrees(fire.lon, fire.lat, 0),
        pixelSize: size,
        color: color.withAlpha(0.85),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        id: fire,
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
