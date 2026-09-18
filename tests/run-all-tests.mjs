#!/usr/bin/env node
/**
 * @module tests/run-all-tests
 * @description Master automated test runner for sriVision.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  'tests/firms.test.mjs',
  'tests/thermal-classifier.test.mjs',
  'tests/pyrometry-and-xai.test.mjs',
  'tests/sih-firms-backend.test.mjs',
  'tests/disaster-extensions.test.mjs',
  'tests/weather.test.mjs',
  'tests/correlation.test.mjs',
  'tests/event-driven.test.mjs',
  'tests/production-backend.test.mjs',
  'tests/server.test.mjs',
  'tests/security.test.mjs',
  'tests/ml-and-science.test.mjs',
  'tests/p1-strengthen.test.mjs',
  'tests/real-sat-treeshap.test.mjs',
  'tests/ml-worker-resilience.test.mjs',
  'tests/briggs-plume-rise.test.mjs',
  'tests/enhanced-validation.test.mjs',
  'tests/satellite-revisit.test.mjs',
  'src/firstRunExperience.test.mjs',
];

console.log('[PyroSat Test Runner] Executing test suites across all industrial thermal & intelligence domains...\n');

const proc = spawn(process.execPath, ['--test', ...testFiles], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' },
});

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All PyroSat test suites passed successfully!');
    process.exit(0);
  } else {
    console.error(`\n❌ PyroSat test runner exited with code ${code}`);
    process.exit(code || 1);
  }
});
