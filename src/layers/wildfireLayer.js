import * as Cesium from 'cesium';
import { BaseHazardLayer } from './layerRegistry.js';
import { sriVisionApi } from '../core/api.js';
import { normalizeWildfireRecord } from '../core/hazardNormalizer.js';
import { getSeverityCesiumColor } from '../core/risk.js';
import { eventBus, SRI_EVENTS } from '../core/eventBus.js';
import { classifyThermalIncident, ThermalCategories } from '../intelligence/thermalClassifier.js';

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
    this.currentDate = null;
    this.activeCategoryFilter = 'INDUSTRIAL';
  }

  async initialize(viewer, layerManager) {
    await super.initialize(viewer, layerManager);
    this.dataSource = new Cesium.CustomDataSource('wildfire-firms-source');
    this.dataSource.show = this.visible;
    await this.viewer.dataSources.add(this.dataSource);

    // Listen to timeline date changes
    eventBus.on(SRI_EVENTS.TIMELINE_DATE_CHANGED, (evt) => {
      if (evt && evt.date && evt.date !== this.currentDate) {
        this.currentDate = evt.date;
        void this.load(evt.date);
      }
    });

    // Listen to live category segregation filter changes (default flyTo: false to maintain user viewport)
    eventBus.on(SRI_EVENTS.CATEGORY_FILTER_CHANGED, (evt) => {
      this.applyCategoryFilter(evt?.category || 'INDUSTRIAL', { flyTo: Boolean(evt?.flyTo) });
    });
  }

  applyCategoryFilter(filterKey = 'INDUSTRIAL', options = {}) {
    this.activeCategoryFilter = filterKey;
    if (!this.dataSource) return;

    let visibleCount = 0;
    let topEntity = null;
    let maxFrp = -1;

    const entities = this.dataSource.entities.values;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const cat = entity._sriCategory || ThermalCategories.FOREST_WILDFIRE;

      let show = false;
      if (filterKey === 'ALL') {
        show = true;
      } else if (filterKey === 'INDUSTRIAL') {
        show = (cat === ThermalCategories.INDUSTRIAL_FLARE ||
                cat === ThermalCategories.INDUSTRIAL_PROCESS ||
                cat === ThermalCategories.INDUSTRIAL_DISASTER);
      } else if (filterKey === 'NON_INDUSTRIAL') {
        show = (cat !== ThermalCategories.INDUSTRIAL_FLARE &&
                cat !== ThermalCategories.INDUSTRIAL_PROCESS &&
                cat !== ThermalCategories.INDUSTRIAL_DISASTER);
      } else if (filterKey === 'FLARES' || filterKey === ThermalCategories.INDUSTRIAL_FLARE) {
        show = (cat === ThermalCategories.INDUSTRIAL_FLARE);
      } else if (filterKey === 'DISASTER' || filterKey === ThermalCategories.INDUSTRIAL_DISASTER) {
        show = (cat === ThermalCategories.INDUSTRIAL_DISASTER);
      } else if (filterKey === 'WILDFIRE' || filterKey === ThermalCategories.FOREST_WILDFIRE) {
        show = (cat === ThermalCategories.FOREST_WILDFIRE);
      } else if (filterKey === 'AGRI' || filterKey === ThermalCategories.AGRICULTURAL_BURNING) {
        show = (cat === ThermalCategories.AGRICULTURAL_BURNING);
      } else if (filterKey === 'MINING' || filterKey === ThermalCategories.MINING_SMELTING) {
        show = (cat === ThermalCategories.MINING_SMELTING);
      } else {
        show = (cat === filterKey);
      }
      entity.show = show;

      if (show) {
        visibleCount++;
        const frp = Number(entity._sriFireRecord?.frp) || 0;
        if (frp > maxFrp) {
          maxFrp = frp;
          topEntity = entity;
        }
      }
    }

    // Force immediate Cesium render in requestRenderMode
    if (this.viewer?.scene) {
      this.viewer.scene.requestRender();
    }

    // Fly to highest FRP detection in the selected category
    if (options.flyTo && topEntity && filterKey !== 'ALL' && this.viewer) {
      const pos = topEntity.position?.getValue(Cesium.JulianDate.now());
      if (pos) {
        const carto = Cesium.Cartographic.fromCartesian(pos);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 240000),
          duration: 1.4,
        });
      }
    }

    // Surface tactical HUD Toast notification
    const toast = document.getElementById('toast');
    if (toast) {
      const label = filterKey.replace(/_/g, ' ');
      toast.textContent = `[SEGREGATION] ${label}: ${visibleCount} active detections on 3D Globe`;
      toast.classList.add('visible');
      clearTimeout(this._filterToastTimer);
      this._filterToastTimer = setTimeout(() => {
        toast.classList.remove('visible');
      }, 3500);
    }
  }

  async load(targetDate = null) {
    await super.load();
    if (!this.dataSource) return;
    this.dataSource.entities.removeAll();
    if (targetDate) this.currentDate = targetDate;

    try {
      // Fetch South Asia / Sri Lanka / India Bounding Box FIRMS fires (for specific date if provided)
      const data = await sriVisionApi.getFirmsHotspots('65,5,100,38', 2, this.currentDate);
      const rows = data.fires || data.records || data.data || [];
      this.hotspots = rows.slice(0, 400); // Guarded batch

      const counts = {
        ALL: this.hotspots.length,
        INDUSTRIAL: 0,
        INDUSTRIAL_FLARE: 0,
        INDUSTRIAL_PROCESS: 0,
        INDUSTRIAL_DISASTER: 0,
        FOREST_WILDFIRE: 0,
        AGRICULTURAL_BURNING: 0,
        MINING_SMELTING: 0,
        NON_INDUSTRIAL: 0,
      };

      for (const record of this.hotspots) {
        const hazard = normalizeWildfireRecord(record);
        const lat = hazard.location.latitude;
        const lon = hazard.location.longitude;
        const frp = Number(record.frp) || 10;

        // Perform 2-stage hierarchical classification & attribution
        const classification = classifyThermalIncident(record);
        const category = classification?.category || ThermalCategories.FOREST_WILDFIRE;

        // Track live counts for HUD badges
        if (counts[category] !== undefined) counts[category]++;
        if (category === ThermalCategories.INDUSTRIAL_FLARE ||
            category === ThermalCategories.INDUSTRIAL_PROCESS ||
            category === ThermalCategories.INDUSTRIAL_DISASTER) {
          counts.INDUSTRIAL++;
        } else {
          counts.NON_INDUSTRIAL++;
        }

        // Distinct styling based on segregated category
        let categoryIcon = '🔥';
        let customColor = getSeverityCesiumColor(hazard.severity);

        if (category === ThermalCategories.INDUSTRIAL_DISASTER) {
          categoryIcon = '🏭';
          customColor = Cesium.Color.fromCssColorString('#ef4444'); // Crimson Red Industrial
        } else if (category === ThermalCategories.INDUSTRIAL_FLARE) {
          categoryIcon = '⚡';
          customColor = Cesium.Color.fromCssColorString('#a855f7'); // Electric Violet Flare
        } else if (category === ThermalCategories.INDUSTRIAL_PROCESS) {
          categoryIcon = '🏭';
          customColor = Cesium.Color.fromCssColorString('#00d4ff'); // Cyan Industrial
        } else if (category === ThermalCategories.AGRICULTURAL_BURNING) {
          categoryIcon = '🌾';
          customColor = Cesium.Color.fromCssColorString('#facc15'); // Harvest Yellow
        } else if (category === ThermalCategories.MINING_SMELTING) {
          categoryIcon = '⛏️';
          customColor = Cesium.Color.fromCssColorString('#fb923c'); // Amber
        } else if (category === ThermalCategories.FOREST_WILDFIRE) {
          categoryIcon = '🌲';
          customColor = Cesium.Color.fromCssColorString('#ea580c'); // Deep Wildfire Orange
        }

        const pointSize = Math.max(7, Math.min(22, 7 + Math.log10(frp + 1) * 6));

        const entity = this.dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 20),
          point: {
            pixelSize: pointSize,
            color: customColor,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: 50000,
          },
          label: {
            text: `${categoryIcon} ${frp.toFixed(0)}MW`,
            font: '10px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#e8eaed'),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0c0c14').withAlpha(0.75),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
            pixelOffset: new Cesium.Cartesian2(0, -16),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 450000), // LOD culling
          },
        });

        entity._sriHazardContract = hazard;
        entity._sriFireRecord = record;
        entity._sriClassification = classification;
        entity._sriCategory = category;
      }

      // Re-apply active filter on freshly loaded batch
      this.applyCategoryFilter(this.activeCategoryFilter);

      // Broadcast live counts to HUD toggle chips
      eventBus.emit('srivision:category-counts-updated', counts);
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
