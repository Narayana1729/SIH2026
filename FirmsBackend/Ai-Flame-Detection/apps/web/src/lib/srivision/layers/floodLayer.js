/**
 * @module layers/floodLayer
 * @description Hyper-Local Flash Flood & Inundation Warning Layer for sriVision.
 * Visualizes vulnerable river basins and mountain valley settlements across Himalayas & Western Ghats.
 * Displays Kirpich Time of Concentration (Tc), peak runoff surge, and flood surge arrival lead times.
 */

import * as Cesium from 'cesium';
import { BaseHazardLayer } from './layerRegistry.js';
import { sriVisionApi } from '../core/api.js';
import { normalizeFlashFloodVillage } from '../core/hazardNormalizer.js';
import { getSeverityCesiumColor } from '../core/risk.js';

export class FloodLayer extends BaseHazardLayer {
  constructor() {
    super({
      id: 'hazard-flood',
      name: 'Flash Flood & Inundation (Tc)',
      icon: '🌊',
      type: 'HAZARD',
    });

    this.villages = [];
  }

  async initialize(viewer, layerManager) {
    await super.initialize(viewer, layerManager);
    this.dataSource = new Cesium.CustomDataSource('flash-flood-source');
    await this.viewer.dataSources.add(this.dataSource);
  }

  async load() {
    await super.load();
    if (!this.dataSource) return;
    this.dataSource.entities.removeAll();

    try {
      const data = await sriVisionApi.getFlashFloodVillageRisks();
      const list = data.villages || [];
      this.villages = list;

      for (const v of this.villages) {
        const hazard = normalizeFlashFloodVillage(v);
        const lat = hazard.location.latitude;
        const lon = hazard.location.longitude;
        const depth = v.catchment_hydrology?.estimated_inundation_depth_meters || 0;

        const color = getSeverityCesiumColor(hazard.severity);

        const entity = this.dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 20),
          point: {
            pixelSize: 10,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new Cesium.NearFarScalar(5.0e4, 1.1, 4.0e6, 0.45),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4000000),
          },
          label: {
            text: `🌊 ${v.village_name} (${depth > 0 ? `+${depth}m` : 'Surge'})`,
            font: '10px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#e8eaed'),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0c0c14').withAlpha(0.75),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
            pixelOffset: new Cesium.Cartesian2(0, -16),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 450000), // Only visible on local/regional zoom
          },
        });

        entity._sriHazardContract = hazard;
        entity._sriFloodData = v;
      }
    } catch (err) {
      console.warn('[FloodLayer] Failed to load village flash flood risks:', err);
    }
  }

  onSelect(hazardContract) {
    if (hazardContract.hazard_type !== 'FLASH_FLOOD') return;
    super.onSelect(hazardContract);
  }
}
