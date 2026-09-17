/**
 * @module layers/dispersionLayer
 * @description Chemical Plume Atmospheric Dispersion Layer for sriVision.
 * Visualizes terrain-draped ground-level concentration isopleths computed via the Gaussian Plume model.
 * Uses chemical-specific toxicological thresholds (IDLH / AEGL-2 / Odor) with honest provenance labeling.
 */

import * as Cesium from 'cesium';
import { BaseHazardLayer } from './layerRegistry.js';
import { sriVisionApi } from '../core/api.js';
import { normalizePlumeDispersion } from '../core/hazardNormalizer.js';
import { eventBus, SRI_EVENTS } from '../core/eventBus.js';

import { findFacilitiesNearby, resolveHazmatProfile } from '../disasters/industrial/industrialFacilities.js';

// Chemical Toxicological Profiles & Authoritative Exposure Limits (ppm)
export const CHEMICAL_PROFILES = Object.freeze({
  CHLORINE: {
    name: 'Chlorine Gas (Cl₂)',
    cas: '7782-50-5',
    thresholds: { advisory: 0.5, evacuation: 3.0, critical: 10.0 }, // ERPG-1, ERPG-2, IDLH
    unit: 'ppm',
  },
  AMMONIA: {
    name: 'Anhydrous Ammonia (NH₃)',
    cas: '7664-41-7',
    thresholds: { advisory: 25.0, evacuation: 150.0, critical: 300.0 },
    unit: 'ppm',
  },
  BENZENE: {
    name: 'Benzene Vapor (C₆H₆)',
    cas: '71-43-2',
    thresholds: { advisory: 10.0, evacuation: 50.0, critical: 500.0 },
    unit: 'ppm',
  },
  HYDROGEN_SULFIDE: {
    name: 'Hydrogen Sulfide (H₂S)',
    cas: '7783-06-4',
    thresholds: { advisory: 1.0, evacuation: 30.0, critical: 100.0 },
    unit: 'ppm',
  },
  SO2: {
    name: 'Sulfur Dioxide (SO₂)',
    cas: '7446-09-5',
    thresholds: { advisory: 0.3, evacuation: 3.0, critical: 100.0 },
    unit: 'ppm',
  },
  CO: {
    name: 'Carbon Monoxide (CO)',
    cas: '630-08-0',
    thresholds: { advisory: 35.0, evacuation: 200.0, critical: 1200.0 },
    unit: 'ppm',
  },
  METHANE: {
    name: 'Methane Vapor Cloud (CH₄)',
    cas: '74-82-8',
    thresholds: { advisory: 5000.0, evacuation: 25000.0, critical: 50000.0 },
    unit: 'ppm',
  },
  STYRENE: {
    name: 'Styrene Monomer (C₈H₈)',
    cas: '100-42-5',
    thresholds: { advisory: 20.0, evacuation: 100.0, critical: 700.0 },
    unit: 'ppm',
  },
});

export class DispersionLayer extends BaseHazardLayer {
  constructor() {
    super({
      id: 'hazard-dispersion',
      name: 'Chemical Plume Dispersion',
      icon: '☁️',
      type: 'HAZARD',
    });

    this.activePlumeEntities = [];
    this.scenarioLocations = [
      { name: 'Jamnagar Petrochemical Complex', lat: 22.4707, lon: 70.0577, chemical: 'BENZENE' },
      { name: 'Visakhapatnam Chemical Hub', lat: 17.6868, lon: 83.2185, chemical: 'AMMONIA' },
      { name: 'Manali Industrial Belt (Chennai)', lat: 13.1672, lon: 80.2644, chemical: 'CHLORINE' },
    ];
  }

  async initialize(viewer, layerManager) {
    await super.initialize(viewer, layerManager);
    this.dataSource = new Cesium.CustomDataSource('chemical-dispersion-source');
    await this.viewer.dataSources.add(this.dataSource);

    eventBus.on(SRI_EVENTS.SIMULATION_REQUESTED, async (sim) => {
      this.show();
      const lat = sim.latitude ?? sim.lat;
      const lon = sim.longitude ?? sim.lon;
      const chem = sim.chemical || 'BENZENE';
      const name = sim.incident_title || sim.facilityName || 'Thermal Plume Simulation';
      if (lat != null && lon != null) {
        await this.simulatePlumeAt(lat, lon, { chemical: chem, facilityName: name });
      }
    });
  }

  async load() {
    await super.load();
    if (!this.dataSource) return;
    this.dataSource.entities.removeAll();

    // Render preset incident scenario markers
    for (const scn of this.scenarioLocations) {
      const chem = CHEMICAL_PROFILES[scn.chemical] || CHEMICAL_PROFILES.CHLORINE;

        const entity = this.dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(scn.lon, scn.lat, 15),
          billboard: {
            image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="%23ff3300"><path d="M12 2L1 21h22L12 2zm0 3.5L19.8 19H4.2L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>',
            scale: 0.75,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            scaleByDistance: new Cesium.NearFarScalar(2.0e4, 0.85, 3.0e6, 0.35),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3500000),
          },
          label: {
            text: `☁️ Plume Sim: ${chem.name}`,
            font: '10px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#e8eaed'),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0c0c14').withAlpha(0.75),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
            pixelOffset: new Cesium.Cartesian2(0, -20),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 600000), // Only visible on regional zoom
          },
        });

      entity._sriScenario = scn;
      entity._sriHazardContract = {
        hazard_type: 'CHEMICAL_PLUME',
        location: { latitude: scn.lat, longitude: scn.lon },
        raw_payload: scn,
      };
    }
  }

  /**
   * Run Gaussian plume dispersion simulation for any arbitrary coordinate using live Open-Meteo meteorology.
   */
  async simulatePlumeAt(lat, lon, { chemical = null, facilityName = null, emissionRateGPerSec = 1500 } = {}) {
    this.clearPlumeEntities();

    // Dynamically cross-reference nearest facility to obtain authentic CAMEO/NIOSH HazMat profile
    const nearby = findFacilitiesNearby(lat, lon, 30);
    const matchedFac = nearby[0] || null;
    const hazmat = matchedFac?.hazmat_profile || (facilityName ? resolveHazmatProfile(facilityName) : null);

    const resolvedFacilityName = facilityName || matchedFac?.name || 'Industrial Facility';
    let chem = null;

    if (chemical && CHEMICAL_PROFILES[chemical.toUpperCase()]) {
      chem = CHEMICAL_PROFILES[chemical.toUpperCase()];
    } else if (hazmat) {
      const code = hazmat.chemical_code || 'BENZENE';
      chem = CHEMICAL_PROFILES[code] || {
        name: hazmat.default_dispersion_chemical,
        thresholds: hazmat.dispersion_thresholds,
        unit: 'ppm',
      };
    } else {
      chem = CHEMICAL_PROFILES.BENZENE;
    }

    try {
      // 1. Fetch live Open-Meteo atmospheric observation for the facility coordinates
      let liveWindSpeed = 4.5;
      let liveWindDir = 240;
      let liveStability = 'D';
      let weatherData = null;

      try {
        const weatherResp = await sriVisionApi.getWeather(lat, lon);
        weatherData = weatherResp?.current || {};
        if (typeof weatherData.wind_speed_10m === 'number') {
          // Open-Meteo returns km/h or m/s; normalize to m/s
          liveWindSpeed = weatherData.wind_speed_10m > 30 ? (weatherData.wind_speed_10m / 3.6) : weatherData.wind_speed_10m;
        }
        if (typeof weatherData.wind_direction_10m === 'number') {
          liveWindDir = weatherData.wind_direction_10m;
        }
        // Compute atmospheric stability from wind speed
        if (liveWindSpeed < 2.0) liveStability = 'B';
        else if (liveWindSpeed < 4.0) liveStability = 'C';
        else liveStability = 'D';
      } catch (wErr) {
        console.warn('[DispersionLayer] Weather proxy fallback:', wErr?.message);
      }

      // 2. Run Gaussian Atmospheric Dispersion Model with live meteorology
      const plumeResult = await sriVisionApi.simulatePlume({
        originLat: lat,
        originLon: lon,
        windSpeedMs: liveWindSpeed,
        windDirectionDegrees: liveWindDir,
        emissionRateGPerSec,
        stabilityClass: liveStability,
        chemicalName: chem.name,
        thresholds: chem.thresholds,
      });

      if (!plumeResult?.success && !plumeResult?.data) return null;

      const plumeData = plumeResult.data || plumeResult || {};
      const geojson = plumeData.geojson_footprint;

      if (geojson && geojson.features) {
        for (const feat of geojson.features) {
          const coords = feat.geometry?.coordinates?.[0] || [];
          if (!coords.length) continue;

          const flatCoords = [];
          for (const [fLon, fLat] of coords) {
            flatCoords.push(fLon, fLat);
          }

          const level = feat.properties?.level || 'ADVISORY';
          let polyColor = Cesium.Color.fromCssColorString('#ffcc00').withAlpha(0.25); // Advisory
          if (level === 'CRITICAL' || level === 'LETHAL') {
            polyColor = Cesium.Color.fromCssColorString('#ff0033').withAlpha(0.55); // IDLH / Critical
          } else if (level === 'EVACUATE' || level === 'HIGH') {
            polyColor = Cesium.Color.fromCssColorString('#ff8800').withAlpha(0.40); // Evacuate
          }

          const isoplethEntity = this.dataSource.entities.add({
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flatCoords),
              material: polyColor,
              outline: true,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1.5,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          });
          this.activePlumeEntities.push(isoplethEntity);
        }
      }

      const normalizedHazard = normalizePlumeDispersion({
        ...plumeData,
        facility_name: facilityName,
        weather: weatherData,
      });

      super.onSelect(normalizedHazard);
      return normalizedHazard;

    } catch (err) {
      console.warn('[DispersionLayer] Plume simulation failed:', err);
      return null;
    }
  }

  /**
   * On selecting a plume release scenario, compute and render Gaussian Plume isopleths.
   */
  async onSelect(hazardContract) {
    if (hazardContract.hazard_type !== 'CHEMICAL_PLUME') return;
    const lat = hazardContract.location.latitude;
    const lon = hazardContract.location.longitude;
    const chemKey = hazardContract.raw_payload?.chemical || 'AMMONIA';
    const facilityName = hazardContract.title || 'Industrial Facility';
    await this.simulatePlumeAt(lat, lon, { chemical: chemKey, facilityName });
  }

  clearPlumeEntities() {
    for (const ent of this.activePlumeEntities) {
      this.dataSource.entities.remove(ent);
    }
    this.activePlumeEntities = [];
  }

  destroy() {
    this.clearPlumeEntities();
    super.destroy();
  }
}
