/**
 * @module server/middleware/validation
 * @description JSON schema validation middleware for POST endpoints.
 *
 * Provides lightweight schema validation without external dependencies.
 * Validates required fields, types, and numeric ranges for thermal anomaly payloads.
 */

import { sendError } from './security.mjs';

/**
 * Schema definitions for known POST endpoints.
 */
const SCHEMAS = {
  '/api/v1/firms/classify': {
    description: 'Thermal anomaly classification request',
    singleFields: {
      latitude:  { type: 'number', min: -90,  max: 90,  aliases: ['lat'] },
      longitude: { type: 'number', min: -180, max: 180, aliases: ['lon'] },
    },
    optionalFields: {
      frp:         { type: 'number', min: 0, max: 10000 },
      frp_mw:      { type: 'number', min: 0, max: 10000 },
      brightness:  { type: 'number', min: 200, max: 600 },
      bright_ti4:  { type: 'number', min: 200, max: 600 },
      bright_ti5:  { type: 'number', min: 200, max: 600 },
      confidence:  { type: 'number', min: 0, max: 100 },
      daynight:    { type: 'string', enum: ['D', 'N', 'd', 'n', 'Day', 'Night'] },
      ndvi:        { type: 'number', min: -1, max: 1 },
      landCover:   { type: 'string', enum: ['forest', 'cropland', 'industrial', 'urban', 'bare', 'grassland'] },
    },
    allowBatch: true,   // Allows { detections: [...] } form
    batchKey: 'detections',
  },
};

/**
 * Validate a single object against a schema definition.
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateObject(obj, schema) {
  const errors = [];

  // Check required fields (or their aliases)
  for (const [field, rule] of Object.entries(schema.singleFields || {})) {
    const allNames = [field, ...(rule.aliases || [])];
    const value = allNames.reduce((v, name) => (v !== undefined ? v : obj[name]), undefined);

    if (value === undefined || value === null) {
      errors.push(`Missing required field: ${field} (or alias: ${(rule.aliases || []).join(', ')})`);
      continue;
    }

    if (rule.type === 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        errors.push(`Field '${field}' must be a finite number, got: ${typeof value} "${value}"`);
      } else {
        if (rule.min !== undefined && num < rule.min) errors.push(`Field '${field}' must be >= ${rule.min}, got: ${num}`);
        if (rule.max !== undefined && num > rule.max) errors.push(`Field '${field}' must be <= ${rule.max}, got: ${num}`);
      }
    }
  }

  // Check optional fields if present
  for (const [field, rule] of Object.entries(schema.optionalFields || {})) {
    if (obj[field] === undefined || obj[field] === null) continue;

    const value = obj[field];
    if (rule.type === 'number') {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        errors.push(`Optional field '${field}' must be a finite number, got: ${typeof value}`);
      } else {
        if (rule.min !== undefined && num < rule.min) errors.push(`Field '${field}' must be >= ${rule.min}, got: ${num}`);
        if (rule.max !== undefined && num > rule.max) errors.push(`Field '${field}' must be <= ${rule.max}, got: ${num}`);
      }
    }
    if (rule.type === 'string' && rule.enum && !rule.enum.includes(String(value))) {
      errors.push(`Field '${field}' must be one of [${rule.enum.join(', ')}], got: "${value}"`);
    }
  }

  return errors;
}

/**
 * Validate incoming POST body against known schema.
 * @param {string} pathname - The request pathname
 * @param {object} body - Parsed JSON body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRequestBody(pathname, body) {
  const schema = SCHEMAS[pathname];
  if (!schema) {
    // No schema defined — allow through (open by default for unknown endpoints)
    return { valid: true, errors: [] };
  }

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  // Batch mode: { detections: [...] }
  if (schema.allowBatch && Array.isArray(body[schema.batchKey])) {
    const allErrors = [];
    body[schema.batchKey].forEach((item, idx) => {
      const itemErrors = validateObject(item, schema);
      itemErrors.forEach((e) => allErrors.push(`detections[${idx}]: ${e}`));
    });
    if (allErrors.length > 10) {
      return { valid: false, errors: [...allErrors.slice(0, 10), `...and ${allErrors.length - 10} more errors`] };
    }
    return { valid: allErrors.length === 0, errors: allErrors };
  }

  // Single object mode
  const errors = validateObject(body, schema);
  return { valid: errors.length === 0, errors };
}
