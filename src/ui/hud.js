/**
 * @module ui/hud
 * @description Tactical telemetry HUD displaying camera coordinates, altitude, UTC clock, and active incident badges.
 */

import * as Cesium from 'cesium';

export class HudController {
  constructor(viewer, appState) {
    this.viewer = viewer;
    this.appState = appState;
    this.latEl = document.getElementById('hud-lat');
    this.lonEl = document.getElementById('hud-lon');
    this.altEl = document.getElementById('hud-alt');
    this.utcEl = document.getElementById('hud-utc');
    this.alertBadgeEl = document.getElementById('hud-alert-badge');

    this.initClock();
    this.initCameraListener();
  }

  initClock() {
    const update = () => {
      if (this.utcEl) {
        const now = new Date();
        this.utcEl.textContent = now.toUTCString().slice(17, 25) + ' UTC';
      }
    };
    update();
    setInterval(update, 1000);
  }

  initCameraListener() {
    this.viewer.camera.changed.addEventListener(() => {
      const cartographic = Cesium.Cartographic.fromCartesian(this.viewer.camera.position);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const altM = Math.round(cartographic.height);

      if (this.latEl) this.latEl.textContent = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
      if (this.lonEl) this.lonEl.textContent = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
      if (this.altEl) this.altEl.textContent = altM > 10000 ? `${(altM / 1000).toFixed(0)} km` : `${altM} m`;

      this.appState.setCameraPosition({ lat, lon, altitudeM: altM });
    });
  }

  updateAlertCount(count) {
    if (this.alertBadgeEl) {
      this.alertBadgeEl.textContent = `${count} INCIDENTS ACTIVE`;
      this.alertBadgeEl.className = count > 0 ? 'hud-badge active' : 'hud-badge';
    }
  }
}
