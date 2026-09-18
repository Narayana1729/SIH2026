/**
 * @module src/gis/infrastructureRegistry
 * @description Extensible GIS Critical-Infrastructure Registry & Spatial Risk Intersection Engine.
 *
 * Supports linear infrastructure overlays (Natural Gas Pipelines, High-Voltage Power Lines),
 * polygonal mining concessions, protected wilderness, heavy industrial facilities, and
 * emergency responder commands.
 *
 * Implements authoritative intersection risk analysis ("Potentially affected infrastructure").
 */

import { haversineDistanceKm } from '../services/protectedAreasService.js';
import { createDataProvenance } from '../core/provenance.js';

// Load static authoritative infrastructure features
import gasPipelinesData from '../../data/industrial_infra/india_gas_pipelines.json' with { type: 'json' };
import transmissionData from '../../data/industrial_infra/india_transmission_lines.json' with { type: 'json' };
import miningBasinsData from '../../data/industrial_infra/india_mining_basins.json' with { type: 'json' };
import protectedAreasData from '../../data/lulc_and_geo/indian_protected_areas.json' with { type: 'json' };

class InfrastructureLayerRegistry {
  constructor() {
    this.layers = new Map();
    this._initializeBuiltinLayers();
  }

  _initializeBuiltinLayers() {
    // 1. Natural Gas Pipelines
    this.registerLayer({
      id: 'gas_pipelines',
      name: 'National Gas & LPG Transmission Grid',
      category: 'energy_transmission',
      provider: 'Petroleum and Natural Gas Regulatory Board (PNGRB) / GAIL',
      geometry_type: 'LineString',
      description: 'High-pressure trunk natural gas and LPG pipelines across India.',
      update_date: '2026-06-30',
      provenance: 'PNGRB India Gas Grid & GAIL Pipeline Cadastre',
      limitations: 'Buried depth varies from 1.5m to 3.0m; surface thermal surge poses secondary exposure risk.',
      risk_buffer_km: 2.5,
      data: gasPipelinesData
    });

    // 2. High-Voltage Transmission Corridors
    this.registerLayer({
      id: 'transmission_lines',
      name: 'High-Voltage Transmission Corridors (800kV / 765kV / 400kV)',
      category: 'power_grid',
      provider: 'Power Grid Corporation of India Limited (POWERGRID)',
      geometry_type: 'LineString',
      description: 'Major inter-regional bulk power transmission corridors and HVDC bipoles.',
      update_date: '2026-05-15',
      provenance: 'Central Electricity Authority (CEA) / POWERGRID',
      limitations: 'Heavy particulate and ionized smoke plumes can trigger phase-to-ground flashover.',
      risk_buffer_km: 1.5,
      data: transmissionData
    });

    // 3. Mining Concession Basins
    this.registerLayer({
      id: 'mining_basins',
      name: 'Coalfield & Mineral Mining Concession Basins',
      category: 'resource_extraction',
      provider: 'Coal India Limited (CIL) / CMPDI / Ministry of Coal',
      geometry_type: 'Polygon',
      description: 'Open-cast and subsurface coal and mineral mining concession boundaries.',
      update_date: '2026-04-10',
      provenance: 'CMPDI Coal Directory / Ministry of Coal Open Data',
      limitations: 'Subsurface coal seams may exhibit persistent smoldering combustion beneath overburden.',
      risk_buffer_km: 3.0,
      data: miningBasinsData
    });

    // 4. Protected Forests & Wildlife Sanctuaries
    this.registerLayer({
      id: 'protected_areas',
      name: 'National Parks & Wildlife Sanctuaries',
      category: 'environment',
      provider: 'Forest Survey of India (FSI) / Wildlife Institute of India (WII)',
      geometry_type: 'Polygon',
      description: 'Ecologically sensitive protected areas, tiger reserves, and biosphere corridors.',
      update_date: '2026-08-01',
      provenance: 'FSI State of Forest Cadastre / WII',
      limitations: 'Seasonal leaf-off variations influence fuel dryness and wildfire propagation velocity.',
      risk_buffer_km: 10.0,
      data: protectedAreasData
    });
  }

  registerLayer(definition) {
    if (!definition.id || !definition.name) {
      throw new Error('Layer definition requires id and name.');
    }
    this.layers.set(definition.id, definition);
  }

  getLayer(id) {
    return this.layers.get(id);
  }

  getAllLayers() {
    return Array.from(this.layers.values()).map(l => ({
      id: l.id,
      name: l.name,
      category: l.category,
      provider: l.provider,
      geometry_type: l.geometry_type,
      description: l.description,
      update_date: l.update_date,
      provenance: l.provenance,
      limitations: l.limitations,
      feature_count: l.data?.features?.length || 0
    }));
  }

  /**
   * Calculate distance from point (lat, lon) to a LineString geometry in km.
   */
  _distanceToLineString(lat, lon, coordinates) {
    let minDist = Infinity;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      const d = this._pointToSegmentDistanceKm(lat, lon, p1[1], p1[0], p2[1], p2[0]);
      if (d < minDist) minDist = d;
    }
    return Number(minDist.toFixed(3));
  }

  _pointToSegmentDistanceKm(latP, lonP, latA, lonA, latB, lonB) {
    const cosLat = Math.cos(latP * Math.PI / 180);
    const xP = lonP * cosLat * 111.32;
    const yP = latP * 110.574;
    const xA = lonA * cosLat * 111.32;
    const yA = latA * 110.574;
    const xB = lonB * cosLat * 111.32;
    const yB = latB * 110.574;

    const dx = xB - xA;
    const dy = yB - yA;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return haversineDistanceKm(latP, lonP, latA, lonA);

    let t = ((xP - xA) * dx + (yP - yA) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projLon = (xA + t * dx) / (cosLat * 111.32);
    const projLat = (yA + t * dy) / 110.574;

    return haversineDistanceKm(latP, lonP, projLat, projLon);
  }

  /**
   * Calculate distance from point (lat, lon) to a Polygon boundary in km.
   */
  _distanceToPolygon(lat, lon, coordinates) {
    const outerRing = coordinates[0];
    if (!outerRing) return 9999;

    // Check point in polygon
    let inside = false;
    for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
      const xi = outerRing[i][0], yi = outerRing[i][1];
      const xj = outerRing[j][0], yj = outerRing[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    if (inside) return 0.0;

    let minDist = Infinity;
    for (let i = 0; i < outerRing.length - 1; i++) {
      const p1 = outerRing[i];
      const p2 = outerRing[i + 1];
      const d = this._pointToSegmentDistanceKm(lat, lon, p1[1], p1[0], p2[1], p2[0]);
      if (d < minDist) minDist = d;
    }
    return Number(minDist.toFixed(3));
  }

  /**
   * Find potentially affected critical infrastructure near an active incident.
   *
   * Invariant: Clearly labels findings as "Potentially affected infrastructure"
   * without claiming verified structural damage.
   *
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} [searchRadiusKm=15.0]
   * @returns {Object}
   */
  findIntersectingInfrastructure(latitude, longitude, searchRadiusKm = 15.0) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const results = [];

    for (const [layerId, layer] of this.layers.entries()) {
      if (!layer.data?.features) continue;

      for (const feature of layer.data.features) {
        const geom = feature.geometry;
        let distKm = Infinity;

        if (geom.type === 'LineString') {
          distKm = this._distanceToLineString(lat, lon, geom.coordinates);
        } else if (geom.type === 'Polygon') {
          distKm = this._distanceToPolygon(lat, lon, geom.coordinates);
        } else if (geom.type === 'Point') {
          distKm = haversineDistanceKm(lat, lon, geom.coordinates[1], geom.coordinates[0]);
        }

        const maxBuffer = Math.max(searchRadiusKm, layer.risk_buffer_km || 5.0);

        if (distKm <= maxBuffer) {
          const props = feature.properties || {};
          let threatState = 'MONITORING';
          if (distKm <= (layer.risk_buffer_km || 2.0)) {
            threatState = 'POTENTIALLY_AFFECTED';
          } else if (distKm <= (layer.risk_buffer_km || 2.0) * 2.0) {
            threatState = 'PROXIMITY_CORRIDOR';
          }

          results.push({
            asset_id: feature.id || props.id || `${layerId}_${results.length}`,
            layer_id: layerId,
            layer_name: layer.name,
            category: layer.category,
            asset_name: props.name || 'Critical Linear Asset',
            operator: props.operator || 'National Utility',
            distance_km: distKm,
            threat_state: threatState,
            relationship: threatState === 'POTENTIALLY_AFFECTED' ? 'Potentially affected infrastructure' : 'Proximity corridor asset',
            criticality: props.criticality || 'HIGH',
            hazard_buffer_km: layer.risk_buffer_km || 2.0,
            source: layer.provider,
            properties: props
          });
        }
      }
    }

    results.sort((a, b) => a.distance_km - b.distance_km);

    return {
      incident_location: { latitude: lat, longitude: lon },
      search_radius_km: searchRadiusKm,
      total_nearby_assets: results.length,
      potentially_affected_count: results.filter(r => r.threat_state === 'POTENTIALLY_AFFECTED').length,
      infrastructure: results,
      epistemic_disclaimer: 'Spatial proximity indicates potential environmental or thermal exposure corridor. It does NOT denote confirmed physical damage.',
      provenance: createDataProvenance({
        source: 'National GIS Layer Registry (PNGRB, POWERGRID, CIL, FSI)',
        epistemic_tier: 'CALCULATED_PHYSICS',
        attribution: 'Multi-Utility Spatial Infrastructure Overlay'
      })
    };
  }
}

export const infrastructureRegistry = new InfrastructureLayerRegistry();
