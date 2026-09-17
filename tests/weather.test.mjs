import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWmoWeatherCode, windSpeedToBeaufort } from '../src/disasters/weather/weatherMath.js';

test('parseWmoWeatherCode correctly maps WMO codes', () => {
  assert.equal(parseWmoWeatherCode(0).category, 'CLEAR');
  assert.equal(parseWmoWeatherCode(61).category, 'RAIN');
  assert.equal(parseWmoWeatherCode(71).category, 'SNOW');
  assert.equal(parseWmoWeatherCode(95).category, 'STORM');
});

test('windSpeedToBeaufort scales wind speeds', () => {
  assert.equal(windSpeedToBeaufort(3).scale, 1);
  assert.equal(windSpeedToBeaufort(25).scale, 4);
  assert.equal(windSpeedToBeaufort(65).scale, 8);
});
