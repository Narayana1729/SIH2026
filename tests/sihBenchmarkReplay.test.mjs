import test from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_BENCHMARKS, runBenchmarkReplay } from '../scripts/run_sih_benchmark_replay.mjs';

test('Benchmark Replay: Executes 6 canonical Indian scenarios deterministically', () => {
  const { results, sha256 } = runBenchmarkReplay();

  assert.equal(results.length, 6);
  assert.ok(typeof sha256 === 'string' && sha256.length === 64);

  // 1. Jamnagar Gas Flare
  const jamnagar = results.find(r => r.benchmarkId.includes('JAMNAGAR'));
  assert.ok(jamnagar);
  assert.equal(jamnagar.classification.category, 'INDUSTRIAL_FLARE');
  assert.ok(jamnagar.pyrometry.flameTempK > 900);
  assert.equal(jamnagar.skepticAudit.isDisproven, false);

  // 2. HPCL Vizag Explosion
  const vizag = results.find(r => r.benchmarkId.includes('VIZAG'));
  assert.ok(vizag);
  assert.equal(vizag.classification.category, 'INDUSTRIAL_DISASTER');
  assert.equal(vizag.classification.severity, 'CRITICAL');
  assert.ok(vizag.dispersionPlume.buoyancyFb > 1000);
  assert.equal(vizag.hazmat.chemical, 'Benzene');
  assert.equal(vizag.skepticAudit.isDisproven, false);

  // 3. Singrauli Thermal Process
  const singrauli = results.find(r => r.benchmarkId.includes('SINGRAULI'));
  assert.ok(singrauli);
  assert.equal(singrauli.classification.category, 'INDUSTRIAL_PROCESS');

  // 4. Punjab Stubble
  const punjab = results.find(r => r.benchmarkId.includes('PUNJAB'));
  assert.ok(punjab);
  assert.equal(punjab.classification.category, 'AGRICULTURAL_BURNING');

  // 5. Similipal Forest Wildfire
  const similipal = results.find(r => r.benchmarkId.includes('SIMILIPAL'));
  assert.ok(similipal);
  assert.equal(similipal.classification.category, 'FOREST_WILDFIRE');

  // 6. Mundra Glint (False Alarm Disproved by Skeptic AI)
  const mundra = results.find(r => r.benchmarkId.includes('MUNDRA'));
  assert.ok(mundra);
  assert.equal(mundra.skepticAudit.isDisproven, true);
  assert.equal(mundra.skepticAudit.action, 'DISCARD_FALSE_ALARM');
});
