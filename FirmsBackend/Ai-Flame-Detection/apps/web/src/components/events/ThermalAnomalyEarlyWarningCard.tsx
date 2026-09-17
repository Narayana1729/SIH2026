"use client";

import React from "react";
import { AlertOctagon, Flame, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ThermalAnomalyProfile } from "@/lib/anomaly/anomaly";

interface ThermalAnomalyEarlyWarningCardProps {
  anomaly: ThermalAnomalyProfile;
  className?: string;
}

export function ThermalAnomalyEarlyWarningCard({ anomaly, className }: ThermalAnomalyEarlyWarningCardProps) {
  const { severity, baselineRangeLabel, currentFrpMw, deviationPercent, zScore, anomalyTitle, anomalyDescription, isEarlyWarningAlert } = anomaly;

  const getSeverityBadge = () => {
    switch (severity) {
      case "CRITICAL_SURGE":
        return (
          <Badge variant="error" size="sm" className="font-semibold flex items-center gap-1">
            <AlertOctagon className="w-3 h-3" />
            CRITICAL FLARING SURGE
          </Badge>
        );
      case "MODERATE_DEVIATION":
        return (
          <Badge variant="warning" size="sm" className="font-semibold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            ELEVATED ANOMALY
          </Badge>
        );
      default:
        return (
          <Badge variant="success" size="sm" className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            NOMINAL BASELINE
          </Badge>
        );
    }
  };

  return (
    <div className={`p-3 rounded-panel bg-surface-raised border border-border space-y-2.5 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-thermal" />
          <span className="text-xs font-semibold text-foreground">Early-Warning & Baseline Anomaly Detection</span>
        </div>
        {getSeverityBadge()}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Historical Baseline</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            {baselineRangeLabel}
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5">Facility standard</div>
        </div>

        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Observed Output</div>
          <div className="text-sm font-bold font-mono text-foreground mt-0.5">
            {currentFrpMw.toFixed(1)} <span className="font-sans font-normal text-[10px] text-foreground-muted">MW</span>
          </div>
          <div className="text-[10px] font-semibold mt-0.5 text-state-error">
            {deviationPercent >= 0 ? `+${deviationPercent}%` : `${deviationPercent}%`} surge
          </div>
        </div>

        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Statistical Z-Score</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            +{zScore}σ
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5">Std dev above mean</div>
        </div>
      </div>

      <div className={`p-2 rounded-control border text-[11px] leading-relaxed ${
        isEarlyWarningAlert
          ? "bg-state-error/10 border-state-error/30 text-foreground"
          : "bg-surface/60 border-border/50 text-foreground-secondary"
      }`}>
        <div className="font-semibold text-foreground mb-0.5">{anomalyTitle}</div>
        <div>{anomalyDescription}</div>
      </div>
    </div>
  );
}
