/**
 * @module src/disasters/responders/emergencyResponders
 * @description Emergency responders, NDRF battalions, fire stations, and trauma hospitals query engine.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineDistanceKm } from '../../core/geospatial.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data/local_data/responders');

let cachedResponders = null;

/**
 * Load all emergency responders.
 */
export function getAllResponders() {
  if (cachedResponders) return cachedResponders;
  const list = [];
  try {
    const firePath = path.join(DATA_DIR, 'fire_stations.geojsonl');
    if (fs.existsSync(firePath)) {
      const lines = fs.readFileSync(firePath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const coords = item.geometry?.coordinates || [];
          const props = item.properties || {};
          list.push({
            id: item.id || props.name,
            name: props.name || 'Fire Unit',
            type: 'fire_station',
            lat: coords[1] || props.lat,
            lon: coords[0] || props.lon,
            contact_phone: props.contact || '101',
          });
        } catch {}
      }
    }

    const hospPath = path.join(DATA_DIR, 'hospitals.geojsonl');
    if (fs.existsSync(hospPath)) {
      const lines = fs.readFileSync(hospPath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const coords = item.geometry?.coordinates || [];
          const props = item.properties || {};
          list.push({
            id: item.id || props.name,
            name: props.name || 'Trauma Hospital',
            type: 'hospital',
            lat: coords[1] || props.lat,
            lon: coords[0] || props.lon,
            burn_icu: true,
          });
        } catch {}
      }
    }

    cachedResponders = list;
  } catch (err) {
    console.error('[Emergency Responders] Error loading dataset:', err.message);
    cachedResponders = [];
  }
  return cachedResponders;
}

/**
 * Find emergency responders within a given radius of a coordinate.
 * @param {number} lat 
 * @param {number} lon 
 * @param {number} [radiusKm=100] 
 * @returns {Array<Object>}
 */
export function findRespondersNearby(lat, lon, radiusKm = 100) {
  const all = getAllResponders();
  const nearby = [];

  for (const resp of all) {
    const dist = haversineDistanceKm(lat, lon, resp.lat, resp.lon);
    if (dist <= radiusKm) {
      nearby.push({
        ...resp,
        distance_km: Math.round(dist * 100) / 100,
      });
    }
  }

  nearby.sort((a, b) => a.distance_km - b.distance_km);

  return nearby;
}

/**
 * Group nearby responders by category.
 */
export function findCategorizedRespondersNearby(lat, lon, radiusKm = 100) {
  const list = findRespondersNearby(lat, lon, radiusKm);
  return {
    fire_stations: list.filter((r) => r.type === 'fire_station'),
    ndrf_sdrf: list.filter((r) => r.type === 'ndrf_battalion' || r.type === 'sdrf'),
    hospitals: list.filter((r) => r.type === 'hospital'),
    all: list,
  };
}
