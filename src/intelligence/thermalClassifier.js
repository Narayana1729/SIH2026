/**
 * @module src/intelligence/thermalClassifier
 * @description Rule-Based Multi-Source Thermal Anomaly Classifier & Segregation Engine.
 *
 * Uses domain-expert heuristics (spatial proximity to industrial facilities,
 * NDVI vegetation thresholds, FRP intensity ranges, and land-cover inference)
 * to segregate thermal anomalies into discrete hazard categories.
 *
 * NOTE: Confidence scores are expert-calibrated heuristic weights, NOT
 * statistically validated model outputs. Future: replace with trained ML
 * classifier from the ml/ pipeline for validated probabilistic predictions.
 *
 * Implements the core challenge deliverables:
 *   1. Segregates Industrial Fires / Explosions from Forest Wildfires, Crop Stubble, and Mining.
 *   2. Distinguishes Persistent Operational Flaring from Catastrophic Accidental Fires.
 *   3. Enriches detections with Land-Cover (LULC), HazMat profiles, and Tactical Evacuation Radii.
 */

import { findFacilitiesNearby, getAllFacilities } from '../disasters/industrial/industrialFacilities.js';
import { haversineDistanceKm } from '../core/geospatial.js';

export const ThermalCategories = {
  INDUSTRIAL_FLARE: 'INDUSTRIAL_FLARE',           // Controlled hydrocarbon flare stack at refinery / petrochem facility
  INDUSTRIAL_PROCESS: 'INDUSTRIAL_PROCESS',       // Industrial thermal power plant, steel mill, blast furnace, boiler, kiln
  INDUSTRIAL_DISASTER: 'INDUSTRIAL_DISASTER',     // Accidental fire, tank explosion, gas leak ignition, major thermal surge
  FOREST_WILDFIRE: 'FOREST_WILDFIRE',             // Vegetation / canopy wildfire in forest or woodland
  AGRICULTURAL_BURNING: 'AGRICULTURAL_BURNING',   // Seasonal crop residue / stubble burning in farmland
  MINING_SMELTING: 'MINING_SMELTING',             // Open-cast coal seam fires, slag dumps, metallurgical smelters
  UNKNOWN_ANOMALY: 'UNKNOWN_ANOMALY',             // Unclassified / low-confidence thermal anomaly
};

export class ThermalAnomalyClassifier {
  constructor(options = {}) {
    this.industrialBufferKm = options.industrialBufferKm || 5.0; // Max radius for industrial association (refineries/plants/mines)
    this.miningBufferKm = options.miningBufferKm || 6.0;
    this.flareFrpThreshold = options.flareFrpThreshold || 80.0;  // High FRP at industrial site indicates disaster vs regular flare
  }

  /**
   * Classify a single thermal anomaly record into a discrete hazard category.
   *
   * @param {object} anomaly
   * @param {number} anomaly.latitude
   * @param {number} anomaly.longitude
   * @param {number} [anomaly.frp=15] - Fire Radiative Power in MW
   * @param {number} [anomaly.brightness=320] - Brightness temperature in Kelvin
   * @param {number|string} [anomaly.confidence=80] - Detection confidence (0-100 or 'l'/'n'/'h')
   * @param {string} [anomaly.daynight='D'] - 'D' (Day) or 'N' (Night)
   * @param {number} [anomaly.ndvi] - Normalized Difference Vegetation Index (-1 to 1)
   * @param {number} [anomaly.historicalPersistence] - Persistence ratio (0.0 to 1.0)
   * @param {string} [anomaly.landCover] - 'forest' | 'cropland' | 'industrial' | 'urban' | 'bare'
   * @returns {object} Full classification verdict with explainable evidence
   */
  classify(anomaly) {
    const lat = Number(anomaly.latitude ?? anomaly.lat) || 0;
    const lon = Number(anomaly.longitude ?? anomaly.lon) || 0;
    const frp = Number(anomaly.frp) || 15;
    const brightness = Number(anomaly.brightness ?? anomaly.bright_ti4 ?? anomaly.bright_ti5) || 320;
    const daynight = String(anomaly.daynight || 'D').toUpperCase();
    const persistence = Number(anomaly.historicalPersistence ?? anomaly.persistenceRatio) || 0.0;
    const ndvi = Number.isFinite(anomaly.ndvi) ? Number(anomaly.ndvi) : this._estimateNdviFromCoords(lat, lon);
    const lulc = anomaly.landCover || this._inferLandCover(ndvi);

    // 1. Spatial Cross-Referencing with Industrial Facilities Database
    const nearbyFacilities = findFacilitiesNearby(lat, lon, 15.0); // 15km search radius
    const primaryFacility = nearbyFacilities.length > 0 ? nearbyFacilities[0] : null;
    const distanceToFacilityKm = primaryFacility ? primaryFacility.distance_km : 999.0;

    let category = ThermalCategories.UNKNOWN_ANOMALY;
    let confidence = 0.50;
    let severity = 'LOW';
    let isAccident = false;
    const evidence = [];

    // 2. Decision Logic Pipeline

    // Filter out non-thermal facilities (Hydro, Solar, Wind)
    const isThermalFacility = (fac) => {
      if (!fac) return false;
      const s = (fac.sector || '').toLowerCase();
      return !s.includes('hydro') && !s.includes('solar') && !s.includes('wind');
    };

    const thermalFacility = isThermalFacility(primaryFacility) ? primaryFacility : (nearbyFacilities.find(isThermalFacility) || null);
    const distThermalKm = thermalFacility ? thermalFacility.distance_km : 999.0;

    // ── Case A: Forest Wildfire (Dense canopy / forest land-cover) ──
    if ((lulc === 'forest' || ndvi >= 0.48) && distThermalKm > 3.0) {
      category = ThermalCategories.FOREST_WILDFIRE;
      confidence = 0.89;
      severity = frp > 100 ? 'CRITICAL' : frp > 40 ? 'HIGH' : 'MEDIUM';
      evidence.push({
        factor: 'Dense Forest Biomass & Canopy Fuel',
        detail: `High vegetative density (NDVI: ${ndvi.toFixed(2)}) located ${distThermalKm.toFixed(1)} km away from industrial infrastructure`,
        weight: 0.88,
      });
    }
    // ── Case B: Industrial Domain (within industrial buffer of thermal plant or industrial LULC) ──
    else if ((thermalFacility && distThermalKm <= 8.0) || lulc === 'industrial') {
      const facSector = (thermalFacility?.sector || '').toLowerCase();
      const facName = (thermalFacility?.name || '').toLowerCase();
      const facType = (thermalFacility?.type || '').toLowerCase();

      // Differentiate thermal power generation utilities from actual mineral extraction / mining sites
      const isPowerPlant = facSector.includes('power') || facType.includes('power') || facName.includes('power') || facName.includes('tpp') || facName.includes('tps');

      const isMiningOrMetallurgy = !isPowerPlant && (
        facSector.includes('mining') ||
        facSector.includes('smelter') ||
        facSector.includes('metallurgy') ||
        facType.includes('mining') ||
        facName.includes('mine') ||
        facName.includes('colliery') ||
        facName.includes('coalfield') ||
        facName.includes('ocp') ||
        facName.includes('quarry')
      );

      const isOilGasOrRefinery = facSector.includes('refinery') ||
                                 facSector.includes('petro') ||
                                 facSector.includes('oil') ||
                                 facSector.includes('gas') ||
                                 facName.includes('refinery') ||
                                 facName.includes('petro') ||
                                 facName.includes('cracker') ||
                                 facName.includes('gas');

      if (isMiningOrMetallurgy) {
        category = ThermalCategories.MINING_SMELTING;
        confidence = 0.88;
        severity = frp > 120 ? 'HIGH' : 'MEDIUM';
        evidence.push({
          factor: 'Mining & Smelting Proximity',
          detail: `Located ${distThermalKm.toFixed(2)} km from ${thermalFacility.name} (${thermalFacility.sector})`,
          weight: 0.90,
        });
      } else {
        // Distinguish Normal Operational Heat vs Accidental Explosion/Fire
        const isHighSurge = frp > this.flareFrpThreshold || brightness > 365;
        const isNightTimeSurge = daynight === 'N' && frp > 60;

        if (isHighSurge || isNightTimeSurge || (persistence < 0.20 && frp > 50)) {
          // Sudden catastrophic event at an industrial site
          category = ThermalCategories.INDUSTRIAL_DISASTER;
          confidence = 0.92;
          severity = frp > 150 ? 'CRITICAL' : 'HIGH';
          isAccident = true;
          evidence.push({
            factor: 'Industrial Thermal Surge / Explosion Signature',
            detail: `Extreme thermal energy (FRP: ${frp.toFixed(1)} MW, Brightness: ${brightness.toFixed(1)} K) within ${distThermalKm.toFixed(2)} km of ${thermalFacility?.name || 'industrial facility'}`,
            weight: 0.95,
          });
        } else if (isOilGasOrRefinery) {
          // Controlled Hydrocarbon Gas Flaring (Refinery / Petrochemical / Oil & Gas)
          category = ThermalCategories.INDUSTRIAL_FLARE;
          confidence = 0.88;
          severity = 'LOW';
          evidence.push({
            factor: 'Controlled Hydrocarbon Gas Flaring',
            detail: `Operational flare stack (FRP: ${frp.toFixed(1)} MW) at registered ${thermalFacility?.sector || 'refinery / petrochemical'} (${thermalFacility?.name || 'facility'})`,
            weight: 0.88,
          });
        } else {
          // Continuous Industrial Process Heat / Power Generation (Thermal Power Plant / Steel Mill / Manufacturing)
          category = ThermalCategories.INDUSTRIAL_PROCESS;
          confidence = 0.85;
          severity = 'LOW';
          evidence.push({
            factor: 'Industrial Power / Process Heat',
            detail: `Operational combustion heat (FRP: ${frp.toFixed(1)} MW) at registered ${thermalFacility?.sector || 'industrial facility'} (${thermalFacility?.name || 'facility'})`,
            weight: 0.85,
          });
        }
      }
    }
    // ── Case C: Industrial Corridor Proximity (within 8-15km of registered thermal plant) ──
    else if (thermalFacility && distThermalKm <= 15.0 && !this._isCoreAgriculturalStubbleZone(lat, lon)) {
      const facSector = (thermalFacility.sector || '').toLowerCase();
      const facName = (thermalFacility.name || '').toLowerCase();
      const isPowerPlant = facSector.includes('power') || facName.includes('power') || facName.includes('tpp') || facName.includes('tps');
      const isMining = !isPowerPlant && (
        facSector.includes('smelter') ||
        facSector.includes('mining') ||
        facSector.includes('metallurgy') ||
        facName.includes('mine') ||
        facName.includes('colliery') ||
        facName.includes('coalfield') ||
        facName.includes('ocp')
      );
      const isOilGas = facSector.includes('refinery') || facSector.includes('petro') || facSector.includes('oil') || facSector.includes('gas');

      if (isMining) {
        category = ThermalCategories.MINING_SMELTING;
      } else if (isOilGas) {
        category = ThermalCategories.INDUSTRIAL_FLARE;
      } else {
        category = ThermalCategories.INDUSTRIAL_PROCESS;
      }

      confidence = 0.80;
      severity = 'LOW';
      evidence.push({
        factor: 'Industrial Corridor Process Heat',
        detail: `Thermal anomaly located ${distThermalKm.toFixed(1)} km from ${thermalFacility.name} (${thermalFacility.sector})`,
        weight: 0.82,
      });
    }
    // ── Case D: Agricultural Stubble / Crop Residue Burning (Verified cropland away from industrial hubs) ──
    else if ((lulc === 'cropland' || (ndvi >= 0.18 && ndvi < 0.42)) && distThermalKm > 8.0) {
      category = ThermalCategories.AGRICULTURAL_BURNING;
      confidence = 0.82;
      severity = frp > 60 ? 'MEDIUM' : 'LOW';
      evidence.push({
        factor: 'Agricultural Land-Cover Context',
        detail: `Cropland/Farmland spectral profile (NDVI: ${ndvi.toFixed(2)}) located ${distThermalKm.toFixed(1)} km from industrial infrastructure with low-to-moderate FRP (${frp.toFixed(1)} MW)`,
        weight: 0.80,
      });
    }
    // ── Case E: Fallback / Sparse Vegetation ──
    else {
      category = (thermalFacility && distThermalKm <= 20.0)
        ? ThermalCategories.INDUSTRIAL_FLARE
        : (frp > 50 ? ThermalCategories.FOREST_WILDFIRE : ThermalCategories.AGRICULTURAL_BURNING);
      confidence = 0.68;
      severity = frp > 50 ? 'MEDIUM' : 'LOW';
      evidence.push({
        factor: thermalFacility && distThermalKm <= 20.0 ? 'Industrial Corridor Thermal Anomaly' : 'Unzoned Open Landscape Anomaly',
        detail: `Thermal detection (NDVI: ${ndvi.toFixed(2)}, FRP: ${frp.toFixed(1)} MW, Dist to Facility: ${distThermalKm.toFixed(1)} km)`,
        weight: 0.70,
      });
    }

    // Determine tactical recommendations
    const tacticalAction = this._generateTacticalAction(category, primaryFacility, frp, severity);

    return {
      category,
      categoryLabel: this._getCategoryLabel(category),
      confidence: Math.round(confidence * 100) / 100,
      severity,
      isAccidentalDisaster: isAccident,
      coordinates: { latitude: lat, longitude: lon },
      telemetry: {
        frp: Math.round(frp * 10) / 10,
        brightness: Math.round(brightness * 10) / 10,
        daynight,
        ndvi: Math.round(ndvi * 100) / 100,
        landCover: lulc,
      },
      facilityMatch: primaryFacility
        ? {
            id: primaryFacility.id,
            name: primaryFacility.name,
            sector: primaryFacility.sector,
            distanceKm: primaryFacility.distance_km,
            isolationRadiusMeters: primaryFacility.isolation_distance_meters || 500,
            hazardRating: primaryFacility.hazard_rating,
          }
        : null,
      evidence,
      tacticalAction,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Batch classify a list of active FIRMS thermal records and generate segregated GeoJSON overlays.
   *
   * @param {Array<object>} fireRecords
   * @returns {object} Segregated collections categorized by hazard type
   */
  classifyBatch(fireRecords = []) {
    const classified = fireRecords.map((r) => this.classify(r));

    const summary = {
      total: classified.length,
      industrialFlares: 0,
      industrialDisasters: 0,
      wildfires: 0,
      agricultural: 0,
      mining: 0,
    };

    const featuresByCategory = {
      [ThermalCategories.INDUSTRIAL_FLARE]: [],
      [ThermalCategories.INDUSTRIAL_DISASTER]: [],
      [ThermalCategories.FOREST_WILDFIRE]: [],
      [ThermalCategories.AGRICULTURAL_BURNING]: [],
      [ThermalCategories.MINING_SMELTING]: [],
      [ThermalCategories.UNKNOWN_ANOMALY]: [],
    };

    for (const item of classified) {
      if (item.category === ThermalCategories.INDUSTRIAL_FLARE) summary.industrialFlares++;
      else if (item.category === ThermalCategories.INDUSTRIAL_DISASTER) summary.industrialDisasters++;
      else if (item.category === ThermalCategories.FOREST_WILDFIRE) summary.wildfires++;
      else if (item.category === ThermalCategories.AGRICULTURAL_BURNING) summary.agricultural++;
      else if (item.category === ThermalCategories.MINING_SMELTING) summary.mining++;

      featuresByCategory[item.category].push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.coordinates.longitude, item.coordinates.latitude],
        },
        properties: {
          category: item.category,
          categoryLabel: item.categoryLabel,
          severity: item.severity,
          confidence: item.confidence,
          frp: item.telemetry.frp,
          facility: item.facilityMatch?.name || null,
          sector: item.facilityMatch?.sector || null,
          isolationRadiusMeters: item.facilityMatch?.isolationRadiusMeters || null,
          tacticalAction: item.tacticalAction,
          timestamp: item.timestamp,
        },
      });
    }

    return {
      status: 'ok',
      summary,
      classified,
      geoJsonLayers: {
        industrialDisasters: { type: 'FeatureCollection', features: featuresByCategory[ThermalCategories.INDUSTRIAL_DISASTER] },
        industrialFlares: { type: 'FeatureCollection', features: featuresByCategory[ThermalCategories.INDUSTRIAL_FLARE] },
        wildfires: { type: 'FeatureCollection', features: featuresByCategory[ThermalCategories.FOREST_WILDFIRE] },
        agricultural: { type: 'FeatureCollection', features: featuresByCategory[ThermalCategories.AGRICULTURAL_BURNING] },
        mining: { type: 'FeatureCollection', features: featuresByCategory[ThermalCategories.MINING_SMELTING] },
      },
    };
  }

  /**
   * Coarse land-cover heuristic from NDVI alone.
   * LIMITATION: Real LULC classification requires multi-band spectral analysis
   * (e.g., Sentinel-2 Scene Classification). This is a first-order approximation
   * used as a fallback when no authoritative LULC data is available.
   */
  _inferLandCover(ndvi) {
    if (ndvi >= 0.45) return 'forest';
    if (ndvi >= 0.20) return 'cropland';
    if (ndvi >= 0.08) return 'grassland';
    return 'industrial';
  }

  /**
   * Static regional NDVI proxy — NOT live satellite-derived vegetation index.
   * Returns a climatological average NDVI for broad Indian geographic zones.
   * LIMITATION: Does not reflect seasonal variation, recent burns, or land-use change.
   * Future: integrate Sentinel-2 NDVI tile service or MODIS 16-day composite API.
   */
  _estimateNdviFromCoords(lat, lon) {
    // Climatological regional NDVI approximation (Indian subcontinent)
    if (lat >= 8.0 && lat <= 14.0 && lon >= 74.0 && lon <= 77.5) return 0.65; // Western Ghats
    if (lat >= 28.0 && lat <= 32.5 && lon >= 74.0 && lon <= 78.5) return 0.28; // Punjab/Haryana/North UP agricultural belt
    if (lat >= 20.0 && lat <= 28.0 && lon >= 88.0 && lon <= 96.0) return 0.58; // Northeast Forests
    return 0.35; // Standard baseline
  }

  _isCoreAgriculturalStubbleZone(lat, lon) {
    // Verified intensive crop residue burning belt (Punjab, Haryana, Western UP, Tarai)
    return lat >= 28.0 && lat <= 32.5 && lon >= 74.0 && lon <= 79.5;
  }

  _getCategoryLabel(category) {
    switch (category) {
      case ThermalCategories.INDUSTRIAL_FLARE:
        return 'Refinery / Gas Flare Stack';
      case ThermalCategories.INDUSTRIAL_PROCESS:
        return 'Industrial Power / Process Heat';
      case ThermalCategories.INDUSTRIAL_DISASTER:
        return 'Industrial Accidental Fire / Explosion';
      case ThermalCategories.FOREST_WILDFIRE:
        return 'Forest Wildfire';
      case ThermalCategories.AGRICULTURAL_BURNING:
        return 'Agricultural Stubble Burning';
      case ThermalCategories.MINING_SMELTING:
        return 'Mining & Smelting Thermal Activity';
      default:
        return 'Unclassified Thermal Source';
    }
  }

  _generateTacticalAction(category, facility, frp, severity) {
    if (category === ThermalCategories.INDUSTRIAL_DISASTER) {
      const radius = facility?.isolation_distance_meters || 800;
      return `CRITICAL: Trigger Emergency HazMat Protocol. Enforce ${radius}m initial isolation perimeter around ${facility?.name || 'industrial facility'}. Deploy NDRF HazMat battalion and monitor downwind atmospheric toxic dispersion.`;
    }
    if (category === ThermalCategories.INDUSTRIAL_FLARE) {
      return `NOMINAL: Operational process heat / controlled gas flaring at ${facility?.name || 'refinery / petrochemical facility'}. Maintain continuous emission monitoring.`;
    }
    if (category === ThermalCategories.INDUSTRIAL_PROCESS) {
      return `NOMINAL: Industrial power generation / process heat at ${facility?.name || 'industrial complex'}. Standard operational envelope.`;
    }
    if (category === ThermalCategories.FOREST_WILDFIRE) {
      return `ALERT: Active forest fire. Dispatch Forestry Rapid Response Unit, execute Rothermel rate-of-spread modeling, and establish containment firebreaks.`;
    }
    if (category === ThermalCategories.AGRICULTURAL_BURNING) {
      return `MONITOR: Crop residue open-field burning detected. Check local air quality index (AQI) thresholds and agricultural burning regulations.`;
    }
    if (category === ThermalCategories.MINING_SMELTING) {
      return `MONITOR: Active mining/metallurgy thermal source. Verify site boundary permits and ventilation controls.`;
    }
    return 'Review high-resolution optical imagery pass.';
  }
}

export const defaultThermalClassifier = new ThermalAnomalyClassifier();

export function classifyThermalIncident(anomaly, facilities) {
  return defaultThermalClassifier.classify(anomaly);
}
