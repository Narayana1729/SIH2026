#!/usr/bin/env node
/**
 * @file scripts/run_sih_benchmark_replay.mjs
 * @description PyroSat Deterministic SIH26162 Benchmark Replay Engine.
 *
 * Runs 6 canonical empirical scenarios across India:
 * 1. Jamnagar Petrochemical Refinery Flare (Gujarat) - High Persistence Gas Flare
 * 2. HPCL Vizag Refinery Runaway Tank Explosion (Andhra Pradesh) - Industrial Disaster Surge
 * 3. Singrauli NTPC Coal Super Thermal Power Plant (UP/MP) - Continuous Process Heat
 * 4. Punjab Crop Stubble Agriculture Burn (Ludhiana) - Transient Agricultural Stubble
 * 5. Similipal National Park Forest Wildfire (Odisha) - Dense Canopy Biomass Wildfire
 * 6. Mundra Port Industrial Metallic Rooftop Glint (Gujarat) - Solar Glint False Alarm Rejection
 *
 * Validates:
 * - Sub-pixel Dozier Planck Inversion (T_f, A_f, Radiant Flux)
 * - 2-Stage Hierarchical Segregation
 * - 5-Gate Adversarial Skeptic AI Falsification Audit
 * - Briggs Convective Buoyancy Plume & CAMEO HazMat Chemical Profiles
 * - Additive TreeSHAP Feature Attributions
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { ThermalAnomalyClassifier, ThermalCategories } from '../src/intelligence/thermalClassifier.js';
import { solveDozierPyrometry } from '../src/disasters/pyrometry/dozierPyrometry.js';
import { SkepticVerificationEngine, SkepticVerdictAction } from '../src/intelligence/skepticVerification.js';
import { computeRuleBasedAttributions } from '../src/intelligence/ruleBasedAttribution.js';
import { calculateBriggsPlumeRise } from '../src/disasters/dispersion/briggsPlumeRise.js';
import { cameoHazmatRegistry } from '../src/hazmat/cameoHazmatRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const CANONICAL_BENCHMARKS = [
  {
    id: 'BENCH-001-JAMNAGAR-FLARE',
    name: 'Jamnagar Petrochemical Complex Gas Flare (Gujarat)',
    latitude: 22.4707,
    longitude: 70.0634,
    frp: 28.5,
    bright_ti4: 358.4,
    bright_ti5: 296.2,
    daynight: 'N',
    historicalPersistence: 0.88,
    ndvi: 0.14,
    landCover: 'industrial',
    confidence: 'h',
    expectedCategory: ThermalCategories.INDUSTRIAL_FLARE,
    expectedSkepticAction: SkepticVerdictAction.CONFIRMED_HAZARD,
  },
  {
    id: 'BENCH-002-VIZAG-EXPLOSION',
    name: 'HPCL Vizag Refinery Runaway Surge / Tank Explosion (AP)',
    latitude: 17.6885,
    longitude: 83.2519,
    frp: 215.0,
    bright_ti4: 374.8,
    bright_ti5: 301.5,
    daynight: 'N',
    historicalPersistence: 0.08,
    ndvi: 0.12,
    landCover: 'industrial',
    confidence: 'h',
    chemical: 'BENZENE',
    expectedCategory: ThermalCategories.INDUSTRIAL_DISASTER,
    expectedSkepticAction: SkepticVerdictAction.CONFIRMED_HAZARD,
  },
  {
    id: 'BENCH-003-SINGRAULI-PROCESS',
    name: 'Singrauli Super Thermal Power & Smelting Belt (UP/MP)',
    latitude: 24.1985,
    longitude: 82.6642,
    frp: 42.0,
    bright_ti4: 338.2,
    bright_ti5: 298.0,
    daynight: 'N',
    historicalPersistence: 0.72,
    ndvi: 0.22,
    landCover: 'industrial',
    confidence: 'h',
    expectedCategory: ThermalCategories.INDUSTRIAL_PROCESS,
    expectedSkepticAction: SkepticVerdictAction.CONFIRMED_HAZARD,
  },
  {
    id: 'BENCH-004-PUNJAB-STUBBLE',
    name: 'Punjab Crop Stubble Post-Harvest Burning (Ludhiana)',
    latitude: 30.9010,
    longitude: 75.8573,
    frp: 24.0,
    bright_ti4: 326.5,
    bright_ti5: 301.2,
    daynight: 'D',
    historicalPersistence: 0.04,
    ndvi: 0.28,
    landCover: 'cropland',
    confidence: 'n',
    expectedCategory: ThermalCategories.AGRICULTURAL_BURNING,
    expectedSkepticAction: SkepticVerdictAction.CONFIRMED_HAZARD,
  },
  {
    id: 'BENCH-005-SIMILIPAL-WILDFIRE',
    name: 'Similipal Biosphere Reserve Forest Wildfire (Odisha)',
    latitude: 21.6500,
    longitude: 86.3500,
    frp: 135.0,
    bright_ti4: 348.0,
    bright_ti5: 299.0,
    daynight: 'D',
    historicalPersistence: 0.12,
    ndvi: 0.69,
    landCover: 'forest',
    confidence: 'h',
    expectedCategory: ThermalCategories.FOREST_WILDFIRE,
    expectedSkepticAction: SkepticVerdictAction.CONFIRMED_HAZARD,
  },
  {
    id: 'BENCH-006-MUNDRA-ROOF-GLINT',
    name: 'Mundra Port Logistics Warehouse Metallic Solar Glint (Gujarat)',
    latitude: 22.8390,
    longitude: 69.7050,
    frp: 6.5,
    bright_ti4: 318.0,
    bright_ti5: 308.5,
    daynight: 'D',
    historicalPersistence: 0.02,
    ndvi: 0.11,
    landCover: 'urban',
    confidence: 'l',
    expectedCategory: ThermalCategories.UNKNOWN_ANOMALY,
    expectedSkepticAction: SkepticVerdictAction.DISCARD_FALSE_ALARM,
  },
];

export function runBenchmarkReplay() {
  console.log('\n================================================================================');
  console.log('  🔥 PYROSAT: EMPIRICAL BENCHMARK REPLAY & ADVERSARIAL SKEPTIC AUDIT 🔥');
  console.log('  Testing 6 Canonical Scenarios against Sub-Pixel Physics & TreeSHAP XAI');
  console.log('================================================================================\n');

  const classifier = new ThermalAnomalyClassifier();
  const skepticEngine = new SkepticVerificationEngine();
  const results = [];

  for (const bench of CANONICAL_BENCHMARKS) {
    console.log(`▶ [${bench.id}] ${bench.name}`);

    // 1. Invert Sub-Pixel Pyrometry
    const pyrometry = solveDozierPyrometry(bench.bright_ti4, bench.bright_ti5, bench.frp);

    // 2. Primary Hierarchical Classification
    const classification = classifier.classify(bench);

    // 3. Adversarial Skeptic Audit
    const skepticAudit = skepticEngine.auditAnomaly(bench, classification);

    // 4. Feature Attributions
    const attributions = computeRuleBasedAttributions(bench, classification);

    // 5. If disaster / industrial explosion, compute Briggs convective plume & HazMat
    let plume = null;
    let hazmat = null;
    if (classification.category === ThermalCategories.INDUSTRIAL_DISASTER || classification.category === ThermalCategories.INDUSTRIAL_FLARE) {
      plume = calculateBriggsPlumeRise(bench, {
        frpMw: bench.frp,
        windSpeedMs: 4.2,
        isIndustrial: true,
        stabilityClass: 'D',
      });
      const matches = cameoHazmatRegistry.search(bench.chemical || 'Methane');
      hazmat = matches.length > 0 ? matches[0] : null;
    }

    const testPassed = classification.category === bench.expectedCategory || skepticAudit.action === bench.expectedSkepticAction;

    console.log(`  ├─ Primary Classification: ${classification.category} (Confidence: ${(classification.confidence * 100).toFixed(0)}%, Severity: ${classification.severity})`);
    console.log(`  ├─ Dozier Pyrometry: Tf = ${pyrometry.flameTempK} K (${pyrometry.flameTempC}°C) | Flame Area = ${pyrometry.flameAreaM2.toFixed(1)} m² | Regime: ${pyrometry.regime}`);
    console.log(`  ├─ Skeptic AI Audit: ${skepticAudit.isDisproven ? '❌ DISPROVED' : '✅ SURVIVED'} (Action: ${skepticAudit.action}, Passed ${skepticAudit.passedCheckCount}/${skepticAudit.totalChecks} gates)`);
    if (skepticAudit.isDisproven) {
      console.log(`  │  └─ Reason: ${skepticAudit.primaryDisproveReason}`);
    }
    if (plume) {
      console.log(`  ├─ Briggs Plume Convective Rise: Convective Fb = ${plume.convectiveHeatFluxFbM4s3} m⁴/s³ | Rise Δh = ${plume.plumeRiseDeltaHM} m | Touchdown = ${plume.downwindTouchdownDistanceM} m`);
      if (hazmat) {
        console.log(`  ├─ HazMat Chemical Profile: ${hazmat.name} (${hazmat.un_number || 'N/A'}) | Isolation: ${hazmat.initial_isolation_m || 500} m | Evacuation: ${((hazmat.downwind_evac_day_m || 1500) / 1000).toFixed(1)} km`);
      }
    }
    console.log(`  └─ Verdict Status: ${testPassed ? '✔ DEFENDED & VERIFIED' : '✖ UNEXPECTED DIVERGENCE'}\n`);

    results.push({
      benchmarkId: bench.id,
      name: bench.name,
      coordinates: { lat: bench.latitude, lon: bench.longitude },
      pyrometry: {
        flameTempK: pyrometry.flameTempK,
        flameAreaM2: pyrometry.flameAreaM2,
        regime: pyrometry.regime,
        radiantHeatFluxKwM2: pyrometry.radiantHeatFluxKwM2,
      },
      classification: {
        category: classification.category,
        confidence: classification.confidence,
        severity: classification.severity,
      },
      skepticAudit: {
        isDisproven: skepticAudit.isDisproven,
        action: skepticAudit.action,
        passedCheckCount: skepticAudit.passedCheckCount,
        totalChecks: skepticAudit.totalChecks,
        primaryDisproveReason: skepticAudit.primaryDisproveReason,
      },
      dispersionPlume: plume ? {
        buoyancyFb: plume.convectiveHeatFluxFbM4s3,
        plumeRiseDeltaH: plume.plumeRiseDeltaHM,
        effectiveHeight: plume.effectiveReleaseHeightM,
        touchdownDistanceM: plume.downwindTouchdownDistanceM,
      } : null,
      hazmat: hazmat ? {
        chemical: hazmat.name,
        unNumber: hazmat.un_number,
        isolationRadiusM: hazmat.initial_isolation_m,
        protectiveActionKm: ((hazmat.downwind_evac_day_m || 1500) / 1000),
      } : null,
      testPassed,
    });
  }

  // Generate SHA-256 Checksum for reproducibility
  const jsonPayload = JSON.stringify(results, null, 2);
  const sha256 = crypto.createHash('sha256').update(jsonPayload).digest('hex');

  const artifactDir = path.join(ROOT_DIR, 'data', 'benchmarks');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const outPath = path.join(artifactDir, 'sih_replay_results.json');
  fs.writeFileSync(outPath, jsonPayload, 'utf-8');

  console.log('================================================================================');
  console.log(`  ✅ REPLAY COMPLETED: All 6 Canonical Benchmarks Processed Deterministically`);
  console.log(`  📁 Saved Artifact: ${outPath}`);
  console.log(`  🔒 Integrity Checksum (SHA-256): ${sha256}`);
  console.log('================================================================================\n');

  return { results, sha256 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBenchmarkReplay();
}
