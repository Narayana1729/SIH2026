"use client";

import React, { useEffect } from "react";
import {
  X,
  Flame,
  MapPin,
  Clock,
  Zap,
  ShieldCheck,
  Layers,
  Satellite,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useEventContext } from "@/context/EventContext";
import { calculateOperationalRisk } from "@/lib/risk/scoring";
import { formatCoordinate } from "@/lib/format/coordinates";
import { derivePrimaryCategory } from "@/lib/categories/fireCategories";
import { formatHumanReadableLocation } from "@/lib/location/locationFilter";

export function ConciseEventModal() {
  const {
    conciseSelectedEvent,
    isConciseDetailOpen,
    closeConciseEventDetails,
    openDetailedAnalysis,
  } = useEventContext();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isConciseDetailOpen) {
        closeConciseEventDetails();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isConciseDetailOpen, closeConciseEventDetails]);

  if (!isConciseDetailOpen || !conciseSelectedEvent) return null;

  const event = conciseSelectedEvent;
  const risk = calculateOperationalRisk(event);
  const primaryCategory = derivePrimaryCategory(event);
  const formattedCoords = formatCoordinate(event.latitude, event.longitude);

  const getRiskBadgeVariant = (level: string) => {
    if (level === "CRITICAL") return "error";
    if (level === "HIGH") return "warning";
    if (level === "MEDIUM") return "info";
    return "neutral";
  };

  const formattedDetectionTime = (() => {
    try {
      const d = new Date(event.start_time);
      return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")} UTC`;
    } catch {
      return "Active";
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150 font-sans select-none"
      onClick={closeConciseEventDetails}
    >
      <div
        className="relative w-full max-w-lg bg-surface border border-border rounded-overlay shadow-modal overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-12 px-4 bg-surface-raised border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-control bg-thermal/10 border border-thermal/20 flex items-center justify-center text-thermal">
              <Flame className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-foreground font-mono">
              Incident {event.event_id}
            </span>
          </div>

          <button
            onClick={closeConciseEventDetails}
            aria-label="Close modal"
            className="w-7 h-7 rounded-control flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Top Banner: Location & Severity */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-control bg-surface-raised border border-border">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground leading-tight">
                  {formatHumanReadableLocation(event)}
                </h3>
                <span className="text-xs text-foreground-muted font-mono mt-0.5 block">
                  Coordinates: {formattedCoords}
                </span>
              </div>
            </div>

            <Badge variant={getRiskBadgeVariant(risk.level)} size="sm">
              {risk.level} Priority
            </Badge>
          </div>

          {/* 4 Dimension Summary Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. Classification */}
            <div className="p-2.5 rounded-control bg-surface border border-border flex flex-col">
              <span className="text-[11px] text-foreground-muted mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-accent" />
                Classification
              </span>
              <span className="text-xs font-semibold text-foreground">
                {event.classification === "NON_INDUSTRIAL"
                  ? "Non-Industrial / Wildfire"
                  : event.classification === "INDUSTRIAL"
                  ? "Industrial Facility"
                  : "Uncertain / Unknown"}
              </span>
              <span className="text-[11px] text-foreground-muted mt-0.5">
                Type: {primaryCategory} · {event.phenomenon}
              </span>
            </div>

            {/* 2. Radiative Power */}
            <div className="p-2.5 rounded-control bg-surface border border-border flex flex-col">
              <span className="text-[11px] text-foreground-muted mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-thermal" />
                Radiative Power (FRP)
              </span>
              <span className="text-xs font-semibold font-mono text-foreground">
                {event.frp_mw.toFixed(1)} MW
              </span>
              <span className="text-[11px] text-foreground-muted mt-0.5">
                {event.detection_count} Satellite Detections
              </span>
            </div>

            {/* 3. Timing */}
            <div className="p-2.5 rounded-control bg-surface border border-border flex flex-col">
              <span className="text-[11px] text-foreground-muted mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-foreground-secondary" />
                Detection Time
              </span>
              <span className="text-xs font-semibold font-mono text-foreground truncate">
                {formattedDetectionTime}
              </span>
              <span className="text-[11px] text-state-success font-medium mt-0.5">
                Status: Active
              </span>
            </div>

            {/* 4. AI Confidence */}
            <div className="p-2.5 rounded-control bg-surface border border-border flex flex-col">
              <span className="text-[11px] text-foreground-muted mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-state-success" />
                AI Model Confidence
              </span>
              <span className="text-xs font-semibold font-mono text-foreground">
                {(event.confidence * 100).toFixed(1)}%
              </span>
              <span className="text-[11px] text-foreground-muted mt-0.5">
                State: {event.uncertainty_state}
              </span>
            </div>
          </div>

          {/* Context Summary */}
          {event.context_summary && (
            <div className="p-2.5 rounded-control bg-surface-raised border border-border text-xs text-foreground-secondary leading-relaxed">
              <span className="text-foreground font-medium">Context: </span>
              {event.context_summary}
            </div>
          )}

          {/* Instrument provenance */}
          <div className="flex items-center justify-between text-[11px] text-foreground-muted px-1 font-mono">
            <span className="flex items-center gap-1">
              <Satellite className="w-3 h-3 text-foreground-muted" />
              {event.satellite_instrument || "VIIRS NOAA-20 / SNPP"}
            </span>
            <span>WGS-84</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-3.5 bg-surface-raised border-t border-border flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            onClick={closeConciseEventDetails}
          >
            Close
          </Button>

          <Button
            variant="primary"
            onClick={() => openDetailedAnalysis(event)}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Open Geospatial Analysis
          </Button>
        </div>
      </div>
    </div>
  );
}
