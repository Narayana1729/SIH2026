"use client";

import React from "react";
import { Users, School, Building2, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { PopulationExposureResult } from "@/types/exposure";

interface PopulationExposureCardProps {
  exposure: PopulationExposureResult;
  className?: string;
}

export function PopulationExposureCard({ exposure, className }: PopulationExposureCardProps) {
  const { exposedPopulationEstimate, settlements, vulnerableFacilities, airQualityImpactLevel, summary } = exposure;

  const getAirQualityBadge = () => {
    switch (airQualityImpactLevel) {
      case "HAZARDOUS":
        return <Badge variant="error" size="sm">AIR QUALITY: HAZARDOUS</Badge>;
      case "UNHEALTHY":
        return <Badge variant="warning" size="sm">AIR QUALITY: UNHEALTHY</Badge>;
      case "MODERATE":
        return <Badge variant="industrial" size="sm">AIR QUALITY: MODERATE</Badge>;
      default:
        return <Badge variant="success" size="sm">AIR QUALITY: LOW IMPACT</Badge>;
    }
  };

  return (
    <div className={`p-3 rounded-panel bg-surface-raised border border-border space-y-2.5 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Downwind Population & Asset Exposure</span>
        </div>
        {getAirQualityBadge()}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Estimated Population Exposed</div>
          <div className="text-base font-bold font-mono text-foreground mt-0.5">
            {exposedPopulationEstimate.toLocaleString()}
            <span className="text-[10px] font-sans font-normal text-foreground-muted ml-1">residents</span>
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5">
            Within projected Gaussian plume footprint
          </div>
        </div>

        <div className="p-2 rounded-control bg-surface border border-border/80">
          <div className="text-[10px] text-foreground-muted font-medium">Critical Infrastructure Exposed</div>
          <div className="text-base font-bold font-mono text-state-error mt-0.5">
            {vulnerableFacilities.length}
            <span className="text-[10px] font-sans font-normal text-foreground-muted ml-1">facilities</span>
          </div>
          <div className="text-[10px] text-foreground-secondary mt-0.5">
            Schools, clinics & transport links
          </div>
        </div>
      </div>

      {/* Downwind Settlements List */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
          Downwind Localities & Ingress ETA
        </div>
        <div className="space-y-1">
          {settlements.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-2 py-1.5 rounded-control bg-surface border border-border/70 text-xs"
            >
              <div>
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-[10px] text-foreground-muted ml-1.5">({s.distanceKm} km downwind)</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-foreground-secondary">{s.population.toLocaleString()} pop</span>
                <span className="px-1.5 py-0.5 rounded-control bg-surface-raised border border-border text-accent flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  ETA ~{s.etaMinutes}m
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Facilities Breakdown */}
      {vulnerableFacilities.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
            Identified Vulnerable Assets
          </div>
          <div className="flex flex-wrap gap-1.5">
            {vulnerableFacilities.map((fac, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-control bg-surface border border-border text-foreground-secondary"
              >
                {fac.type === "school" && <School className="w-3 h-3 text-state-warning" />}
                {fac.type === "hospital" && <AlertTriangle className="w-3 h-3 text-state-error" />}
                {fac.type !== "school" && fac.type !== "hospital" && <Building2 className="w-3 h-3 text-foreground-muted" />}
                {fac.name} ({fac.distanceKm} km)
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-foreground-secondary leading-relaxed bg-surface/60 p-2 rounded-control border border-border/50">
        {summary}
      </p>
    </div>
  );
}
