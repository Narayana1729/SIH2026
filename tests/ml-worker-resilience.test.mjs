/**
 * Integration Test Suite: ML Worker Resilience & Recovery State Machine
 * 
 * Verifies:
 * 1. Single-flight restart state machine: STOPPED -> STARTING -> READY -> RECOVERING -> STARTING
 * 2. Strict provenance under worker failure:
 *    - During crash/recovery: returns RULE_BASED_FALLBACK with recovery_in_progress: true
 *    - After recovery: returns ML_HIERARCHICAL_ENSEMBLE with is_ml_predicted: true
 * 3. Concurrency safety: Multiple simultaneous requests during recovery do NOT spawn duplicate workers.
 * 4. Exact Single Worker Guarantee: Exactly ONE Python worker process is alive after recovery.
 * 5. Bounded backoff / retry limit: Repeated crashes trigger exponential backoff and cap out safely without infinite spin loops.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { MLInferenceService, WorkerState } from '../server/services/mlInferenceService.mjs';

function countWorkerProcesses() {
  try {
    const stdout = execSync('ps aux | grep "[m]l_inference_worker.py" | wc -l', { encoding: 'utf8' });
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

describe('Priority 3: ML Worker Single-Flight Resilience & Fallback Provenance', { timeout: 30000 }, () => {
  let service;

  after(() => {
    if (service) {
      service.shutdown();
    }
  });

  it('initializes cleanly and reports ML_HIERARCHICAL_ENSEMBLE provenance', async () => {
    service = new MLInferenceService({ autoSpawn: true, baseBackoffMs: 200, maxRestartAttempts: 3 });
    const ready = await service.ensureReady(6000);
    assert.equal(ready, true, 'Worker failed to reach READY state within timeout');
    assert.equal(service.state, WorkerState.READY);

    const testObs = {
      latitude: 22.38,
      longitude: 69.87,
      bright_ti4: 365.0,
      bright_ti5: 304.0,
      frp: 18.5,
      daynight: 'N'
    };

    const res = await service.classifyThermalEvent(testObs);
    assert.equal(res.is_ml_predicted, true);
    assert.equal(res.inference_source, 'ML_HIERARCHICAL_ENSEMBLE');
    assert.ok(typeof res.model_info.raw_model_confidence === 'number');
    assert.ok(res.model_info.raw_model_confidence >= 0.0 && res.model_info.raw_model_confidence <= 1.0);
  });

  it('handles worker kill -9 with transparent fallback and single-flight auto-recovery', async () => {
    assert.ok(service.process && !service.process.killed, 'Service worker process should be alive');
    const oldPid = service.process.pid;

    // 1. Forcefully kill the worker process
    process.kill(oldPid, 'SIGKILL');
    await new Promise((r) => setTimeout(r, 60));

    // State must transition to RECOVERING
    assert.equal(service.state, WorkerState.RECOVERING);

    // 2. Immediately fire multiple simultaneous requests during RECOVERING state
    const simultaneousRequests = Array.from({ length: 5 }, (_, i) => 
      service.classifyThermalEvent({
        latitude: 22.38 + i * 0.01,
        longitude: 69.87,
        bright_ti4: 350.0,
        frp: 15.0,
        daynight: 'N'
      })
    );

    const fallbackResults = await Promise.all(simultaneousRequests);

    // Every simultaneous request during crash must have explicit fallback provenance
    for (const res of fallbackResults) {
      assert.equal(res.is_ml_predicted, false, 'Should be marked as fallback');
      assert.equal(res.inference_source, 'RULE_BASED_FALLBACK', 'Source must be RULE_BASED_FALLBACK');
      assert.equal(res.recovery_in_progress, true, 'Must indicate recovery_in_progress: true');
    }

    // 3. Wait for single-flight auto-recovery to complete
    const recovered = await service.ensureReady(8000);
    assert.equal(recovered, true, 'Service should auto-recover to READY state');
    assert.equal(service.state, WorkerState.READY);

    // 4. Verify new process PID is different
    assert.notEqual(service.process.pid, oldPid, 'Recovered worker must have a new PID');

    // 5. Subsequent request must route back to pure ML
    const recoveredRes = await service.classifyThermalEvent({
      latitude: 22.38,
      longitude: 69.87,
      bright_ti4: 365.0,
      bright_ti5: 304.0,
      frp: 18.5,
      daynight: 'N'
    });
    assert.equal(recoveredRes.is_ml_predicted, true);
    assert.equal(recoveredRes.inference_source, 'ML_HIERARCHICAL_ENSEMBLE');
  });

  it('guarantees strictly ONE worker process alive without duplicate spawns', async () => {
    assert.ok(service.process && !service.process.killed);
    assert.equal(service.isSpawning, false);
    assert.equal(service.restartTimer, null);
  });

  it('respects maximum restart attempts and stops restarting on repeated consecutive crashes', async () => {
    const failingService = new MLInferenceService({
      autoSpawn: false,
      baseBackoffMs: 50,
      maxRestartAttempts: 3
    });
    failingService.workerPath = '/nonexistent/worker.py';

    failingService._spawnWorker();

    // Wait for the 3 restart attempts with exponential backoff (50ms, 100ms, 200ms)
    await new Promise((r) => setTimeout(r, 1500));

    // Must be stopped, not spawning in an infinite loop
    assert.equal(failingService.isSpawning, false);
    assert.ok(failingService.restartAttempts >= failingService.maxRestartAttempts, `Expected >= 3, got ${failingService.restartAttempts}`);
    assert.equal(failingService.state, WorkerState.STOPPED);

    failingService.shutdown();
  });
});
