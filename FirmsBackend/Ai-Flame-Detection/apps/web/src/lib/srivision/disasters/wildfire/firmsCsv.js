/**
 * @module disasters/wildfire/firmsCsv
 * @description NASA FIRMS area-CSV parsing — pure functions, zero dependencies.
 *
 * Upstream: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/world/{days}
 * Supports VIIRS (NOAA-20, Suomi-NPP, NOAA-21) and MODIS headers.
 */

const REQUIRED_HEADER_FIELDS = ['latitude', 'longitude', 'acq_date', 'acq_time', 'confidence', 'frp'];
const HOUR_MS = 3600_000;
const WINDOW_MS = 24 * HOUR_MS;
const FORWARD_SLACK_MS = 2 * HOUR_MS;

/**
 * Checks if raw text appears to be a valid FIRMS CSV payload.
 * @param {string} text
 * @returns {boolean}
 */
export function isLikelyCsv(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trimStart();
  if (!trimmed || trimmed[0] === '<') return false;
  const headerLine = trimmed.slice(0, trimmed.indexOf('\n') === -1 ? undefined : trimmed.indexOf('\n'))
    .trim().toLowerCase();
  const fields = headerLine.split(',').map((f) => f.trim());
  return REQUIRED_HEADER_FIELDS.every((required) => fields.includes(required));
}

/**
 * Parse a FIRMS area CSV payload into normalized detection records.
 * @param {string} text - Raw CSV payload.
 * @returns {?Array<object>}
 */
export function parseFirmsCsv(text) {
  if (!isLikelyCsv(text)) return null;
  const lines = text.split('\n');

  let headerIndex = 0;
  while (headerIndex < lines.length && !lines[headerIndex].trim()) headerIndex += 1;
  const header = lines[headerIndex].trim().toLowerCase().split(',').map((f) => f.trim());
  const col = new Map(header.map((name, i) => [name, i]));
  const iLat = col.get('latitude');
  const iLon = col.get('longitude');
  const iFrp = col.get('frp');
  const iConfidence = col.get('confidence');
  const iBrightness = col.get('bright_ti4') ?? col.get('brightness');
  const iBrightnessTi5 = col.get('bright_ti5') ?? col.get('bright_t31');
  const iDaynight = col.get('daynight');
  const iAcqDate = col.get('acq_date');
  const iAcqTime = col.get('acq_time');
  const iSatellite = col.get('satellite');
  const iInstrument = col.get('instrument');

  const records = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < header.length) continue;
    const lat = Number(parts[iLat]);
    const lon = Number(parts[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    records.push({
      lat,
      lon,
      frp: Number(parts[iFrp]) || 0,
      confidence: (parts[iConfidence] || '').trim(),
      brightness: Number(parts[iBrightness]) || 0,
      brightnessTi5: Number(parts[iBrightnessTi5]) || 0,
      daynight: (parts[iDaynight] || '').trim(),
      acqDate: (parts[iAcqDate] || '').trim(),
      acqTime: (parts[iAcqTime] || '').trim(),
      satellite: (parts[iSatellite] || '').trim(),
      instrument: (parts[iInstrument] || '').trim(),
    });
  }
  return records;
}

/**
 * Convert FIRMS acq_date ("YYYY-MM-DD") + acq_time (unpadded "HHMM", UTC) into epoch ms.
 * @param {string} acqDate
 * @param {string|number} acqTime
 * @returns {number}
 */
export function acquisitionMsUtc(acqDate, acqTime) {
  if (typeof acqDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(acqDate)) return NaN;
  const timeText = String(acqTime ?? '').trim();
  if (!/^\d{1,4}$/.test(timeText)) return NaN;
  const hhmm = timeText.padStart(4, '0');
  const year = Number(acqDate.slice(0, 4));
  const month = Number(acqDate.slice(5, 7));
  const day = Number(acqDate.slice(8, 10));
  const hours = Number(hhmm.slice(0, 2));
  const minutes = Number(hhmm.slice(2, 4));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) return NaN;
  return Date.UTC(year, month - 1, day, hours, minutes);
}

/**
 * Keep only records acquired within [nowMs - 24h, nowMs + 2h].
 * @param {Array<object>} records
 * @param {number} nowMs
 * @returns {Array<object>}
 */
export function filterTrailing24h(records, nowMs) {
  if (!Array.isArray(records) || !Number.isFinite(nowMs)) return [];
  const oldest = nowMs - WINDOW_MS;
  const newest = nowMs + FORWARD_SLACK_MS;
  const memo = new Map();
  return records.filter((record) => {
    const key = `${record.acqDate}:${record.acqTime}`;
    let ms = memo.get(key);
    if (ms === undefined) {
      ms = acquisitionMsUtc(record.acqDate, record.acqTime);
      memo.set(key, ms);
    }
    return Number.isFinite(ms) && ms >= oldest && ms <= newest;
  });
}
