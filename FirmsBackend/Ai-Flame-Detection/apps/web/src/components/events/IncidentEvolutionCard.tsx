"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus, Activity, Compass, Clock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { IncidentEvolution } from "@/types/evolution";

interface IncidentEvolutionCardProps {
  evolution: IncidentEvolution;
  className?: string;
}

export function IncidentEvolutionCard({ evolution, className }: IncidentEvolutionCardProps) {
  const { trajectory, frpGrowthRateMwPerHr, frpChangePercent, movementVector, observationCount, persistenceDurationHours } = evolution;

  const getTrajectoryBadge = () => {
    switch (trajectory) {
      case "ESCALATING":
        return (
          <Badge variant="error" size="sm" className="font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            ESCALATING
          </Badge>
        );
      case "DECAYING":
        return (
          <Badge variant="success" size="sm" className="font-semibold flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            DECAYING
          </Badge>
        );
      case "STABLE":
        return (
          <Badge variant="industrial" size="sm" className="font-semibold flex items-center gap-1">
            <Minus className="w-3 h-3" />
            STABLE
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            SINGLE OBSERVATION
          </Badge>
        );
    }
  };

  return (
    <div className={`p-3 rounded-panel bg-surface-raised border border-border space-y-2.5 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Incident Evolution Dynamics</span>
        </div>
        {getTrajectoryBadge()}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">FRP Growth Rate</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            {frpGrowthRateMwPerHr > 0 ? `+${frpGrowthRateMwPerHr}` : frpGrowthRateMwPerHr}
            <span className="text-[10px] font-sans font-normal text-foreground-muted ml-0.5">MW/h</span>
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5">
            {frpChangePercent >= 0 ? `+${frpChangePercent}%` : `${frpChangePercent}%`} net
          </div>
        </div>

        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Movement Vector</div>
          <div className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1">
            <Compass className="w-3 h-3 text-accent" />
            <span>{movementVector.directionLabel}</span>
          </div>
          <div className="text-[10px] font-mono text-foreground-muted mt-0.5">
            {movementVector.speedKmH > 0 ? `${movementVector.speedKmH} km/h` : "Stationary"}
          </div>
        </div>

        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Cadence / History</div>
          <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
            {observationCount}
            <span className="text-[10px] font-sans font-normal text-foreground-muted ml-0.5">passes</span>
          </div>
          <div className="text-[10px] text-foreground-muted mt-0.5 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            <span>{persistenceDurationHours}h span</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-foreground-secondary leading-relaxed bg-surface/60 p-2 rounded-control border border-border/50">
        {evolution.summary}
      </p>
    </div>
  );
}
