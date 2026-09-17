/**
 * @module src/firms/intelligence/persistenceEngine
 * @description Spatio-Temporal Clustering and Persistent Thermal Source Tracking Engine.
 *
 * Distinguishes temporary fire events from persistent industrial thermal sources (flare stacks, kilns, smelters)
 * and detects abnormal surge anomalies relative to historical baselines.
 */

import { haversineDistanceKm } from '../../core/geospatial.js';

export class PersistenceEngine {
  constructor(options = {}) {
    this.clusterRadiusKm = options.clusterRadiusKm || 1.0; // 1km radius for spatial clustering
    this.persistenceThresholdPasses = options.persistenceThresholdPasses || 3; // Min detections for persistent classification
    this.surgeMultiplierThreshold = options.surgeMultiplierThreshold || 2.8; // Multiplier above baseline for abnormal surge
    this.sources = new Map(); // clusterId -> PersistentThermalSource
  }

  /**
   * Evaluates a list of thermal detections and aggregates them into persistent source clusters.
   *
   * @param {Array<object>} detections
   * @returns {Array<object>} Evaluated thermal clusters / sources
   */
  processDetections(detections = []) {
    for (const det of detections) {
      const lat = Number(det.observed?.latitude ?? det.latitude ?? det.lat) || 0;
      const lon = Number(det.observed?.longitude ?? det.longitude ?? det.lon) || 0;
      const frp = Number(det.observed?.frp_mw ?? det.frp) || 10.0;
      const timestamp = det.observed?.acquisition_time ?? det.timestamp ?? new Date().toISOString();

      const cluster = this._findOrCreateCluster(lat, lon);
      cluster.addObservation({
        lat,
        lon,
        frp,
        timestamp,
        detection_id: det.detection_id || det.id,
      });
    }

    return Array.from(this.sources.values()).map((src) => src.toRecord(this.persistenceThresholdPasses, this.surgeMultiplierThreshold));
  }

  /**
   * Evaluate temporal persistence metrics for a single detection against known clusters.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} currentFrp
   * @returns {object}
   */
  evaluatePersistence(lat, lon, currentFrp = 10.0) {
    const cluster = this._findNearbyCluster(lat, lon);
    if (!cluster || cluster.observations.length === 0) {
      return {
        is_persistent_source: false,
        persistence_score: 0.05,
        detection_count: 1,
        mean_baseline_frp: currentFrp,
        surge_ratio: 1.0,
        is_abnormal_surge: false,
      };
    }

    const obs = cluster.observations;
    const count = obs.length;
    const meanFrp = obs.reduce((sum, o) => sum + o.frp, 0) / count;
    const surgeRatio = meanFrp > 0 ? currentFrp / meanFrp : 1.0;
    const isPersistent = count >= this.persistenceThresholdPasses;
    const isAbnormalSurge = isPersistent && surgeRatio >= this.surgeMultiplierThreshold;

    return {
      cluster_id: cluster.id,
      is_persistent_source: isPersistent,
      persistence_score: Math.min(1.0, Math.round((count / 10) * 100) / 100),
      detection_count: count,
      mean_baseline_frp: Math.round(meanFrp * 10) / 10,
      surge_ratio: Math.round(surgeRatio * 100) / 100,
      is_abnormal_surge: isAbnormalSurge,
      first_seen: obs[0].timestamp,
      last_seen: obs[obs.length - 1].timestamp,
    };
  }

  _findOrCreateCluster(lat, lon) {
    let matched = this._findNearbyCluster(lat, lon);
    if (matched) return matched;

    const id = `ts_${lat.toFixed(3)}_${lon.toFixed(3)}`;
    matched = new PersistentSourceCluster(id, lat, lon);
    this.sources.set(id, matched);
    return matched;
  }

  _findNearbyCluster(lat, lon) {
    for (const cluster of this.sources.values()) {
      const dist = haversineDistanceKm(lat, lon, cluster.centroidLat, cluster.centroidLon);
      if (dist <= this.clusterRadiusKm) {
        return cluster;
      }
    }
    return null;
  }
}

class PersistentSourceCluster {
  constructor(id, lat, lon) {
    this.id = id;
    this.centroidLat = lat;
    this.centroidLon = lon;
    this.observations = [];
  }

  addObservation(obs) {
    this.observations.push(obs);
    // Recalculate centroid
    const n = this.observations.length;
    this.centroidLat = this.observations.reduce((s, o) => s + o.lat, 0) / n;
    this.centroidLon = this.observations.reduce((s, o) => s + o.lon, 0) / n;
  }

  toRecord(thresholdPasses = 3, surgeThreshold = 2.8) {
    const count = this.observations.length;
    const meanFrp = this.observations.reduce((s, o) => s + o.frp, 0) / count;
    const maxFrp = Math.max(...this.observations.map((o) => o.frp));
    const latestObs = this.observations[this.observations.length - 1];
    const surgeRatio = meanFrp > 0 ? latestObs.frp / meanFrp : 1.0;

    return {
      source_id: this.id,
      centroid: {
        latitude: Math.round(this.centroidLat * 10000) / 10000,
        longitude: Math.round(this.centroidLon * 10000) / 10000,
      },
      is_persistent: count >= thresholdPasses,
      observation_count: count,
      mean_frp_mw: Math.round(meanFrp * 10) / 10,
      max_frp_mw: Math.round(maxFrp * 10) / 10,
      latest_frp_mw: Math.round(latestObs.frp * 10) / 10,
      surge_ratio: Math.round(surgeRatio * 100) / 100,
      is_abnormal_surge: count >= thresholdPasses && surgeRatio >= surgeThreshold,
      first_detected: this.observations[0].timestamp,
      last_detected: latestObs.timestamp,
    };
  }
}

export const defaultPersistenceEngine = new PersistenceEngine();
