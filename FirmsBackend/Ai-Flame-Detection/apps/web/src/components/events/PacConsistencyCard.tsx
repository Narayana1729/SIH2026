"use client";

import React from "react";
import { ThermalEvent } from "@/types/event";
import { PyrometryTelemetry } from "@/types/intelligence";
import { assessPACConsistency } from "@/lib/consistency/pacConsistency";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Flame, 
  MapPin, 
  AlertOctagon,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PacConsistencyCardProps {
  event: ThermalEvent;
  pyrometry?: PyrometryTelemetry | null;
  nearestAssetDistanceMeters?: number | null;
  assetName?: string | null;
  className?: string;
}

export function PacConsistencyCard({
  event,
  pyrometry,
  nearestAssetDistanceMeters,
  assetName,
  className
}: PacConsistencyCardProps) {
  const pac = assessPACConsistency(event, {
    pyrometry,
    nearestAssetDistanceMeters,
    assetName
  });

  const isConsistent = pac.state === "CONSISTENT";
  const isBorderline = pac.state === "BORDERLINE";
  const isConflict = pac.state === "DISCORDANT_CONFLICT";

  return (
    <div
      className={cn(
        "p-3 rounded-control border font-mono space-y-2.5 transition-colors",
        isConflict 
          ? "bg-state-error/5 border-state-error/30" 
          : isBorderline
          ? "bg-state-warning/5 border-state-warning/30"
          : "bg-surface/90 border-border/80",
        className
      )}
    >
      {/* 1. Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className={cn(
            "w-3.5 h-3.5",
            isConflict ? "text-state-error" : isBorderline ? "text-state-warning" : "text-state-success"
          )} />
          <span className="text-[11px] font-bold tracking-wider uppercase text-foreground">
            Physics-AI-Context (PAC) Consistency
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded font-semibold border",
            isConflict 
              ? "bg-state-error/15 text-state-error border-state-error/30" 
              : isBorderline
              ? "bg-state-warning/15 text-state-warning border-state-warning/30"
              : "bg-state-success/15 text-state-success border-state-success/30"
          )}>
            {pac.state === "DISCORDANT_CONFLICT" ? "DISCORDANCE / FAIL-SAFE" : pac.state}
          </span>
          <span className="text-[10px] font-bold text-foreground">
            {pac.overallScore}%
          </span>
        </div>
      </div>

      {/* 2. Rationale & Decision Banner */}
      <div className="p-2 rounded bg-background/50 border border-border/40 text-[10px] space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-foreground-muted uppercase tracking-wider text-[9px]">Decision Protocol:</span>
          <span className={cn(
            "font-semibold text-[9.5px]",
            isConflict ? "text-state-error" : isBorderline ? "text-state-warning" : "text-state-success"
          )}>
            {pac.decisionRule.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-foreground/90 text-[10px] leading-relaxed">
          {pac.synthesisRationale}
        </p>
      </div>

      {/* 3. Tri-Focal Pillars Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-[9.5px]">
        {/* ML Pillar */}
        <div className="p-1.5 rounded bg-background/40 border border-border/40 space-y-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-foreground-muted text-[9px]">
              <Cpu className="w-3 h-3 text-brand-primary" />
              <span>ML Pillar</span>
            </div>
            <span className={cn(
              "text-[8.5px] px-1 rounded",
              pac.domainScores.ml.status === "SUPPORTING" ? "text-state-success bg-state-success/10" : "text-foreground-muted bg-surface"
            )}>
              {(pac.domainScores.ml.score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="font-semibold text-foreground truncate text-[9.5px]">
            {pac.domainScores.ml.measuredValue}
          </div>
          <div className="text-[8.5px] text-foreground-muted truncate" title={pac.domainScores.ml.primaryObservation}>
            {pac.domainScores.ml.primaryObservation}
          </div>
        </div>

        {/* Physics Pillar */}
        <div className="p-1.5 rounded bg-background/40 border border-border/40 space-y-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-foreground-muted text-[9px]">
              <Flame className="w-3 h-3 text-thermal-primary" />
              <span>Physics</span>
            </div>
            <span className={cn(
              "text-[8.5px] px-1 rounded",
              pac.domainScores.physics.status === "SUPPORTING" 
                ? "text-state-success bg-state-success/10" 
                : pac.domainScores.physics.status === "CONFLICTING"
                ? "text-state-error bg-state-error/10"
                : "text-state-warning bg-state-warning/10"
            )}>
              {(pac.domainScores.physics.score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="font-semibold text-foreground truncate text-[9.5px]">
            {pac.domainScores.physics.measuredValue}
          </div>
          <div className="text-[8.5px] text-foreground-muted truncate" title={pac.domainScores.physics.primaryObservation}>
            {pac.domainScores.physics.primaryObservation}
          </div>
        </div>

        {/* Context Pillar */}
        <div className="p-1.5 rounded bg-background/40 border border-border/40 space-y-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-foreground-muted text-[9px]">
              <MapPin className="w-3 h-3 text-blue-500" />
              <span>Context</span>
            </div>
            <span className={cn(
              "text-[8.5px] px-1 rounded",
              pac.domainScores.context.status === "SUPPORTING" 
                ? "text-state-success bg-state-success/10" 
                : pac.domainScores.context.status === "CONFLICTING"
                ? "text-state-error bg-state-error/10"
                : "text-state-warning bg-state-warning/10"
            )}>
              {(pac.domainScores.context.score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="font-semibold text-foreground truncate text-[9.5px]">
            {pac.domainScores.context.measuredValue}
          </div>
          <div className="text-[8.5px] text-foreground-muted truncate" title={pac.domainScores.context.primaryObservation}>
            {pac.domainScores.context.primaryObservation}
          </div>
        </div>
      </div>

      {/* 4. Conflict Warning & Diagnostics (if any) */}
      {pac.conflicts.length > 0 && (
        <div className="p-2 rounded bg-state-error/10 border border-state-error/30 space-y-1.5">
          <div className="flex items-center gap-1.5 text-state-error text-[10px] font-bold uppercase tracking-wide">
            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
            <span>Cross-Domain Discordance Diagnostics ({pac.conflicts.length})</span>
          </div>
          {pac.conflicts.map((conflict) => (
            <div key={conflict.id} className="text-[9px] text-foreground/90 space-y-0.5 border-l-2 border-state-error/50 pl-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-state-error font-mono">{conflict.domains.join(" ↔ ")} Conflict</span>
                <span className="text-[8px] px-1 rounded bg-state-error/20 text-state-error uppercase">
                  {conflict.severity} (-{conflict.penaltyApplied} pts)
                </span>
              </div>
              <p className="text-foreground-muted">{conflict.description}</p>
              <div className="text-[8.5px] text-state-error/90 flex items-center gap-1 font-sans">
                <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                <span>Action: {conflict.resolutionAction}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
