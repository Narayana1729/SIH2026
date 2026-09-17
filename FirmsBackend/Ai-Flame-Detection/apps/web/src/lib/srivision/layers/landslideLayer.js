/**
 * @module layers/landslideLayer
 * @description Next-Gen Slope Intelligence System (SIE) & Sentinel Digital Twins Layer.
 * Renders living sentinel slope twins on the Cesium 3D globe with dynamic state-based styling,
 * kinematic velocity surge markers, and opens the interactive Digital Twin HUD.
 */

import * as Cesium from 'cesium';
import { BaseHazardLayer } from './layerRegistry.js';
import { sriVisionApi } from '../core/api.js';
import { normalizeLandslideVillage } from '../core/hazardNormalizer.js';
import { LandslideTwinModal } from '../ui/hud/landslideTwinModal.js';

const STATE_CESIUM_COLORS = {
  HEALTHY: Cesium.Color.fromCssColorString('#00e676'),
  LOADING: Cesium.Color.fromCssColorString('#00e5ff'),
  SATURATING: Cesium.Color.fromCssColorString('#ffd700'),
  UNSTABLE: Cesium.Color.fromCssColorString('#ff9100'),
  CRITICAL: Cesium.Color.fromCssColorString('#ff1744'),
  RECOVERY: Cesium.Color.fromCssColorString('#d500f9'),
};

export class LandslideLayer extends BaseHazardLayer {
  constructor() {
    super({
      id: 'hazard-landslide',
      name: 'Slope Intelligence (SIE)',
      icon: '🏔️',
      type: 'HAZARD',
    });

    this.sentinelTwins = [];
    this.twinModal = null;
  }

  async initialize(viewer, layerManager) {
    await super.initialize(viewer, layerManager);
    this.dataSource = new Cesium.CustomDataSource('landslide-warning-source');
    await this.viewer.dataSources.add(this.dataSource);
    this.twinModal = new LandslideTwinModal();
  }

  async load() {
    await super.load();
    if (!this.dataSource) return;
    this.dataSource.entities.removeAll();

    try {
      const data = await sriVisionApi.getSentinelSlopes();
      const list = data.sentinelSlopes || [];
      this.sentinelTwins = list;

      for (const twin of this.sentinelTwins) {
        const lat = twin.coordinates?.latitude || 0;
        const lon = twin.coordinates?.longitude || 0;
        const stateKey = twin.stateMachine?.currentState || 'HEALTHY';
        const color = STATE_CESIUM_COLORS[stateKey] || Cesium.Color.YELLOW;
        const loadRatio = twin.hydrologicalMetrics?.loadRatio || 0.0;
        const budgetMm = twin.hydrologicalMetrics?.remainingTriggerBudgetMm ?? '—';
        const isEscalating = twin.kinematics?.escalationAlert;

        const entity = this.dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 25),
          point: {
            pixelSize: isEscalating ? 14 : 11,
            color,
            outlineColor: isEscalating ? Cesium.Color.WHITE : Cesium.Color.BLACK,
            outlineWidth: 2.0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new Cesium.NearFarScalar(5.0e4, 1.2, 4.0e6, 0.5),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
          },
          label: {
            text: `🏔️ ${twin.name}\n[${stateKey} | Load: ${loadRatio.toFixed(2)} | Budget: ${budgetMm}mm]`,
            font: '11px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#f0f4f8'),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#090d16').withAlpha(0.85),
            backgroundPadding: new Cesium.Cartesian2(6, 4),
            pixelOffset: new Cesium.Cartesian2(0, -26),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 650000),
          },
        });

        // Store references for click selection
        entity._sriSentinelTwin = twin;
        entity._sriHazardContract = normalizeLandslideVillage({
          village_id: twin.slopeId,
          village_name: twin.name,
          administrative_area: twin.administrativeUnit,
          coordinates: twin.coordinates,
          hazard_score_100: twin.kinematics?.operationalHazardScore100 || 50,
          factor_of_safety: twin.sentinelPhysicalMechanics?.factorOfSafety || 1.5,
          alert_tier: stateKey === 'CRITICAL' ? 'RED_EVACUATE_IMMEDIATE' : stateKey === 'UNSTABLE' ? 'ORANGE_PREPAREDNESS' : 'GREEN_NORMAL',
        });
      }
    } catch (err) {
      console.warn('[LandslideLayer] Failed to load sentinel slope twins:', err);
    }
  }

  onSelect(hazardContract) {
    if (hazardContract.hazard_type !== 'LANDSLIDE') return;
    super.onSelect(hazardContract);

    // Find the matching sentinel twin
    const twin = this.sentinelTwins.find(
      (t) => t.slopeId === hazardContract.id || t.name === hazardContract.title
    );
    if (twin && this.twinModal) {
      this.twinModal.open(twin);
    }
  }
}
