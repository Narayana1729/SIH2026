/**
 * @module src/firms/context/facilityContext
 * @description Industrial Infrastructure and Land-Cover contextual spatial enrichment layer.
 */

import { getAllFacilities, getHazmatProfiles } from '../../disasters/industrial/industrialFacilities.js';
import { haversineDistanceKm } from '../../core/geospatial.js';
import { FacilityType } from '../domain/constants.js';

export class FacilityContextManager {
  constructor() {
    this._facilities = null;
    this._hazmatProfiles = null;
  }

  /**
   * Load and map industrial facilities with normalized FacilityType taxonomy.
   * @returns {Array<object>}
   */
  getFacilities() {
    if (this._facilities) return this._facilities;
    const rawFacilities = getAllFacilities();

    this._facilities = rawFacilities.map((fac) => {
      const type = this._mapSectorToFacilityType(fac.sector, fac.name);
      return {
        facility_id: fac.id,
        name: fac.name,
        facility_type: type,
        sector: fac.sector,
        latitude: fac.latitude,
        longitude: fac.longitude,
        hazard_rating: fac.hazard_rating || 'MEDIUM',
        isolation_distance_meters: fac.isolation_distance_meters || this._getDefaultIsolationDistance(type),
        state: fac.state,
        district: fac.district,
      };
    });

    return this._facilities;
  }

  /**
   * Spatial lookup: Find all industrial facilities within a given distance of a point.
   * @param {number} lat
   * @param {number} lon
   * @param {number} [maxDistanceKm=5.0]
   * @returns {Array<object>}
   */
  findNearby(lat, lon, maxDistanceKm = 5.0) {
    const facilities = this.getFacilities();
    const matches = [];

    for (const fac of facilities) {
      const dist = haversineDistanceKm(lat, lon, fac.latitude, fac.longitude);
      if (dist <= maxDistanceKm) {
        matches.push({
          ...fac,
          distance_km: Math.round(dist * 100) / 100,
          distance_meters: Math.round(dist * 1000),
        });
      }
    }

    return matches.sort((a, b) => a.distance_km - b.distance_km);
  }

  /**
   * Evaluates Land-Cover / LULC and vegetation density for given coordinates.
   * @param {number} lat
   * @param {number} lon
   * @param {number} [ndviHint]
   * @returns {object}
   */
  getLandCoverContext(lat, lon, ndviHint = null) {
    const ndvi = Number.isFinite(ndviHint) ? ndviHint : this._estimateNdvi(lat, lon);
    let lulc = 'cropland';
    let vegetationDensity = 'MODERATE';

    if (ndvi >= 0.50) {
      lulc = 'forest';
      vegetationDensity = 'DENSE_CANOPY';
    } else if (ndvi >= 0.22) {
      lulc = 'cropland';
      vegetationDensity = 'AGRICULTURAL_BIOMASS';
    } else if (ndvi >= 0.10) {
      lulc = 'grassland_scrub';
      vegetationDensity = 'SPARSE';
    } else {
      lulc = 'bare_urban_industrial';
      vegetationDensity = 'MINIMAL_OR_BUILTUP';
    }

    const isMeasured = Number.isFinite(ndviHint);
    return {
      land_cover: lulc,
      ndvi: Math.round(ndvi * 100) / 100,
      vegetation_density: vegetationDensity,
      is_ndvi_measured: isMeasured,
      ndvi_provenance: isMeasured ? 'OBSERVED_SURFACE_REFLECTANCE' : 'MODELED_REGIONAL_CLIMATOLOGY_PROXY',
    };
  }

  _estimateNdvi(lat, lon) {
    // Spatial heuristic based on Indian subcontinent geographical zones
    if (lat >= 8.0 && lat <= 15.0 && lon >= 74.0 && lon <= 77.8) return 0.68; // Western Ghats
    if (lat >= 24.0 && lat <= 32.0 && lon >= 74.0 && lon <= 88.0) return 0.28; // Indo-Gangetic Plain
    if (lat >= 20.0 && lat <= 28.0 && lon >= 88.0 && lon <= 96.0) return 0.62; // Northeast Forests
    if (lat >= 22.0 && lat <= 26.0 && lon >= 82.0 && lon <= 87.0) return 0.18; // Coal mining belt (Jharkhand/Chhattisgarh)
    return 0.30;
  }

  _mapSectorToFacilityType(sector = '', name = '') {
    const s = (sector + ' ' + name).toUpperCase();
    if (s.includes('REFINERY') || s.includes('PETROLEUM')) return FacilityType.OIL_REFINERY;
    if (s.includes('PETROCHEMICAL') || s.includes('CHEMICAL')) return FacilityType.PETROCHEMICAL_COMPLEX;
    if (s.includes('THERMAL POWER') || s.includes('POWER STATION') || s.includes('COAL POWER')) return FacilityType.THERMAL_POWER_PLANT;
    if (s.includes('STEEL') || s.includes('METALLURGY') || s.includes('IRON')) return FacilityType.STEEL_PLANT;
    if (s.includes('MINE') || s.includes('MINING') || s.includes('COLLIERY')) return FacilityType.MINING_SITE;
    if (s.includes('LNG') || s.includes('GAS TERMINAL')) return FacilityType.LNG_TERMINAL;
    if (s.includes('CEMENT')) return FacilityType.CEMENT_PLANT;
    if (s.includes('FLARE')) return FacilityType.KNOWN_FLARE;
    return FacilityType.INDUSTRIAL_FACILITY;
  }

  _getDefaultIsolationDistance(type) {
    switch (type) {
      case FacilityType.OIL_REFINERY:
      case FacilityType.PETROCHEMICAL_COMPLEX:
      case FacilityType.LNG_TERMINAL:
        return 1000;
      case FacilityType.CHEMICAL_PLANT:
        return 800;
      case FacilityType.THERMAL_POWER_PLANT:
      case FacilityType.STEEL_PLANT:
        return 500;
      default:
        return 300;
    }
  }
}

export const defaultFacilityContext = new FacilityContextManager();
