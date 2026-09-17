import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFirmsCsv, filterTrailing24h, acquisitionMsUtc, isLikelyCsv } from '../src/data/firmsCsv.js';
import { normalizeConfidence, adaptFirmsRecords } from '../src/data/firmsAdapt.js';

const SAMPLE_CSV = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
34.05,-118.25,335.2,0.4,0.4,2026-07-16,1430,N20,VIIRS,h,2.0NRT,295.4,45.2,D
-10.20,-62.80,312.0,0.5,0.4,2026-07-16,0420,N20,VIIRS,n,2.0NRT,290.0,12.5,N`;

test('isLikelyCsv validates genuine FIRMS header', () => {
  assert.equal(isLikelyCsv(SAMPLE_CSV), true);
  assert.equal(isLikelyCsv('<html>Error</html>'), false);
  assert.equal(isLikelyCsv('Invalid MAP_KEY'), false);
});

test('parseFirmsCsv parses rows and normalizes columns', () => {
  const records = parseFirmsCsv(SAMPLE_CSV);
  assert.equal(records.length, 2);
  assert.equal(records[0].lat, 34.05);
  assert.equal(records[0].lon, -118.25);
  assert.equal(records[0].frp, 45.2);
  assert.equal(records[0].confidence, 'h');
  assert.equal(records[1].daynight, 'N');
});

test('acquisitionMsUtc accurately converts date and unpadded HHMM', () => {
  const ms = acquisitionMsUtc('2026-07-16', '1430');
  assert.equal(Number.isFinite(ms), true);
  const date = new Date(ms);
  assert.equal(date.getUTCFullYear(), 2026);
  assert.equal(date.getUTCHours(), 14);
  assert.equal(date.getUTCMinutes(), 30);
});

test('normalizeConfidence translates categorical and numeric confidence', () => {
  assert.equal(normalizeConfidence('h'), 0.9);
  assert.equal(normalizeConfidence('nominal'), 0.6);
  assert.equal(normalizeConfidence('l'), 0.3);
  assert.equal(normalizeConfidence('85'), 0.85);
});

test('adaptFirmsRecords attaches Data Provenance metadata', () => {
  const raw = parseFirmsCsv(SAMPLE_CSV);
  const adapted = adaptFirmsRecords(raw);
  assert.equal(adapted.length, 2);
  assert.equal(adapted[0].provenance.source, 'NASA FIRMS');
  assert.equal(adapted[0].provenance.source_type, 'REAL_LIVE');
  assert.ok(adapted[0].provenance.scientific_limitations.length > 0);
});
