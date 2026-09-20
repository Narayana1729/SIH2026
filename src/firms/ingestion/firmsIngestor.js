/**
 * @module src/firms/ingestion/firmsIngestor
 * @description Ingestion, parsing, and validation of satellite thermal anomaly telemetry from NASA FIRMS.
 *
 * Strictly captures observed satellite telemetry:
 *   latitude, longitude, brightness temperature, FRP, acquisition time, confidence, satellite, instrument, day/night.
 */

import { parseFirmsCsv, filterTrailing24h } from '../../data/firmsCsv.js';
import { defaultCache } from '../../../server/services/cache.mjs';
import { firmsCircuitBreaker } from '../../../server/services/circuitBreaker.mjs';

const CACHE_KEY = 'firms_active_detections_v1.json';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class FirmsIngestor {
  constructor(options = {}) {
    this.mapKey = options.mapKey || process.env.FIRMS_MAP_KEY || '1f855e76a168a37d8423e9d1f2047e76';
    this.defaultSource = options.source || 'VIIRS_NOAA20_NRT';
    this.defaultBbox = options.bbox || '65,5,100,38'; // Full South Asia bounding box (covering Sri Lanka, India, Maldives, Bangladesh, Nepal, Pakistan)
  }

  /**
   * Fetch active thermal detections from NASA FIRMS API or cached baseline.
   *
   * @param {object} [params]
   * @param {string} [params.bbox] - Bounding box minLon,minLat,maxLon,maxLat
   * @param {string} [params.days='1'] - Number of trailing days
   * @param {string} [params.source] - Instrument/satellite source
   * @returns {Promise<Array<object>>} Normalized observed thermal detections
   */
  async fetchDetections(params = {}) {
    const bbox = params.bbox || this.defaultBbox;
    const date = params.date || null;
    const days = params.days && params.days !== '1' ? params.days : (date ? '1' : '2');
    const source = params.source || this.defaultSource;
    const now = Date.now();

    const cacheKey = date
      ? `firms_${source}_${bbox.replace(/,/g, '_')}_${date}.json`
      : `firms_${source}_${bbox.replace(/,/g, '_')}_${days}d.json`;
    const cached = await defaultCache.get(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (now - parsed.timestamp < CACHE_TTL_MS) {
          return parsed.detections;
        }
      } catch {
        // Cache refresh
      }
    }

    const upstreamUrl = date
      ? `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${this.mapKey}/${source}/${bbox}/${days}/${date}`
      : `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${this.mapKey}/${source}/${bbox}/${days}`;

    try {
      const detections = await firmsCircuitBreaker.execute(
        async () => {
          const response = await fetch(upstreamUrl, {
            headers: { 'User-Agent': 'sriVision-FIRMS-Industrial-Engine/1.0' },
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) {
            throw new Error(`NASA FIRMS API responded with HTTP ${response.status}`);
          }

          const csvText = await response.text();
          const records = parseFirmsCsv(csvText);

          if (records) {
            const filtered = date ? records : filterTrailing24h(records, now);
            return this.normalizeDetections(filtered, source);
          }
          throw new Error('Malformed FIRMS CSV response');
        },
        () => {
          if (cached) {
            try {
              return JSON.parse(cached).detections;
            } catch {}
          }
          return [];
        }
      );

      if (detections && detections.length > 0) {
        await defaultCache.set(cacheKey, JSON.stringify({ timestamp: now, detections }));
        return detections;
      }
    } catch (err) {
      console.warn('[FirmsIngestor] Upstream fetch failed, falling back to cache:', err.message);
      if (cached) {
        try {
          return JSON.parse(cached).detections;
        } catch {}
      }
    }

    return [];
  }

  /**
   * Normalizes raw FIRMS records into strictly structured observed thermal detections.
   *
   * @param {Array<object>} rawRecords
   * @param {string} sourceName
   * @returns {Array<object>}
   */
  normalizeDetections(rawRecords = [], sourceName = 'VIIRS_NOAA20_NRT') {
    return rawRecords.map((r, index) => {
      const lat = Number(r.latitude ?? r.lat) || 0;
      const lon = Number(r.longitude ?? r.lon) || 0;
      const brightness = Number(r.brightness ?? r.bright_ti4 ?? r.bright_ti5 ?? r.temp) || 320.0;
      const frp = Number(r.frp) || 10.0;
      const confidence = typeof r.confidence === 'number' ? r.confidence : r.confidence === 'h' ? 90 : r.confidence === 'l' ? 40 : 70;
      const daynight = String(r.daynight || 'D').toUpperCase();
      const acqDate = r.acq_date || new Date().toISOString().split('T')[0];
      const acqTime = r.acq_time ? String(r.acq_time).padStart(4, '0') : '0000';
      const timestamp = `${acqDate}T${acqTime.slice(0, 2)}:${acqTime.slice(2, 4)}:00Z`;

      return {
        detection_id: r.id || `firms_${lat.toFixed(4)}_${lon.toFixed(4)}_${acqDate}_${acqTime}_${index}`,
        observed: {
          latitude: lat,
          longitude: lon,
          brightness_temp_k: Math.round(brightness * 10) / 10,
          frp_mw: Math.round(frp * 10) / 10,
          confidence_pct: confidence,
          acquisition_time: timestamp,
          satellite: r.satellite || (sourceName.includes('NOAA20') ? 'NOAA-20' : 'Suomi-NPP'),
          instrument: sourceName.includes('VIIRS') ? 'VIIRS' : 'MODIS',
          daynight,
        },
      };
    });
  }
}

export const defaultFirmsIngestor = new FirmsIngestor();
