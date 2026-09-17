/**
 * Types for the Tri-Focal Physics-AI-Context (PAC) Consistency Scoring Engine.
 * 
 * Evaluates mutual cross-domain coherence between:
 * 1. ML Evidence (Statistical model probabilities and confidence)
 * 2. Physics Evidence (Planck effective flame temperature, FRP surface density)
 * 3. Context Evidence (Geospatial proximity to known assets, land-use, persistence)
 */

export type PACDomain = 'ML' | 'PHYSICS' | 'CONTEXT';

export type PACDomainStatus = 'SUPPORTING' | 'NEUTRAL' | 'CONFLICTING';

export interface PACDomainScore {
  domain: PACDomain;
  score: number; // 0.0 to 1.0 normalized
  weight: number; // Weight in final consensus
  status: PACDomainStatus;
  primaryObservation: string;
  expectedRange: string;
  measuredValue: string;
}

export interface PACConflict {
  id: string;
  domains: [PACDomain, PACDomain];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  penaltyApplied: number; // Subtracted from consensus score (e.g. 0.15 to 0.40)
  resolutionAction: string;
}

export type PACConsistencyState = 
  | 'CONSISTENT'            // High coherence across all 3 pillars (Auto-dispatch permitted)
  | 'BORDERLINE'            // Minor discrepancy or unconfirmed context (Cautionary watch)
  | 'DISCORDANT_CONFLICT';  // Mutual contradiction across domains (Forced human review / fail-safe)

export interface PACConsistencyResult {
  eventId: string;
  classification: string;
  overallScore: number; // 0 to 100
  state: PACConsistencyState;
  decisionRule: 'AUTO_DISPATCH_AUTHORIZED' | 'OPERATOR_AUDIT_RECOMMENDED' | 'MANDATORY_HUMAN_REVIEW';
  domainScores: {
    ml: PACDomainScore;
    physics: PACDomainScore;
    context: PACDomainScore;
  };
  conflicts: PACConflict[];
  synthesisRationale: string;
  failSafeTriggered: boolean;
}
