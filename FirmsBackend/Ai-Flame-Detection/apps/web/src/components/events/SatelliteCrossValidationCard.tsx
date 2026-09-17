"use client";

import React from "react";
import { Satellite, CheckCircle, AlertCircle, ShieldAlert, Layers } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { SatelliteCrossValidationResult } from "@/lib/validation/cross-sensor";

interface SatelliteCrossValidationCardProps {
  validation: SatelliteCrossValidationResult;
  className?: string;
}

export function SatelliteCrossValidationCard({ validation, className }: SatelliteCrossValidationCardProps) {
  const { agreementScorePercent, confirmationStatus, participatingSensors, spatialCoherenceKm, validationSummary } = validation;

  const getStatusBadge = () => {
    switch (confirmationStatus) {
      case "MULTI_SENSOR_CONFIRMED":
        return (
          <Badge variant="success" size="sm" className="flex items-center gap-1 font-semibold">
            <CheckCircle className="w-3 h-3" />
            MULTI-SENSOR CONFIRMED
          </Badge>
        );
      case "TEMPORAL_REPEAT_CONFIRMED":
        return (
          <Badge variant="industrial" size="sm" className="flex items-center gap-1 font-semibold">
            <Layers className="w-3 h-3" />
            TEMPORALLY CONFIRMED
          </Badge>
        );
      case "POTENTIAL_FALSE_ALARM":
        return (
          <Badge variant="error" size="sm" className="flex items-center gap-1 font-semibold">
            <ShieldAlert className="w-3 h-3" />
            POTENTIAL GLINT / ARTIFACT
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            SINGLE SENSOR UNVERIFIED
          </Badge>
        );
    }
  };

  return (
    <div className={`p-3 rounded-panel bg-surface-raised border border-border space-y-2.5 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Satellite Cross-Validation & Consistency</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Agreement Score</div>
          <div className="text-sm font-bold font-mono text-foreground mt-0.5">
            {agreementScorePercent}%
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5">Cross-constellation</div>
        </div>

        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Sensors Fused</div>
          <div className="text-sm font-semibold text-foreground mt-0.5 font-mono">
            {participatingSensors.length} <span className="font-sans font-normal text-[10px] text-foreground-muted">active</span>
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5 truncate">
            {participatingSensors.join(", ")}
          </div>
        </div>

        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Spatial Colocation</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            {spatialCoherenceKm > 0 ? `±${spatialCoherenceKm} km` : "< 0.5 km"}
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5">Centroid alignment</div>
        </div>
      </div>

      <p className="text-[11px] text-foreground-secondary leading-relaxed bg-surface/60 p-2 rounded-control border border-border/50">
        {validationSummary}
      </p>
    </div>
  );
}
