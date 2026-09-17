/**
 * @file tests/enhanced-validation.test.mjs
 * @description Automated Verification Suite for Expanded API Schema Validation & Contract Enforcement.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequestBody } from '../server/middleware/validation.mjs';

describe('Expanded API Schema Validation & Contract Enforcement', () => {
  describe('POST /api/v1/dispersion schema validation', () => {
    it('accepts valid dispersion request with coordinates and stability class', () => {
      const payload = {
        lat: 22.47,
        lon: 70.06,
        windSpeed: 4.5,
        windDirection: 270,
        frp: 85.0,
        stabilityClass: 'D',
      };
      const result = validateRequestBody('/api/v1/dispersion', payload);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('rejects dispersion request missing coordinates', () => {
      const payload = { windSpeed: 5.0, stabilityClass: 'D' };
      const result = validateRequestBody('/api/v1/dispersion', payload);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Missing required field: latitude')));
    });

    it('rejects invalid stability class not in Pasquill enum A-F', () => {
      const payload = { lat: 22.47, lon: 70.06, stabilityClass: 'Z' };
      const result = validateRequestBody('/api/v1/dispersion', payload);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Field \'stabilityClass\' must be one of')));
    });

    it('rejects negative or out-of-bounds wind speed', () => {
      const payload = { lat: 22.47, lon: 70.06, windSpeed: -5.0 };
      const result = validateRequestBody('/api/v1/dispersion', payload);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('must be >= 0')));
    });
  });

  describe('POST /api/v1/simulation/ignite schema validation', () => {
    it('accepts valid ignition request with known fuel type', () => {
      const payload = { lat: 18.52, lon: 73.85, fuelType: 'forest', windSpeed: 3.2 };
      const result = validateRequestBody('/api/v1/simulation/ignite', payload);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('rejects unrecognized fuel type', () => {
      const payload = { lat: 18.52, lon: 73.85, fuelType: 'nuclear_waste' };
      const result = validateRequestBody('/api/v1/simulation/ignite', payload);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Field \'fuelType\' must be one of')));
    });
  });

  describe('POST /api/v1/responders/dispatch schema validation', () => {
    it('accepts valid responder dispatch payload', () => {
      const payload = {
        incidentId: 'INC-2026-0825-JAMNAGAR',
        stationId: 'FIRE-STATION-JAM-1',
        priorityLevel: 'CRITICAL',
        units: 4,
      };
      const result = validateRequestBody('/api/v1/responders/dispatch', payload);
      assert.equal(result.valid, true);
    });

    it('rejects dispatch missing incidentId', () => {
      const payload = { stationId: 'ST-1', units: 2 };
      const result = validateRequestBody('/api/v1/responders/dispatch', payload);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Missing required field: incidentId')));
    });
  });
});
