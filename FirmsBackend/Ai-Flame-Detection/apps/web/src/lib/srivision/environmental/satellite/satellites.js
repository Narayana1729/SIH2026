/**
 * @module environmental/satellite/satellites
 * @description Ingests CelesTrak TLEs and propagates Earth-Observation/Weather satellite orbits via SGP4 (satellite.js).
 */

import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';

export class SatelliteLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    this.satellites = [];
    this.visible = true;
  }

  async loadData() {
    try {
      const res = await fetch('/api/satellites');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tleText = await res.text();
      this.parseTles(tleText);
      this.updatePositions();
    } catch (err) {
      console.warn('[sriVision Satellites] Error loading TLEs:', err);
    }
  }

  parseTles(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const sats = [];

    for (let i = 0; i < lines.length - 2; i += 3) {
      const name = lines[i];
      const line1 = lines[i + 1];
      const line2 = lines[i + 2];

      if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
        try {
          const satrec = satellite.twoline2satrec(line1, line2);
          sats.push({ name, satrec, line1, line2 });
        } catch {}
      }
    }

    this.satellites = sats;
  }

  updatePositions(date = new Date()) {
    this.points.removeAll();
    if (!this.visible || this.satellites.length === 0) return;

    const gmst = satellite.gstime(date);

    for (const sat of this.satellites) {
      try {
        const positionAndVelocity = satellite.propagate(sat.satrec, date);
        const positionEci = positionAndVelocity?.position;
        if (!positionEci) continue;

        const positionGd = satellite.eciToGeodetic(positionEci, gmst);
        const lon = satellite.degreesLong(positionGd.longitude);
        const lat = satellite.degreesLat(positionGd.latitude);
        const altM = positionGd.height * 1000;

        if (Number.isFinite(lon) && Number.isFinite(lat) && Number.isFinite(altM)) {
          this.points.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, altM),
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString('#00ffff'), // Cyan
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            id: { type: 'satellite', name: sat.name, lat, lon, altM },
          });
        }
      } catch {}
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
