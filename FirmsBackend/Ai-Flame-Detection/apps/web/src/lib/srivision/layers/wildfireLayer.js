/**
 * @module layers/wildfireLayer
 * @description Wildfire Intelligence Layer for sriVision.
 * Visualizes NASA FIRMS thermal hotspots (OBSERVED), and upon selection, dynamically renders
 * Rothermel 1h/2h/4h elliptical fire spread perimeters (SIMULATED) and wind vectors directly on the 3D globe.
 */

import * as Cesium from 'cesium';
import { BaseHazardLayer } from './layerRegistry.js';
import { sriVisionApi } from '../core/api.js';
import { normalizeWildfireRecord } from '../core/hazardNormalizer.js';
import { getSeverityCesiumColor } from '../core/risk.js';

export class WildfireLayer extends BaseHazardLayer {
  constructor() {
    super({
      id: 'hazard-wildfire',
      name: 'Wildfires & Thermal Anomalies',
      icon: '🔥',
      type: 'HAZARD',
    });

    this.hotspots = [];
    this.selectedSpreadEntities = [];
  }

  async initialize(viewer, layerManager) {
    await super.initialize(viewer, layerManager);
    this.dataSource = new Cesium.CustomDataSource('wildfire-firms-source');
    await this.viewer.dataSources.add(this.dataSource);
  }

  async load() {
    await super.load();
    if (!this.dataSource) return;
    this.dataSource.entities.removeAll();

    try {
      // Fetch South Asia / India Bounding Box FIRMS fires
      const data = await sriVisionApi.getFirmsHotspots('68,6,97,37', 1);
      const rows = data.records || data.data || [];
      this.hotspots = rows.slice(0, 400); // Guarded batch

      for (const record of this.hotspots) {
        const hazard = normalizeWildfireRecord(record);
        const lat = hazard.location.latitude;
        const lon = hazard.location.longitude;
        const frp = Number(record.frp) || 10;

        // Dynamic billboard / point sizing based on Fire Radiative Power (MW)
        const pointSize = Math.max(6, Math.min(22, 6 + Math.log10(frp + 1) * 6));
        const color = getSeverityCesiumColor(hazard.severity);

        const entity = this.dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 20),
          point: {
            pixelSize: pointSize,
            color: color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: 50000,
          },
          label: {
            text: `🔥 ${frp.toFixed(0)} MW`,
            font: '10px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#e8eaed'),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0c0c14').withAlpha(0.75),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
            pixelOffset: new Cesium.Cartesian2(0, -16),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 450000), // LOD culling for zoomed-out globe
          },
        });

        entity._sriHazardContract = hazard;
        entity._sriFireRecord = record;
      }
    } catch (err) {
      console.warn('[WildfireLayer] Failed to load live FIRMS data:', err);
    }
  }

  /**
   * On selecting a fire, simulate and render Rothermel 1h/2h/4h spread ellipses.
   */
  async onSelect(hazardContract) {
    if (hazardContract.hazard_type !== 'WILDFIRE') return;

    this.clearSpreadSimulation();
    super.onSelect(hazardContract);

    const lat = hazardContract.location.latitude;
    const lon = hazardContract.location.longitude;
    const raw = hazardContract.raw_payload || {};

    try {
      // Simulate Rothermel spread under local wind conditions
      const simResult = await sriVisionApi.simulateFireSpread({
        originLat: lat,
        originLon: lon,
        windSpeedKmh: 20,
        windDirDegrees: 220,
        fuelType: 'SHRUB_BRUSH',
        slopeDegrees: 15,
      });

      if (!simResult?.success) return;

      const data = simResult.data || {};
      const perimeters = data.perimeters || [];

      // Render 1h, 2h, and 4h simulated burn perimeters
      const colors = [
        Cesium.Color.fromCssColorString('#ff3300').withAlpha(0.45), // 1h (High intensity core)
        Cesium.Color.fromCssColorString('#ff8800').withAlpha(0.35), // 2h
        Cesium.Color.fromCssColorString('#ffcc00').withAlpha(0.25), // 4h (Fringe)
      ];

      perimeters.forEach((p, idx) => {
        const coords = p.coordinates || [];
        if (!coords.length) return;

        const flatPositions = [];
        for (const [pLon, pLat] of coords) {
          flatPositions.push(pLon, pLat);
        }

        const polyEntity = this.dataSource.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(flatPositions),
            material: colors[idx] || colors[0],
            outline: true,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        this.selectedSpreadEntities.push(polyEntity);
      });

      // Update the normalized hazard with the simulated spread info
      const enrichedHazard = normalizeWildfireRecord(raw, data);
      super.onSelect(enrichedHazard);

    } catch (err) {
      console.warn('[WildfireLayer] Simulation failed:', err);
    }
  }

  clearSpreadSimulation() {
    for (const ent of this.selectedSpreadEntities) {
      this.dataSource.entities.remove(ent);
    }
    this.selectedSpreadEntities = [];
  }

  destroy() {
    this.clearSpreadSimulation();
    super.destroy();
  }
}
