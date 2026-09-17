/**
 * @module disasters/wildfire/firmsAdapt
 * @description Adapts raw FIRMS CSV records into internal fire entity records.
 */

import { createDataProvenance, SOURCE_TYPES } from '../../core/provenance.js';

export function normalizeConfidence(value) {
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === 'low' || text === 'l') return 0.3;
    if (text === 'nominal' || text === 'n') return 0.6;
    if (text === 'high' || text === 'h') return 0.9;
    const numeric = Number(text);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric / 100)) : 0.5;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric / 100)) : 0.5;
}

export function adaptFirmsRecords(records = []) {
  if (!Array.isArray(records)) return [];
  const fires = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    fires.push({
      id: `fire-${i}`,
      index: i,
      lat,
      lon,
      frp: Number(r.frp) || 0,
      confidence: normalizeConfidence(r.confidence),
      brightness: Number(r.brightness) || 0,
      brightnessTi5: Number(r.brightnessTi5) || 0,
      daynight: r.daynight === 'N' ? 'NIGHT' : 'DAY',
      acqDate: r.acqDate,
      acqTime: r.acqTime,
      sensor: r.instrument || 'VIIRS',
      satellite: r.satellite || '',
      provenance: createDataProvenance({
        source: 'NASA FIRMS',
        sourceType: SOURCE_TYPES.REAL_LIVE,
        observedAt: `${r.acqDate}T${r.acqTime?.padStart(4, '0').slice(0, 2) || '00'}:${r.acqTime?.padStart(4, '0').slice(2, 4) || '00'}:00Z`,
        processing: ['csv_parse', 'trailing_24h_filter', 'frp_normalization'],
        confidenceType: 'SENSOR_REPORTED_CONFIDENCE',
        limitations: [
          'Thermal anomaly represents subpixel thermal signature and does not constitute a verified containment boundary.',
          'Cloud cover and heavy smoke can mask surface fire detections.',
        ],
      }),
    });
  }

  return fires;
}
