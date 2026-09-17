import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp } from '../server/middleware/security.mjs';
import { createRateLimiter } from '../server/services/rateLimit.mjs';
import { defaultCache } from '../server/services/cache.mjs';

test('isPrivateIp detects private, loopback, and link-local addresses', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('localhost'), true);
  assert.equal(isPrivateIp('10.0.0.1'), true);
  assert.equal(isPrivateIp('192.168.1.1'), true);
  assert.equal(isPrivateIp('172.16.0.1'), true);
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('1.1.1.1'), false);
});

test('createRateLimiter limits rapid requests after token exhaustion', () => {
  const limiter = createRateLimiter({ maxTokens: 3, refillIntervalMs: 60000 });
  assert.equal(limiter('1.2.3.4'), true);
  assert.equal(limiter('1.2.3.4'), true);
  assert.equal(limiter('1.2.3.4'), true);
  assert.equal(limiter('1.2.3.4'), false); // 4th request blocked
  assert.equal(limiter('5.6.7.8'), true); // Different IP allowed
});

test('defaultCache handles atomic set and get', async () => {
  const testKey = 'test_cache_entry.json';
  const testData = JSON.stringify({ hello: 'sriVision', time: Date.now() });

  const written = await defaultCache.set(testKey, testData);
  assert.equal(written, true);

  const readBack = await defaultCache.get(testKey);
  assert.equal(readBack, testData);
});

import { handleDispersionRoute } from '../server/routes/dispersion.mjs';

test('handleDispersionRoute automatically resolves nearby facility HazMat intelligence & UN placards', async () => {
  const url = new URL('http://localhost/api/dispersion/plume?lat=22.47&lon=70.05&windDir=270&windSpeed=4');
  let statusCode = 0;
  let jsonOutput = null;

  const req = { method: 'GET' };
  const res = {
    writeHead(code, headers) { statusCode = code; },
    end(payload) { jsonOutput = JSON.parse(payload); }
  };

  await handleDispersionRoute(req, res, url);

  assert.equal(statusCode, 200);
  assert.equal(jsonOutput.success, true);
  assert.ok(jsonOutput.hazmat_intelligence, 'Must return hazmat_intelligence');
  assert.ok(jsonOutput.hazmat_intelligence.matched_facility, 'Must match nearby Jamnagar plant');
  assert.ok(jsonOutput.hazmat_intelligence.un_na_numbers.includes('UN1267'));
  assert.ok(jsonOutput.hazmat_intelligence.primary_chemicals.includes('Benzene'));
  assert.ok(jsonOutput.hazmat_intelligence.firefighting_protocol.includes('AFFF'));
  assert.ok(jsonOutput.hazmat_intelligence.initial_isolation_distance_meters > 0);
});

