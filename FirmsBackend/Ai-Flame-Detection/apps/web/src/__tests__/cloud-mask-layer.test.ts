import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateCloudMaskGeoJson } from '../lib/map/cloudMaskLayer.ts';

describe('Sensor Visibility & Cloud Opacity Mask Engine', () => {
  test('generates valid GeoJSON FeatureCollection of unobservable blind zones', () => {
    const data = generateCloudMaskGeoJson();
    assert.strictEqual(data.type, 'FeatureCollection');
    assert.ok(data.features.length >= 4, 'Should contain at least 4 critical cloud corridors');
    assert.ok(data.metadata.totalObscuredAreaKm2 > 100000);
  });

  test('each cloud blind zone specifies opacity, penetration limits, and operational action', () => {
    const data = generateCloudMaskGeoJson();
    for (const feature of data.features) {
      assert.strictEqual(feature.type, 'Feature');
      assert.strictEqual(feature.geometry.type, 'Polygon');
      assert.ok(feature.geometry.coordinates[0].length >= 4, 'Polygon must be closed');
      assert.ok(feature.properties.cloudOpacity >= 0.7);
      assert.ok(feature.properties.mwirPenetrationPercent <= 20);
      assert.ok(feature.properties.recommendedAction.length > 20);
    }
  });

  test('includes Himalayan orographic veil with BLIND_ZONE status', () => {
    const data = generateCloudMaskGeoJson();
    const himalaya = data.features.find(f => f.properties.zoneId.includes('HIMALAYA'));
    assert.ok(himalaya, 'Himalayan blind zone must exist');
    assert.strictEqual(himalaya?.properties.thermalStatus, 'BLIND_ZONE');
  });
});
