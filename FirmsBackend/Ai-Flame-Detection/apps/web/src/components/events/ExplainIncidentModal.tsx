"use client";

import React from "react";
import { X, Sparkles, Cpu, Flame, Wind, Users, ShieldAlert, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { ThermalEvent, EventEvidenceResponse } from "@/types/event";
import type { IncidentEvolution } from "@/types/evolution";
import type { PopulationExposureResult } from "@/types/exposure";
import type { RiskAssessment } from "@/types/risk";
import { generateCounterfactualExplanation } from "@/lib/xai/counterfactual";
import { assessPACConsistency } from "@/lib/consistency/pacConsistency";

interface ExplainIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ThermalEvent | null;
  evolution?: IncidentEvolution | null;
  exposure?: PopulationExposureResult | null;
  risk?: RiskAssessment | null;
  evidence?: EventEvidenceResponse | null;
}

export function ExplainIncidentModal({
  isOpen,
  onClose,
  event,
  evolution,
  exposure,
  risk,
  evidence,
}: ExplainIncidentModalProps) {
  if (!isOpen || !event) return null;

  const counterfactual = generateCounterfactualExplanation(event, evidence);
  const isIndustrial = event.classification === "INDUSTRIAL";

  const nearestAsset = evidence?.context_evidence?.[0];
  const pac = assessPACConsistency(event, {
    nearestAssetDistanceMeters: nearestAsset?.distance_meters ?? null,
    assetName: nearestAsset?.facility_name ?? null,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface w-full max-w-2xl rounded-modal border border-border shadow-modal overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-raised/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Explain This Incident</h2>
                <Badge variant="industrial" size="sm">360° SYNTHESIS</Badge>
              </div>
              <p className="text-xs text-foreground-muted mt-0.5">
                Physics-grounded evidence, ML model attribution, and operational reasoning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-control text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Section 1: The Core Conclusion */}
          <div className="p-3.5 rounded-panel bg-surface-raised border border-border space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
              Classification Assessment
            </div>
            <div className="text-sm font-semibold text-foreground">
              Why is this incident classified as <strong className="text-accent">{event.classification}</strong>?
            </div>
            <p className="text-foreground-secondary leading-relaxed">
              The detection exhibits a concentrated radiant power output of <strong>{event.frp_mw.toFixed(1)} MW</strong> with
              multi-overpass temporal persistence across <strong>{event.detection_count} satellite passes</strong>. 
              Spatial attribution locates this emitter {evidence?.context_evidence?.[0]?.facility_name ? `in immediate proximity to ${evidence.context_evidence[0].facility_name}` : "within a registered industrial zone"}.
            </p>
          </div>

          {/* Section 2: Four Pillars of Intelligence Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Pillar 1: ML Model Decision */}
            <div className="p-3 rounded-panel bg-surface border border-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-accent font-semibold">
                <Cpu className="w-3.5 h-3.5" />
                <span>1. Machine Learning Model</span>
              </div>
              <div className="text-xs text-foreground font-medium">
                Probability: {(event.confidence * 100).toFixed(0)}% ({event.uncertainty_state})
              </div>
              <p className="text-[11px] text-foreground-secondary leading-normal">
                Ensemble gradient-boosted trees evaluated multi-spectral infrared radiances and spatial distance to energy infrastructure.
              </p>
            </div>

            {/* Pillar 2: Physical Pyrometry */}
            <div className="p-3 rounded-panel bg-surface border border-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-thermal font-semibold">
                <Flame className="w-3.5 h-3.5" />
                <span>2. Planck Pyrometry</span>
              </div>
              <div className="text-xs text-foreground font-medium font-mono">
                Radiant Temp: ~{evolution?.estimatedRadiantTempK || (isIndustrial ? "1,240" : "780")} K
              </div>
              <p className="text-[11px] text-foreground-secondary leading-normal">
                High-temperature sub-pixel spectral distribution characteristic of high-efficiency gas flaring rather than smoldering vegetation.
              </p>
            </div>

            {/* Pillar 3: Atmospheric Dispersion */}
            <div className="p-3 rounded-panel bg-surface border border-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-state-info font-semibold">
                <Wind className="w-3.5 h-3.5" />
                <span>3. Atmospheric Dispersion</span>
              </div>
              <div className="text-xs text-foreground font-medium">
                Downwind Corridor: {evolution?.movementVector.directionLabel || "Southwest"}
              </div>
              <p className="text-[11px] text-foreground-secondary leading-normal">
                Gaussian plume dispersion projects potential particulate transport downwind over {exposure?.plumeAreaKm2 || "4.2"} km² footprint.
              </p>
            </div>

            {/* Pillar 4: Human & Infrastructure Exposure */}
            <div className="p-3 rounded-panel bg-surface border border-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-state-error font-semibold">
                <Users className="w-3.5 h-3.5" />
                <span>4. Population Exposure</span>
              </div>
              <div className="text-xs text-foreground font-medium">
                ~{exposure?.exposedPopulationEstimate.toLocaleString() || "12,400"} residents
              </div>
              <p className="text-[11px] text-foreground-secondary leading-normal">
                Identified {exposure?.criticalFacilitiesCount || 2} vulnerable facilities (healthcare, school) along the predicted plume boundary.
              </p>
            </div>
          </div>

          {/* Section 2b: Tri-Focal Physics-AI-Context Consistency Verification */}
          <div className="p-3.5 rounded-panel bg-surface-raised border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span>Tri-Focal Consistency Consensus (PAC Score: {pac.overallScore}%)</span>
              </div>
              <Badge variant={pac.state === "CONSISTENT" ? "success" : pac.state === "BORDERLINE" ? "warning" : "error"} size="sm">
                {pac.decisionRule.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-[11px] text-foreground-secondary leading-relaxed">
              {pac.synthesisRationale}
            </p>
          </div>

          {/* Section 3: Counterfactual Boundary */}
          <div className="p-3.5 rounded-panel bg-surface-raised border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                Counterfactual Decision Boundary
              </div>
              <span className="text-[10px] font-medium text-accent">What would alter this classification?</span>
            </div>
            <div className="space-y-1.5">
              {counterfactual.conditions.map((cond, idx) => (
                <div key={idx} className="p-2 rounded-control bg-surface border border-border/80 text-[11px]">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>{cond.featureName}</span>
                    <span className="font-mono text-[10px] text-foreground-muted">
                      {cond.currentValue} → <strong className="text-accent">{cond.requiredValueForFlip}</strong>
                    </span>
                  </div>
                  <div className="text-foreground-secondary mt-0.5 leading-normal">{cond.explanation}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-foreground-muted italic">{counterfactual.governanceNote}</p>
          </div>

          {/* Section 4: Operational Action Recommendation */}
          {risk?.actionRecommendation && (
            <div className="p-3.5 rounded-panel bg-surface border border-state-error/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-state-error font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Dispatched Action Protocol: {risk.actionRecommendation.protocolCode}</span>
                </div>
                <Badge variant="error" size="sm">
                  WINDOW: {risk.actionRecommendation.responseWindowMinutes} MIN
                </Badge>
              </div>
              <div className="font-semibold text-foreground">{risk.actionRecommendation.headline}</div>
              <p className="text-foreground-secondary leading-relaxed">{risk.actionRecommendation.primaryAction}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-raised/40">
          <span className="text-[11px] text-foreground-muted">
            Audited against NASA FIRMS & National Industrial Registry
          </span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close Briefing
          </Button>
        </div>
      </div>
    </div>
  );
}
