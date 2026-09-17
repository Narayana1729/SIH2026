/**
 * @module intelligence/eventOrchestrator
 * @description Master Event-Driven Disaster Orchestrator for sriVision.
 * Reactively correlates incoming live events (wildfires, winds, rainfall, seismicity) against infrastructure
 * and triggers automated simulations, multi-hazard escalations, and tactical warnings.
 */

import { eventBus, SRI_EVENTS } from '../core/eventBus.js';
import { sriVisionApi } from '../core/api.js';
import { normalizeWildfireRecord, normalizeIndustrialFacility, normalizeLandslideVillage, normalizeFlashFloodVillage } from '../core/hazardNormalizer.js';

export class DisasterEventOrchestrator {
  constructor(viewer, hazardLayerManager) {
    this.viewer = viewer;
    this.layerManager = hazardLayerManager;
    this.activeIncidents = new Map();
    this.facilitiesCache = [];
    this._unsubscribers = [];

    this._initSubscriptions();
    this._setupTerrainProbe();
  }

  _initSubscriptions() {
    // 1. When a hazard is selected, automatically fetch real-time weather and re-run simulations with live wind/rain
    this._unsubscribers.push(
      eventBus.on(SRI_EVENTS.HAZARD_SELECTED, async (hazard) => {
        if (!hazard || !hazard.location) return;
        const { latitude: lat, longitude: lon } = hazard.location;

        try {
          // Fetch live meteorology for incident coordinates
          const weatherData = await sriVisionApi.getWeather(lat, lon);
          if (weatherData && weatherData.weather) {
            eventBus.emit(SRI_EVENTS.WEATHER_UPDATED, {
              hazardId: hazard.id,
              weather: weatherData.weather,
            });
          }
        } catch (err) {
          console.warn('[EventOrchestrator] Failed to fetch live weather:', err);
        }
      })
    );

    // 2. When live weather updates, trigger real-time reactive simulations
    this._unsubscribers.push(
      eventBus.on(SRI_EVENTS.WEATHER_UPDATED, async ({ hazardId, weather }) => {
        const hazard = this.layerManager?.selectedHazard;
        if (!hazard || hazard.id !== hazardId) return;

        const windSpeedKmh = weather.windSpeedKmh || 18;
        const windDirDeg = weather.windDirectionDegrees || 220;

        if (hazard.hazard_type === 'WILDFIRE') {
          try {
            const simResult = await sriVisionApi.simulateFireSpread({
              originLat: hazard.location.latitude,
              originLon: hazard.location.longitude,
              windSpeedKmh,
              windDirDegrees: windDirDeg,
              fuelType: 'SHRUBLAND',
              slopeDegrees: 10,
            });

            if (simResult?.success) {
              eventBus.emit(SRI_EVENTS.SIMULATION_COMPLETED, {
                hazardId: hazard.id,
                type: 'WILDFIRE_SPREAD',
                simulationData: simResult.data,
              });
            }
          } catch (err) {
            console.warn('[EventOrchestrator] Reactive wildfire spread update failed:', err);
          }
        }
      })
    );

    // 3. Multi-Hazard Escalation Listener: correlates active fires against industrial facilities
    this._unsubscribers.push(
      eventBus.on(SRI_EVENTS.HAZARDS_REFRESHED, (hazardsList) => {
        this._correlateMultiHazards(hazardsList);
      })
    );
  }

  /**
   * Shift + Left Click on any point on the 3D globe triggers an instant Reactive Terrain Probe.
   */
  _setupTerrainProbe() {
    if (!this.viewer || this.viewer.isDestroyed()) return;

    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    handler.setInputAction((movement) => {
      const ray = this.viewer.camera.getPickRay(movement.position);
      if (!ray) return;
      const cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const elevationM = Math.round(cartographic.height);

      eventBus.emit(SRI_EVENTS.TERRAIN_PROBE_CLICKED, {
        latitude: Math.round(lat * 1e5) / 1e5,
        longitude: Math.round(lon * 1e5) / 1e5,
        elevationM,
      });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK, Cesium.KeyboardEventModifier.SHIFT);

    this._unsubscribers.push(() => handler.destroy());
  }

  _correlateMultiHazards(hazards = []) {
    const fires = hazards.filter((h) => h.hazard_type === 'WILDFIRE');
    const facilities = hazards.filter((h) => h.hazard_type === 'INDUSTRIAL_HAZMAT');

    for (const fire of fires) {
      for (const fac of facilities) {
        const dKm = this._haversineDistance(
          fire.location.latitude, fire.location.longitude,
          fac.location.latitude, fac.location.longitude
        );

        if (dKm <= 15.0) {
          eventBus.emit(SRI_EVENTS.ALERT_ESCALATED, {
            id: `escalated-${fire.id}-${fac.id}`,
            hazard_type: 'INDUSTRIAL_HAZMAT',
            severity: 'CRITICAL',
            title: `🚨 THREAT ESCALATION: Wildfire Near ${fac.title}`,
            subtitle: `Active thermal anomaly detected within ${dKm.toFixed(1)} km of ${fac.title} (${fac.location.district || ''}). HazMat protocol triggered.`,
            location: fac.location,
          });
        }
      }
    }
  }

  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  destroy() {
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch {}
    }
    this._unsubscribers = [];
  }
}
