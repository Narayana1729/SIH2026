/**
 * @module layers/industrialLayer
 * @description Industrial HazMat Intelligence Layer for sriVision.
 * Visualizes 1,200+ major Indian industrial facilities with distance-based level-of-detail culling.
 * Dynamically renders Isolation & Evacuation perimeters and nearby emergency responders ONLY for the selected facility.
 */

import * as Cesium from 'cesium';
import { BaseHazardLayer } from './layerRegistry.js';
import { sriVisionApi } from '../core/api.js';
import { normalizeIndustrialFacility } from '../core/hazardNormalizer.js';
import { getSeverityCesiumColor } from '../core/risk.js';

export class IndustrialLayer extends BaseHazardLayer {
  constructor() {
    super({
      id: 'hazard-industrial',
      name: 'Industrial GIS & HazMat Registry',
      icon: '🏭',
      type: 'HAZARD',
    });

    this.facilities = [];
    this.selectedFacilityOverlays = [];
  }

  async initialize(viewer, layerManager) {
    await super.initialize(viewer, layerManager);
    this.dataSource = new Cesium.CustomDataSource('industrial-hazmat-source');
    await this.viewer.dataSources.add(this.dataSource);
  }

  async load() {
    await super.load();
    if (!this.dataSource) return;
    this.dataSource.entities.removeAll();

    try {
      const data = await sriVisionApi.getIndustrialFacilities(400);
      const features = data.features || data.data || [];
      this.facilities = features;

      for (const feat of this.facilities) {
        const hazard = normalizeIndustrialFacility(feat);
        const lat = hazard.location.latitude;
        const lon = hazard.location.longitude;
        const props = feat.properties || {};

        const entity = this.dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 10),
          point: {
            pixelSize: 8,
            color: getSeverityCesiumColor(hazard.severity),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000000), // LOD culling
          },
          label: {
            text: `🏭 ${hazard.title.slice(0, 24)}`,
            font: '10px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#e8eaed'),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0c0c14').withAlpha(0.75),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
            pixelOffset: new Cesium.Cartesian2(0, -16),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 450000), // Detailed label on local zoom only
          },
        });

        entity._sriHazardContract = hazard;
        entity._sriFacilityFeature = feat;
      }
    } catch (err) {
      console.warn('[IndustrialLayer] Failed to load facilities:', err);
    }
  }

  /**
   * On selecting a facility:
   * 1. Clear previous facility overlays.
   * 2. Render Initial Isolation Circle + Protective Evacuation Circle.
   * 3. Fetch nearest Emergency Responders (Fire, NDRF, Hospitals).
   */
  async onSelect(hazardContract) {
    if (hazardContract.hazard_type !== 'INDUSTRIAL_HAZMAT') return;

    this.clearSelectedOverlays();
    super.onSelect(hazardContract);

    const lat = hazardContract.location.latitude;
    const lon = hazardContract.location.longitude;
    const raw = hazardContract.raw_payload || {};
    const props = raw.properties || raw;
    const hazmat = props.hazmat_profile || props.hazmatProfile || {};

    const isolationM = hazmat.initial_isolation_distance_meters || 300;
    const evacKm = hazmat.protective_action_distance_km || 1.5;

    // 1. Render Initial Isolation Zone (Orange/Red circle)
    const isolationCircle = this.dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      ellipse: {
        semiMajorAxis: isolationM,
        semiMinorAxis: isolationM,
        material: Cesium.Color.fromCssColorString('#ff3300').withAlpha(0.35),
        outline: true,
        outlineColor: Cesium.Color.RED,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    this.selectedFacilityOverlays.push(isolationCircle);

    // 2. Render Protective Action Evacuation Radius (Yellow/Orange outer perimeter)
    const evacCircle = this.dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      ellipse: {
        semiMajorAxis: evacKm * 1000,
        semiMinorAxis: evacKm * 1000,
        material: Cesium.Color.fromCssColorString('#ffaa00').withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.ORANGE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    this.selectedFacilityOverlays.push(evacCircle);

    // 3. Fetch nearby responders within 40km
    try {
      const respData = await sriVisionApi.getNearbyResponders(lat, lon, 40);
      const responders = respData.responders || respData.data || {};
      const allUnits = [
        ...(responders.fire_stations || []),
        ...(responders.disaster_response_battalions || []),
        ...(responders.hospitals || []),
      ];

      for (const unit of allUnits) {
        const uLat = unit.latitude;
        const uLon = unit.longitude;
        if (!uLat || !uLon) continue;

        const icon = unit.category === 'FIRE_RESCUE' ? '🚒' : unit.category === 'NDRF_SDRF' ? '🛡️' : '🏥';
        const color = unit.category === 'FIRE_RESCUE' ? Cesium.Color.RED : unit.category === 'NDRF_SDRF' ? Cesium.Color.DARKORANGE : Cesium.Color.CYAN;

        const unitEntity = this.dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(uLon, uLat, 15),
          point: {
            pixelSize: 10,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: `${icon} ${unit.name} (${unit.distance_km || '?'} km)`,
            font: '10px sans-serif',
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.8),
            pixelOffset: new Cesium.Cartesian2(0, -18),
          },
        });
        this.selectedFacilityOverlays.push(unitEntity);
      }

      // Re-emit enriched hazard with nearby responders
      const enriched = normalizeIndustrialFacility(raw, responders);
      super.onSelect(enriched);

    } catch (err) {
      console.warn('[IndustrialLayer] Failed to fetch responders:', err);
    }
  }

  clearSelectedOverlays() {
    for (const ent of this.selectedFacilityOverlays) {
      this.dataSource.entities.remove(ent);
    }
    this.selectedFacilityOverlays = [];
  }

  destroy() {
    this.clearSelectedOverlays();
    super.destroy();
  }
}
