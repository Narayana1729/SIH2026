/**
 * Integration Test Suite: Real Satellite (LULC & Optical) and Exact Lundberg TreeSHAP
 *
 * Verifies:
 * 1. Requirement 6: Real ESA WorldCover 10m GeoTIFF reading with rasterio, 
 *    normalized class fractions summing to 1.0, and graceful DATA_UNAVAILABLE for out-of-bounds.
 * 2. Requirement 7: Real Sentinel-2 MSI L2A surface reflectance (B04, B08, B11, B12, SCL),
 *    rigorous band math (NDVI, NBR, SWIR ratio), and cloud masking.
 * 3. Requirement 8: Exact Lundberg TreeSHAP dynamic programming additivity
 *    (|sum(phi) + base_value - f(x)| < 1e-5) and sample locality (A != B).
 * 4. API & UI Pipeline: ML inference service returns full provenance payloads
 *    and resolveEventAttributions formats them accurately.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEventAttributions, formatTreeShapAttributions } from '../src/intelligence/shapExplainer.js';
import { defaultMLInferenceService } from '../server/services/mlInferenceService.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PYTHON_PATH = path.join(ROOT_DIR, 'FirmsBackend/Ai-Flame-Detection/.venv/bin/python3');

function runPythonSnippet(code) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, ['-c', code], {
      cwd: path.join(ROOT_DIR, 'FirmsBackend/Ai-Flame-Detection/sri'),
      env: { ...process.env, PYTHONPATH: path.join(ROOT_DIR, 'FirmsBackend/Ai-Flame-Detection/sri') }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (e) {
          resolve(stdout.trim());
        }
      }
    });
  });
}

describe('Requirement 6: Real ESA WorldCover 10m GeoTIFF Grounding', () => {
  it('extracts real land-cover class fractions summing strictly to 1.0 for coordinates inside raster', async () => {
    const pyCode = `
import json
from src.raster_lulc_service import get_default_raster_lulc_service

service = get_default_raster_lulc_service()
# Query inside Jamnagar Refinery raster extent
res = service.get_landcover_context(22.358, 69.871, footprint_meters=500.0)
print(json.dumps(res))
`;
    const res = await runPythonSnippet(pyCode);
    assert.equal(res.is_lulc_measured, true, 'Should be measured for coordinates within raster');
    assert.equal(res.lulc_source, 'ESA_WORLDCOVER');
    assert.equal(res.lulc_resolution_m, 10);
    
    // Fractions must strictly sum to 1.0 (within float tolerance)
    const fractionsSum = res.builtup_fraction + res.cropland_fraction + res.forest_fraction + res.bare_fraction + res.water_fraction + res.grassland_fraction + res.shrubland_fraction;
    assert.ok(Math.abs(fractionsSum - 1.0) < 1e-4, `Fractions sum must equal 1.0, got ${fractionsSum}`);
    
    // Assert measured fractions and dominant class from actual ESA 10m raster
    assert.ok(res.builtup_fraction > 0.05, `Expected measured builtup fraction > 0.05, got ${res.builtup_fraction}`);
    assert.equal(res.dominant_class, 'Tree Cover / Forest');
    assert.equal(res.valid_pixel_count, 3132);
  });

  it('returns DATA_UNAVAILABLE without fabricating values when outside raster bounds', async () => {
    const pyCode = `
import json
from src.raster_lulc_service import get_default_raster_lulc_service

service = get_default_raster_lulc_service()
# Query remote coordinate in middle of the Pacific Ocean
res = service.get_landcover_context(0.0, -140.0, footprint_meters=500.0)
print(json.dumps(res))
`;
    const res = await runPythonSnippet(pyCode);
    assert.equal(res.is_lulc_measured, false, 'Should not be measured outside raster');
    assert.equal(res.status, 'DATA_UNAVAILABLE');
    assert.equal(res.builtup_fraction, null, 'Must not fabricate builtup fraction');
    assert.equal(res.forest_fraction, null, 'Must not fabricate forest fraction');
  });
});

describe('Requirement 7: Real Sentinel-2 MSI Surface Reflectance Grounding', () => {
  it('extracts real Level-2A surface reflectance, SCL cloud mask, and computes physical band indices', async () => {
    const pyCode = `
import json
from src.sentinel_optical_service import get_default_sentinel_optical_service

service = get_default_sentinel_optical_service()
# Query inside Jamnagar tile
res = service.extract_optical_features(22.358, 69.871)
print(json.dumps(res))
`;
    const res = await runPythonSnippet(pyCode);
    assert.equal(res.optical_data_available, true, 'Should be measured for coordinates within tile');
    assert.equal(res.optical_source, 'SENTINEL_2_L2A');
    assert.equal(typeof res.cloud_mask_applied, 'boolean');
    assert.ok('scl_class' in res, 'Must contain Scene Classification Layer (SCL) class');
    assert.ok('b04_red' in res, 'Must contain calibrated B04 reflectance');
    
    // Verify physical band index equations
    const b4 = res.b04_red;
    const b8 = res.b08_nir;
    const b11 = res.swir1;
    const b12 = res.swir2;
    
    const expectedNdvi = (b8 - b4) / (b8 + b4 + 1e-7);
    const expectedNbr = (b8 - b12) / (b8 + b12 + 1e-7);
    const expectedSwirRatio = b12 / (b11 + 1e-7);
    
    assert.ok(Math.abs(res.ndvi - expectedNdvi) < 1e-3, `NDVI math check: got ${res.ndvi}, expected ${expectedNdvi}`);
    assert.ok(Math.abs(res.nbr - expectedNbr) < 1e-3, `NBR math check: got ${res.nbr}, expected ${expectedNbr}`);
    assert.ok(Math.abs(res.swir_ratio - expectedSwirRatio) < 1e-3, `SWIR ratio math check: got ${res.swir_ratio}, expected ${expectedSwirRatio}`);
  });

  it('returns DATA_UNAVAILABLE for Sentinel-2 queries outside raster footprints', async () => {
    const pyCode = `
import json
from src.sentinel_optical_service import get_default_sentinel_optical_service

service = get_default_sentinel_optical_service()
res = service.extract_optical_features(45.0, 10.0)
print(json.dumps(res))
`;
    const res = await runPythonSnippet(pyCode);
    assert.equal(res.optical_data_available, false);
    assert.equal(res.status, 'DATA_UNAVAILABLE');
    assert.equal(res.b04_red, null);
  });
});

describe('Requirement 8: Exact Lundberg TreeSHAP DP Algorithm', () => {
  it('satisfies the exact efficiency/additivity axiom (sum(phi) + base_value = f(x)) to < 1e-5 precision', async () => {
    const pyCode = `
import json
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from src.treeshap_dp import ExactTreeSHAPExplainer

np.random.seed(42)
X = np.random.randn(80, 5)
y = (X[:, 0] * 2 + X[:, 1] > 0).astype(int)

clf = GradientBoostingClassifier(n_estimators=10, max_depth=3, random_state=42)
clf.fit(X, y)

explainer = ExactTreeSHAPExplainer(clf, feature_names=['f0', 'f1', 'f2', 'f3', 'f4'])

test_sample = np.array([0.8, -0.5, 1.2, -0.3, 0.4])
res = explainer.explain_sample(test_sample)

print(json.dumps({
    'base_value': res['base_value'],
    'margin': res['margin'],
    'additivity_verified': res['additivity_verified'],
    'additivity_error': res['additivity_error'],
    'attributions': res['attributions']
}))
`;
    const res = await runPythonSnippet(pyCode);
    assert.equal(res.additivity_verified, true, `TreeSHAP additivity error must be < 1e-5, got ${res.additivity_error}`);
    assert.ok(res.additivity_error < 1e-5, `Error was ${res.additivity_error}`);
  });

  it('satisfies sample locality: different samples receive different, tailored Shapley attributions', async () => {
    const pyCode = `
import json
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from src.treeshap_dp import ExactTreeSHAPExplainer

np.random.seed(42)
X = np.random.randn(80, 5)
y = (X[:, 0] * 2 + X[:, 1] > 0).astype(int)

clf = GradientBoostingClassifier(n_estimators=10, max_depth=3, random_state=42)
clf.fit(X, y)

explainer = ExactTreeSHAPExplainer(clf, feature_names=['f0', 'f1', 'f2', 'f3', 'f4'])

sample_a = np.array([2.0, -1.0, 0.5, 0.0, -0.5])
sample_b = np.array([-2.0, 1.0, -0.5, 0.0, 0.5])

exp_a = explainer.explain_sample(sample_a)
exp_b = explainer.explain_sample(sample_b)

phi_a = exp_a['attributions']
phi_b = exp_b['attributions']

is_different = (phi_a != phi_b)

print(json.dumps({
    'phi_a': phi_a,
    'phi_b': phi_b,
    'is_different': bool(is_different)
}))
`;
    const res = await runPythonSnippet(pyCode);
    assert.equal(res.is_different, true, 'Sample A and Sample B attributions must differ (local XAI)');
    assert.notDeepEqual(res.phi_a, res.phi_b);
  });
});

describe('End-to-End Inference & UI Provenance Integration', () => {
  after(() => {
    defaultMLInferenceService.shutdown();
  });

  it('ML batch inference service includes lulc_context, optical_context, and verified TreeSHAP payload', async () => {
    const isReady = await defaultMLInferenceService.ensureReady(20000);
    assert.equal(isReady, true, 'ML worker must be ready');

    const events = [
      {
        latitude: 22.358,
        longitude: 69.871,
        frp: 75.0,
        bright_ti4: 365.0,
        bright_ti5: 295.0,
        confidence: 'h',
        distKm: 0.4
      }
    ];

    const batchOutput = await defaultMLInferenceService.classifyBatch(events);
    const results = batchOutput.events;
    assert.ok(Array.isArray(results) && results.length === 1);
    
    const res = results[0];
    assert.ok('category' in res, 'Must have classification category');
    assert.ok('lulc_context' in res, 'Must have lulc_context');
    assert.ok('optical_context' in res, 'Must have optical_context');
    assert.ok('xai' in res, 'Must have xai payload');
    
    // Verify XAI payload integrity
    const xai = res.xai;
    assert.equal(xai.method, 'TREE_SHAP');
    assert.equal(xai.implementation, 'Lundberg-Exact-DP');
    assert.equal(xai.additivity_verified, true);
    assert.ok('attributions' in xai);
    assert.ok('top_positive_drivers' in xai);

    // Verify resolveEventAttributions formats it accurately for UI panels
    const resolved = resolveEventAttributions(res);
    assert.equal(resolved.is_exact_shap, true);
    assert.equal(resolved.method, 'TREE_SHAP');
    assert.ok(resolved.attributions.length > 0);
    assert.equal(typeof resolved.attributions[0].shapValue, 'number');
  });
});
