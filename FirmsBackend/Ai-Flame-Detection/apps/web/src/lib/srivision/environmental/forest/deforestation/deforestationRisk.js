/**
 * @module environmental/forest/deforestation/deforestationRisk
 * @description Explainable Additive Multi-Factor Deforestation Risk Assessment Baseline.
 */

import { createDataProvenance } from '../../../core/provenance.js';

export function clampNormalized(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1.0, value));
}

/**
 * Calculates deterministic multi-factor deforestation risk score.
 */
export function predictDeforestationRisk({
  pastLossRatePercentPerYear = 0,
  distanceToRoadsKm = 50,
  distanceToAgricultureKm = 50,
  protectedStatus = false,
  activeThermalAnomaliesCount = 0,
} = {}) {
  const factors = [];
  let score = 0.0;

  // Factor 1: Historical Loss Rate (0.0 to 0.35)
  const lossRate = Math.max(0, Number(pastLossRatePercentPerYear) || 0);
  let lossRateScore = 0.0;
  if (lossRate > 5.0) lossRateScore = 0.35;
  else if (lossRate > 2.0) lossRateScore = 0.25;
  else if (lossRate > 0.5) lossRateScore = 0.15;
  else if (lossRate > 0.0) lossRateScore = 0.05;

  score += lossRateScore;
  factors.push({
    factor: 'Historical Deforestation Rate',
    value: `${lossRate.toFixed(1)}% / yr`,
    scoreDelta: lossRateScore,
    influence: lossRateScore > 0.2 ? 'HIGH' : lossRateScore > 0 ? 'MODERATE' : 'NEUTRAL',
  });

  // Factor 2: Proximity to Roads (0.0 to 0.25)
  const roadDist = Math.max(0, Number(distanceToRoadsKm) || 0);
  let roadScore = 0.0;
  if (roadDist < 1.0) roadScore = 0.25;
  else if (roadDist < 5.0) roadScore = 0.18;
  else if (roadDist < 15.0) roadScore = 0.10;
  else if (roadDist < 30.0) roadScore = 0.04;

  score += roadScore;
  factors.push({
    factor: 'Road Proximity Accessibility',
    value: `${roadDist.toFixed(1)} km`,
    scoreDelta: roadScore,
    influence: roadScore >= 0.18 ? 'HIGH' : roadScore > 0 ? 'MODERATE' : 'NEUTRAL',
  });

  // Factor 3: Proximity to Agricultural Encroachment (0.0 to 0.20)
  const agriDist = Math.max(0, Number(distanceToAgricultureKm) || 0);
  let agriScore = 0.0;
  if (agriDist < 1.0) agriScore = 0.20;
  else if (agriDist < 5.0) agriScore = 0.14;
  else if (agriDist < 10.0) agriScore = 0.08;
  else if (agriDist < 25.0) agriScore = 0.03;

  score += agriScore;
  factors.push({
    factor: 'Agricultural Frontier Proximity',
    value: `${agriDist.toFixed(1)} km`,
    scoreDelta: agriScore,
    influence: agriScore >= 0.14 ? 'HIGH' : agriScore > 0 ? 'MODERATE' : 'NEUTRAL',
  });

  // Factor 4: Active Thermal Anomalies (0.0 to 0.25)
  const fireCount = Math.max(0, Number(activeThermalAnomaliesCount) || 0);
  let fireScore = 0.0;
  if (fireCount >= 5) fireScore = 0.25;
  else if (fireCount >= 2) fireScore = 0.18;
  else if (fireCount === 1) fireScore = 0.10;

  score += fireScore;
  factors.push({
    factor: 'Active Thermal Anomaly Clusters',
    value: `${fireCount} detected`,
    scoreDelta: fireScore,
    influence: fireScore >= 0.18 ? 'CRITICAL' : fireScore > 0 ? 'MODERATE' : 'NEUTRAL',
  });

  // Factor 5: Protected Reserve Status (-0.15 mitigation)
  const isProtected = Boolean(protectedStatus);
  let protectionDelta = 0.0;
  if (isProtected) {
    protectionDelta = -0.15;
    score += protectionDelta;
  }
  factors.push({
    factor: 'Legal Protected Area Status',
    value: isProtected ? 'Designated Reserve / National Park' : 'Unprotected Forest Land',
    scoreDelta: protectionDelta,
    influence: isProtected ? 'MITIGATING' : 'NEUTRAL',
  });

  const finalScore = clampNormalized(Math.round(score * 100) / 100);

  let riskTier = 'LOW';
  if (finalScore >= 0.70) riskTier = 'CRITICAL';
  else if (finalScore >= 0.45) riskTier = 'HIGH';
  else if (finalScore >= 0.25) riskTier = 'MODERATE';

  const riskScore100 = Math.round(finalScore * 100);

  return {
    assessment_title: 'DEFORESTATION RISK ASSESSMENT',
    methodology: 'Explainable Multi-Factor Deforestation Risk Baseline',
    risk_score: finalScore,
    risk_score_100: riskScore100,
    risk_level: riskTier,
    risk_tier: riskTier,
    contributing_factors: factors.map((f) => ({
      ...f,
      points: Math.round(f.scoreDelta * 100),
    })),
    provenance: createDataProvenance({
      source: 'sriVision Environmental Risk Heuristic',
      sourceType: 'RULE_BASED',
      confidenceBasis: 'DETERMINISTIC_HEURISTIC_BASELINE',
      limitations: [
        'Deterministic additive scoring baseline; not a predictive machine learning inference model.',
        'Socioeconomic drivers, illegal logging enforcement patrols, and land tenure changes are not modeled.',
      ],
    }),
  };
}
