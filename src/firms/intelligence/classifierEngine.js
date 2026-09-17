/**
 * @module src/firms/intelligence/classifierEngine
 * @description SIH Thermal Anomaly Multi-Class Classifier & Industrial Segregation Engine.
 *
 * Implements strict separation between:
 *   - Observed Satellite Telemetry (lat, lon, brightness, FRP, acquisition time, confidence, satellite, instrument, day/night)
 *   - Derived Intelligence (industrial proximity, land-cover, persistence, primary/secondary classification, confidence, basis)
 */

import {
  PrimaryClassification,
  IndustrialSubtype,
  NonIndustrialSubtype,
  FacilityType,
  RiskLevel,
} from '../domain/constants.js';
import { defaultFacilityContext } from '../context/facilityContext.js';
import { defaultPersistenceEngine } from './persistenceEngine.js';

export class ThermalClassifierEngine {
  constructor(options = {}) {
    this.facilityBufferKm = options.facilityBufferKm || 5.0; // Max radius for industrial association
    this.miningBufferKm = options.miningBufferKm || 6.0;
    this.flareFrpThreshold = options.flareFrpThreshold || 75.0; // High FRP threshold for accidental fire vs routine flaring
  }

  /**
   * Classifies a normalized FIRMS detection into primary and secondary categories.
   *
   * @param {object} detection - Normalized detection with `observed` object or flat properties
   * @returns {object} Standardized GIS Event Object with observed telemetry and derived intelligence
   */
  classifyEvent(detection) {
    // 1. Extract Observed Telemetry
    const obs = detection.observed || detection;
    const lat = Number(obs.latitude ?? obs.lat) || 0;
    const lon = Number(obs.longitude ?? obs.lon) || 0;
    const brightnessK = Number(obs.brightness_temp_k ?? obs.brightness ?? obs.bright_ti4 ?? obs.temp) || 320.0;
    const frpMw = Number(obs.frp_mw ?? obs.frp) || 10.0;
    const confidencePct = Number(obs.confidence_pct ?? obs.confidence) || 70.0;
    const timestamp = obs.acquisition_time || obs.timestamp || new Date().toISOString();
    const daynight = String(obs.daynight || 'D').toUpperCase();
    const satellite = obs.satellite || 'NOAA-20';
    const instrument = obs.instrument || 'VIIRS';

    const eventId = detection.detection_id || `thermal_event_${lat.toFixed(4)}_${lon.toFixed(4)}_${timestamp.replace(/[:.-]/g, '')}`;

    // 2. Extract Spatial & Land-Cover Context
    const isThermal = (f) => {
      const sec = (f.sector || '').toLowerCase();
      return !sec.includes('hydro') && !sec.includes('solar') && !sec.includes('wind');
    };
    const rawNearby = defaultFacilityContext.findNearby(lat, lon, 15.0);
    const nearbyFacilities = rawNearby.filter(isThermal);
    const matchedFacility = nearbyFacilities.length > 0 ? nearbyFacilities[0] : null;
    const distanceToFacilityKm = matchedFacility ? matchedFacility.distance_km : 999.0;
    const landCoverCtx = defaultFacilityContext.getLandCoverContext(lat, lon, obs.ndvi);

    // 3. Extract Temporal Persistence Context
    const persistenceCtx = defaultPersistenceEngine.evaluatePersistence(lat, lon, frpMw);

    // 4. Multi-Stage Inference Engine
    let primary = PrimaryClassification.UNKNOWN;
    let secondary = null;
    let classificationConfidence = 0.50;
    let riskLevel = RiskLevel.LOW;
    const basis = [];

    const isDenseForest = landCoverCtx.land_cover === 'forest' || (obs.ndvi != null && obs.ndvi >= 0.45);
    const isInsideIndustrialBuffer = matchedFacility && distanceToFacilityKm <= (this.facilityBufferKm || 8.0) && !isDenseForest;
    const isInsideMiningBuffer = matchedFacility && (matchedFacility.facility_type === FacilityType.MINING_SITE || matchedFacility.sector?.toLowerCase().includes('smelter')) && distanceToFacilityKm <= (this.miningBufferKm || 10.0);

    // ── Branch 1: DENSE FOREST WILDFIRE ──
    if (isDenseForest && distanceToFacilityKm > 3.0) {
      primary = PrimaryClassification.NON_INDUSTRIAL;
      secondary = NonIndustrialSubtype.WILDFIRE;
      classificationConfidence = 0.90;
      riskLevel = frpMw > 100 ? RiskLevel.CRITICAL : frpMw > 40 ? RiskLevel.HIGH : RiskLevel.MEDIUM;
      basis.push({
        feature: 'forest_canopy_biomass',
        description: `Dense vegetative canopy fuel (NDVI: ${landCoverCtx.ndvi}) located ${distanceToFacilityKm.toFixed(1)} km from industrial infrastructure`,
        weight: 0.89,
      });
    }
    // ── Branch 2: INDUSTRIAL ──
    else if (isInsideIndustrialBuffer || isInsideMiningBuffer) {
      primary = PrimaryClassification.INDUSTRIAL;
      basis.push({
        feature: 'facility_proximity',
        description: `Located ${distanceToFacilityKm.toFixed(2)} km from ${matchedFacility.name} (${matchedFacility.facility_type || matchedFacility.sector})`,
        weight: 0.95,
      });

      if (matchedFacility.facility_type === FacilityType.MINING_SITE || isInsideMiningBuffer) {
        secondary = IndustrialSubtype.MINING_THERMAL_ACTIVITY;
        classificationConfidence = 0.88;
        riskLevel = frpMw > 100 ? RiskLevel.HIGH : RiskLevel.MEDIUM;
        basis.push({
          feature: 'mining_corridor',
          description: `Active thermal activity within ${matchedFacility.name} boundary`,
          weight: 0.85,
        });
      } else if (matchedFacility.facility_type === FacilityType.OIL_REFINERY ||
                 matchedFacility.facility_type === FacilityType.PETROCHEMICAL_COMPLEX ||
                 matchedFacility.facility_type === FacilityType.KNOWN_FLARE) {

        // Distinguish Gas Flare / Process Heat vs Accidental Fire
        const isAbnormalSurge = persistenceCtx.is_abnormal_surge || frpMw > this.flareFrpThreshold || brightnessK > 365.0;

        if (isAbnormalSurge) {
          secondary = IndustrialSubtype.INDUSTRIAL_FIRE;
          classificationConfidence = 0.93;
          riskLevel = frpMw > 150 ? RiskLevel.CRITICAL : RiskLevel.HIGH;
          basis.push({
            feature: 'abnormal_thermal_surge',
            description: `Extreme thermal intensity (FRP: ${frpMw.toFixed(1)} MW, Brightness: ${brightnessK.toFixed(1)} K, Surge Ratio: ${persistenceCtx.surge_ratio}x) indicating potential industrial fire/explosion`,
            weight: 0.96,
          });
        } else {
          secondary = IndustrialSubtype.GAS_FLARE;
          classificationConfidence = 0.89;
          riskLevel = RiskLevel.LOW;
          basis.push({
            feature: 'persistent_flare_signature',
            description: `Expected controlled hydrocarbon flaring at ${matchedFacility.name} (FRP: ${frpMw.toFixed(1)} MW)`,
            weight: 0.90,
          });
        }
      } else if (matchedFacility.facility_type === FacilityType.THERMAL_POWER_PLANT ||
                 matchedFacility.facility_type === FacilityType.STEEL_PLANT ||
                 matchedFacility.facility_type === FacilityType.CEMENT_PLANT) {

        const isSurge = frpMw > 100 || persistenceCtx.is_abnormal_surge;
        if (isSurge) {
          secondary = IndustrialSubtype.INDUSTRIAL_FIRE;
          classificationConfidence = 0.91;
          riskLevel = RiskLevel.HIGH;
          basis.push({
            feature: 'plant_fire_anomaly',
            description: `Abnormal thermal surge detected at ${matchedFacility.facility_type}`,
            weight: 0.92,
          });
        } else {
          secondary = IndustrialSubtype.PROCESS_HEAT_SOURCE;
          classificationConfidence = 0.86;
          riskLevel = RiskLevel.LOW;
          basis.push({
            feature: 'process_heat',
            description: `Routine furnace / boiler process heat at ${matchedFacility.name}`,
            weight: 0.88,
          });
        }
      } else {
        secondary = frpMw > 60 ? IndustrialSubtype.INDUSTRIAL_FIRE : IndustrialSubtype.INDUSTRIAL_THERMAL_SOURCE;
        classificationConfidence = 0.80;
        riskLevel = frpMw > 60 ? RiskLevel.HIGH : RiskLevel.MEDIUM;
      }
    }
    // ── Branch 3: NON_INDUSTRIAL ──
    else {
      primary = PrimaryClassification.NON_INDUSTRIAL;

      if (matchedFacility && distanceToFacilityKm <= 15.0 && !landCoverCtx.land_cover?.includes('cropland')) {
        primary = PrimaryClassification.INDUSTRIAL;
        secondary = IndustrialSubtype.PROCESS_HEAT_SOURCE;
        classificationConfidence = 0.82;
        riskLevel = RiskLevel.LOW;
        basis.push({
          feature: 'industrial_corridor',
          description: `Industrial corridor thermal source within ${distanceToFacilityKm.toFixed(1)} km of ${matchedFacility.name}`,
          weight: 0.85,
        });
      } else if (landCoverCtx.land_cover === 'cropland' && distanceToFacilityKm > 8.0) {
        secondary = NonIndustrialSubtype.AGRICULTURAL_BURNING;
        classificationConfidence = 0.85;
        riskLevel = frpMw > 50 ? RiskLevel.MEDIUM : RiskLevel.LOW;
        basis.push({
          feature: 'agricultural_land_cover',
          description: `Cropland/Farmland spectral context (NDVI: ${landCoverCtx.ndvi}) located ${distanceToFacilityKm.toFixed(1)} km from industrial infrastructure characteristic of agricultural stubble burning`,
          weight: 0.84,
        });
      } else if (landCoverCtx.land_cover === 'forest' || landCoverCtx.ndvi >= 0.45) {
        secondary = NonIndustrialSubtype.WILDFIRE;
        classificationConfidence = 0.90;
        riskLevel = frpMw > 100 ? RiskLevel.CRITICAL : frpMw > 40 ? RiskLevel.HIGH : RiskLevel.MEDIUM;
        basis.push({
          feature: 'forest_canopy_biomass',
          description: `Dense vegetative canopy fuel (NDVI: ${landCoverCtx.ndvi}) located ${distanceToFacilityKm.toFixed(1)} km from industrial infrastructure`,
          weight: 0.89,
        });
      } else {
        secondary = frpMw > 50 ? NonIndustrialSubtype.WILDFIRE : NonIndustrialSubtype.VEGETATION_FIRE;
        classificationConfidence = 0.72;
        riskLevel = frpMw > 50 ? RiskLevel.MEDIUM : RiskLevel.LOW;
        basis.push({
          feature: 'open_vegetation_anomaly',
          description: `Unzoned terrain thermal anomaly (NDVI: ${landCoverCtx.ndvi}, FRP: ${frpMw.toFixed(1)} MW)`,
          weight: 0.70,
        });
      }
    }

    // 5. Assemble Standardized GIS Event Object
    return {
      event_id: eventId,
      observed: {
        latitude: lat,
        longitude: lon,
        brightness_temp_k: brightnessK,
        frp_mw: frpMw,
        confidence_pct: confidencePct,
        acquisition_time: timestamp,
        satellite,
        instrument,
        daynight,
      },
      derived_intelligence: {
        industrial_status: primary,
        classification: primary,
        subclassification: secondary,
        classification_confidence: Math.round(classificationConfidence * 100) / 100,
        risk_level: riskLevel,
        facility: matchedFacility
          ? {
              facility_id: matchedFacility.facility_id,
              name: matchedFacility.name,
              facility_type: matchedFacility.facility_type,
              distance_km: matchedFacility.distance_km,
              isolation_distance_meters: matchedFacility.isolation_distance_meters,
              hazard_rating: matchedFacility.hazard_rating,
            }
          : null,
        land_cover: landCoverCtx.land_cover,
        ndvi: landCoverCtx.ndvi,
        persistence: {
          is_persistent: persistenceCtx.is_persistent_source,
          persistence_score: persistenceCtx.persistence_score,
          detection_count: persistenceCtx.detection_count,
          surge_ratio: persistenceCtx.surge_ratio,
          is_abnormal_surge: persistenceCtx.is_abnormal_surge,
        },
        basis,
      },
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      timestamp,
    };
  }

  /**
   * Batch process and segregate an array of thermal detections.
   *
   * @param {Array<object>} detections
   * @returns {object} Segregated collections and summary metrics
   */
  classifyBatch(detections = []) {
    // Process spatial persistence clustering first
    defaultPersistenceEngine.processDetections(detections);

    const classified = detections.map((d) => this.classifyEvent(d));

    const summary = {
      total: classified.length,
      industrial: {
        total: 0,
        industrial_fires: 0,
        gas_flares: 0,
        process_heat_sources: 0,
        mining_activity: 0,
        other: 0,
      },
      non_industrial: {
        total: 0,
        wildfires: 0,
        agricultural_burning: 0,
        vegetation_fires: 0,
        other: 0,
      },
      persistent_sources_count: 0,
      abnormal_surges_count: 0,
    };

    const industrialEvents = [];
    const nonIndustrialEvents = [];

    for (const evt of classified) {
      const der = evt.derived_intelligence;
      if (der.persistence.is_persistent) summary.persistent_sources_count++;
      if (der.persistence.is_abnormal_surge) summary.abnormal_surges_count++;

      if (der.industrial_status === PrimaryClassification.INDUSTRIAL) {
        summary.industrial.total++;
        if (der.subclassification === IndustrialSubtype.INDUSTRIAL_FIRE) summary.industrial.industrial_fires++;
        else if (der.subclassification === IndustrialSubtype.GAS_FLARE) summary.industrial.gas_flares++;
        else if (der.subclassification === IndustrialSubtype.PROCESS_HEAT_SOURCE) summary.industrial.process_heat_sources++;
        else if (der.subclassification === IndustrialSubtype.MINING_THERMAL_ACTIVITY) summary.industrial.mining_activity++;
        else summary.industrial.other++;

        industrialEvents.push(evt);
      } else {
        summary.non_industrial.total++;
        if (der.subclassification === NonIndustrialSubtype.WILDFIRE) summary.non_industrial.wildfires++;
        else if (der.subclassification === NonIndustrialSubtype.AGRICULTURAL_BURNING) summary.non_industrial.agricultural_burning++;
        else if (der.subclassification === NonIndustrialSubtype.VEGETATION_FIRE) summary.non_industrial.vegetation_fires++;
        else summary.non_industrial.other++;

        nonIndustrialEvents.push(evt);
      }
    }

    return {
      status: 'ok',
      summary,
      events: classified,
      segregated: {
        industrial_events: industrialEvents,
        non_industrial_events: nonIndustrialEvents,
      },
      geojson: {
        type: 'FeatureCollection',
        features: classified.map((evt) => ({
          type: 'Feature',
          geometry: evt.geometry,
          properties: {
            event_id: evt.event_id,
            timestamp: evt.timestamp,
            frp_mw: evt.observed.frp_mw,
            brightness_temp_k: evt.observed.brightness_temp_k,
            confidence_pct: evt.observed.confidence_pct,
            industrial_status: evt.derived_intelligence.industrial_status,
            classification: evt.derived_intelligence.classification,
            subclassification: evt.derived_intelligence.subclassification,
            classification_confidence: evt.derived_intelligence.classification_confidence,
            facility_name: evt.derived_intelligence.facility?.name || null,
            facility_type: evt.derived_intelligence.facility?.facility_type || null,
            land_cover: evt.derived_intelligence.land_cover,
            persistence_score: evt.derived_intelligence.persistence.persistence_score,
            risk_level: evt.derived_intelligence.risk_level,
          },
        })),
      },
    };
  }
}

export const defaultClassifierEngine = new ThermalClassifierEngine();
