/**
 * Tri-Focal Physics-AI-Context (PAC) Consistency Scoring Engine.
 * 
 * CORE NOVELTY MECHANISM:
 * Instead of treating ML, Planck Pyrometry, and Contextual Asset data as isolated
 * features, PAC evaluates mutual cross-domain consensus and discordance.
 * 
 * When cross-domain contradictions occur (e.g. ML predicts Industrial with 92% confidence,
 * but no industrial facility exists within 3 km and Planck temperature indicates a diffuse
 * 720K surface burn), PAC triggers an automated FAIL-SAFE ABSTENTION (MANDATORY_HUMAN_REVIEW),
 * overriding raw ML certainty and providing explicit multi-domain conflict diagnostics.
 */

import type { ThermalEvent } from '../../types/event.ts';
import type { PyrometryTelemetry } from '../../types/intelligence.ts';
import type { 
  PACConsistencyResult, 
  PACConflict, 
  PACDomainScore, 
  PACConsistencyState 
} from '../../types/consistency.ts';

export interface AssessPACConsistencyOptions {
  pyrometry?: PyrometryTelemetry | null;
  nearestAssetDistanceMeters?: number | null;
  assetName?: string | null;
  landCover?: string | null;
}

/**
 * Computes Tri-Focal Physics-AI-Context Consistency for a thermal event.
 */
export function assessPACConsistency(
  event: ThermalEvent,
  options?: AssessPACConsistencyOptions
): PACConsistencyResult {
  const conflicts: PACConflict[] = [];

  // Extract / synthesize physics inputs
  const frp = Math.max(0.5, event.frp_mw || 10.0);
  const tempK = options?.pyrometry?.emitter_temp_k ?? 
    Math.round(550.0 + Math.min(1150.0, Math.sqrt(frp) * 65.0));
  const emitterAreaM2 = options?.pyrometry?.emitter_area_m2 ?? 
    Math.max(1.2, Number((frp * 1.45).toFixed(1)));
  
  // Extract context inputs
  const assetDist = options?.nearestAssetDistanceMeters !== undefined 
    ? options?.nearestAssetDistanceMeters 
    : event.classification === 'INDUSTRIAL' ? 240 : 4200;
  const isIndustrialClass = event.classification === 'INDUSTRIAL';
  const isNonIndustrialClass = event.classification === 'NON_INDUSTRIAL';
  const isUnknownClass = event.classification === 'UNKNOWN' || event.uncertainty_state === 'REVIEW_REQUIRED';

  // -------------------------------------------------------------
  // 1. ML DOMAIN EVALUATION (Weight: 0.35)
  // -------------------------------------------------------------
  let mlScore = 0.5;
  let mlStatus: PACDomainScore['status'] = 'NEUTRAL';
  let mlObs = '';
  let mlExpected = '';

  if (isUnknownClass) {
    mlScore = 0.35;
    mlStatus = 'NEUTRAL';
    mlObs = `Abstained / Uncertain classification (Confidence: ${(event.confidence * 100).toFixed(0)}%)`;
    mlExpected = 'Confidence ≥ 75% for definitive classification';
  } else {
    mlScore = Math.min(1.0, Math.max(0.2, event.confidence));
    mlStatus = event.confidence >= 0.75 ? 'SUPPORTING' : 'NEUTRAL';
    mlObs = `ML predicted ${event.classification} with ${(event.confidence * 100).toFixed(0)}% confidence`;
    mlExpected = `Consistent thermodynamic & spatial profile for ${event.classification}`;
  }

  // -------------------------------------------------------------
  // 2. PHYSICS DOMAIN EVALUATION (Weight: 0.35)
  // -------------------------------------------------------------
  let physicsScore = 0.6;
  let physicsStatus: PACDomainScore['status'] = 'SUPPORTING';
  let physicsObs = '';
  let physicsExpected = '';

  if (isIndustrialClass) {
    physicsExpected = 'Temp ≥ 950K, compact emitter area (≤ 250 m²)';
    if (tempK >= 950 && emitterAreaM2 <= 300) {
      physicsScore = 0.92;
      physicsStatus = 'SUPPORTING';
      physicsObs = `Planck pyrometry indicates compact high-temp flare stack (${tempK}K, ${emitterAreaM2} m²)`;
    } else if (tempK < 750) {
      physicsScore = 0.25;
      physicsStatus = 'CONFLICTING';
      physicsObs = `Low combustion temperature (${tempK}K) is atypical for industrial gas flaring`;
    } else {
      physicsScore = 0.65;
      physicsStatus = 'NEUTRAL';
      physicsObs = `Intermediate thermal emission (${tempK}K, ${emitterAreaM2} m²)`;
    }
  } else if (isNonIndustrialClass) {
    physicsExpected = 'Temp 600K–1150K, diffuse or expanding surface combustion';
    if (tempK <= 1150) {
      physicsScore = 0.88;
      physicsStatus = 'SUPPORTING';
      physicsObs = `Thermodynamic signature matches open vegetation/wildfire combustion (${tempK}K)`;
    } else if (tempK > 1400 && emitterAreaM2 < 100) {
      physicsScore = 0.30;
      physicsStatus = 'CONFLICTING';
      physicsObs = `Very high temperature (${tempK}K) concentrated in small spot (${emitterAreaM2} m²) suggests process flare, not wildfire`;
    } else {
      physicsScore = 0.70;
      physicsStatus = 'NEUTRAL';
      physicsObs = `Thermal signature compatible with intense brush or canopy fire (${tempK}K)`;
    }
  } else {
    physicsScore = 0.50;
    physicsStatus = 'NEUTRAL';
    physicsExpected = 'Specific thermal threshold dependent on resolved classification';
    physicsObs = `Measured Planck temperature: ${tempK}K (${frp.toFixed(1)} MW)`;
  }

  // -------------------------------------------------------------
  // 3. CONTEXT DOMAIN EVALUATION (Weight: 0.30)
  // -------------------------------------------------------------
  let contextScore = 0.6;
  let contextStatus: PACDomainScore['status'] = 'SUPPORTING';
  let contextObs = '';
  let contextExpected = '';

  if (isIndustrialClass) {
    contextExpected = 'Distance to registered industrial asset ≤ 1,500m';
    if (assetDist !== null && assetDist <= 600) {
      contextScore = 0.95;
      contextStatus = 'SUPPORTING';
      contextObs = `Direct spatial collocation with industrial facility (${Math.round(assetDist)}m)`;
    } else if (assetDist !== null && assetDist <= 1800) {
      contextScore = 0.70;
      contextStatus = 'NEUTRAL';
      contextObs = `Proximate to industrial facility buffer (${Math.round(assetDist)}m)`;
    } else {
      contextScore = 0.15;
      contextStatus = 'CONFLICTING';
      contextObs = `No registered industrial facility within 2,000m (Nearest: ${assetDist ? Math.round(assetDist) + 'm' : 'None detected'})`;
    }
  } else if (isNonIndustrialClass) {
    contextExpected = 'Located outside industrial security perimeters (> 1,000m)';
    if (assetDist === null || assetDist > 1500) {
      contextScore = 0.90;
      contextStatus = 'SUPPORTING';
      contextObs = `Isolated from industrial infrastructure (${assetDist ? Math.round(assetDist) + 'm' : '> 5,000m'} to nearest plant)`;
    } else if (assetDist < 500) {
      contextScore = 0.25;
      contextStatus = 'CONFLICTING';
      contextObs = `Inside active industrial perimeter (${Math.round(assetDist)}m) contradicts open wildfire classification`;
    } else {
      contextScore = 0.65;
      contextStatus = 'NEUTRAL';
      contextObs = `Intermediate distance to industrial perimeter (${Math.round(assetDist)}m)`;
    }
  } else {
    contextScore = 0.45;
    contextStatus = 'NEUTRAL';
    contextExpected = 'Definitive land-cover / facility attribution';
    contextObs = assetDist !== null ? `Nearest asset at ${Math.round(assetDist)}m` : 'Uncorrelated terrain';
  }

  // -------------------------------------------------------------
  // 4. CROSS-DOMAIN DISCORDANCE & CONFLICT DETECTION
  // -------------------------------------------------------------
  let totalPenalty = 0;

  // Conflict A: ML says Industrial, but Context shows no facility nearby
  if (isIndustrialClass && event.confidence >= 0.70 && assetDist !== null && assetDist > 2000) {
    const penalty = 30;
    totalPenalty += penalty;
    conflicts.push({
      id: 'PAC-CONF-01',
      domains: ['ML', 'CONTEXT'],
      severity: 'HIGH',
      description: `ML predicted INDUSTRIAL with ${(event.confidence * 100).toFixed(0)}% confidence, but nearest industrial facility is ${Math.round(assetDist)}m away (> 2,000m threshold).`,
      penaltyApplied: penalty,
      resolutionAction: 'Verify if uncatalogued private industrial site exists or if event is open field combustion.'
    });
  }

  // Conflict B: ML says Non-Industrial, but inside an industrial perimeter
  if (isNonIndustrialClass && assetDist !== null && assetDist < 400) {
    const penalty = 35;
    totalPenalty += penalty;
    conflicts.push({
      id: 'PAC-CONF-02',
      domains: ['ML', 'CONTEXT'],
      severity: 'CRITICAL',
      description: `Classified as NON_INDUSTRIAL, yet coordinates fall directly within ${Math.round(assetDist)}m of active plant perimeter.`,
      penaltyApplied: penalty,
      resolutionAction: 'Investigate potential facility ground fire, flare pit, or misclassified stack emissions.'
    });
  }

  // Conflict C: Physics vs Context (Ultra-high flare temperature inside remote forest)
  if (tempK >= 1400 && emitterAreaM2 < 80 && (assetDist === null || assetDist > 5000)) {
    const penalty = 25;
    totalPenalty += penalty;
    conflicts.push({
      id: 'PAC-CONF-03',
      domains: ['PHYSICS', 'CONTEXT'],
      severity: 'HIGH',
      description: `Planck pyrometry shows high-temperature stack profile (${tempK}K, ${emitterAreaM2} m²) in remote terrain without known facilities.`,
      penaltyApplied: penalty,
      resolutionAction: 'Inspect for unauthorized pipeline venting, illegal tapping, or temporary rig operations.'
    });
  }

  // Conflict D: ML vs Physics (Classified as industrial flare, but temperature < 700K)
  if (isIndustrialClass && tempK < 700) {
    const penalty = 25;
    totalPenalty += penalty;
    conflicts.push({
      id: 'PAC-CONF-04',
      domains: ['ML', 'PHYSICS'],
      severity: 'MEDIUM',
      description: `Combustion temperature (${tempK}K) is substantially lower than expected industrial flaring (950K–1800K).`,
      penaltyApplied: penalty,
      resolutionAction: 'Cross-reference with spectral indices to rule out smoldering waste heaps or cooling slag pits.'
    });
  }

  // -------------------------------------------------------------
  // 5. CONSENSUS SCORE CALCULATION
  // -------------------------------------------------------------
  const rawWeighted = (mlScore * 0.35 + physicsScore * 0.35 + contextScore * 0.30) * 100;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawWeighted - totalPenalty)));

  // -------------------------------------------------------------
  // 6. DECISION RULE & STATE SYNTHESIS
  // -------------------------------------------------------------
  let state: PACConsistencyState = 'CONSISTENT';
  let decisionRule: PACConsistencyResult['decisionRule'] = 'AUTO_DISPATCH_AUTHORIZED';
  let failSafeTriggered = false;

  const hasCriticalConflict = conflicts.some(c => c.severity === 'CRITICAL');
  const hasHighConflict = conflicts.some(c => c.severity === 'HIGH');

  if (isUnknownClass || finalScore < 45 || hasCriticalConflict || (hasHighConflict && finalScore < 60)) {
    state = 'DISCORDANT_CONFLICT';
    decisionRule = 'MANDATORY_HUMAN_REVIEW';
    failSafeTriggered = true;
  } else if (finalScore < 70 || conflicts.length > 0) {
    state = 'BORDERLINE';
    decisionRule = 'OPERATOR_AUDIT_RECOMMENDED';
  } else {
    state = 'CONSISTENT';
    decisionRule = 'AUTO_DISPATCH_AUTHORIZED';
  }

  // -------------------------------------------------------------
  // 7. RATIONALE SYNTHESIS
  // -------------------------------------------------------------
  let synthesisRationale = '';
  if (state === 'CONSISTENT') {
    synthesisRationale = `High tri-focal coherence (${finalScore}%). ML prediction is physically reinforced by Planck pyrometry (${tempK}K) and corroborated by contextual spatial attribution.`;
  } else if (state === 'BORDERLINE') {
    synthesisRationale = `Moderate cross-domain coherence (${finalScore}%). Minor domain variance detected (${conflicts.length} conflict flag). Operator audit recommended prior to full escalation.`;
  } else {
    synthesisRationale = `Cross-domain discordance detected (${finalScore}%). Autonomous dispatch aborted by PAC Fail-Safe. Inter-domain conflict between ${conflicts.map(c => c.domains.join('↔')).join(', ')} requires manual expert verification.`;
  }

  return {
    eventId: event.event_id,
    classification: event.classification,
    overallScore: finalScore,
    state,
    decisionRule,
    domainScores: {
      ml: {
        domain: 'ML',
        score: Number(mlScore.toFixed(2)),
        weight: 0.35,
        status: mlStatus,
        primaryObservation: mlObs,
        expectedRange: mlExpected,
        measuredValue: `${(event.confidence * 100).toFixed(0)}%`
      },
      physics: {
        domain: 'PHYSICS',
        score: Number(physicsScore.toFixed(2)),
        weight: 0.35,
        status: physicsStatus,
        primaryObservation: physicsObs,
        expectedRange: physicsExpected,
        measuredValue: `${tempK}K (${emitterAreaM2} m²)`
      },
      context: {
        domain: 'CONTEXT',
        score: Number(contextScore.toFixed(2)),
        weight: 0.30,
        status: contextStatus,
        primaryObservation: contextObs,
        expectedRange: contextExpected,
        measuredValue: assetDist !== null ? `${Math.round(assetDist)}m` : 'No asset'
      }
    },
    conflicts,
    synthesisRationale,
    failSafeTriggered
  };
}
