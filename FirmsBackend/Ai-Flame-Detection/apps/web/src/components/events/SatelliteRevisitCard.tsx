"use client";

import React from "react";
import { SatelliteRevisitForecast } from "@/types/satellite";
import { 
  Satellite, 
  Clock, 
  Maximize2, 
  AlertTriangle, 
  Radio, 
  CheckCircle2, 
  Layers,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SatelliteRevisitCardProps {
  revisit: SatelliteRevisitForecast;
  className?: string;
}

export function SatelliteRevisitCard({
  revisit,
  className
}: SatelliteRevisitCardProps) {
  const isDistorted = revisit.sensorFootprint.isEdgeOfSwathDistorted;
  const isBlindWindow = revisit.isBlindWindowActive;

  return (
    <div
      className={cn(
        "p-3 rounded-panel border font-sans space-y-2.5 transition-all shadow-sm",
        isBlindWindow
          ? "bg-state-warning/5 border-state-warning/30"
          : "bg-surface border-border",
        className
      )}
    >
      {/* 1. Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Satellite className={cn(
            "w-4 h-4 shrink-0",
            isBlindWindow ? "text-state-warning" : "text-accent"
          )} />
          <span className="text-xs font-semibold text-foreground truncate">
            Satellite Revisit &amp; Scan Geometry
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
          <span className={cn(
            "px-1.5 py-0.5 rounded font-semibold border",
            isBlindWindow
              ? "bg-state-warning/15 text-state-warning border-state-warning/30"
              : "bg-state-success/15 text-state-success border-state-success/30"
          )}>
            {isBlindWindow ? "BLIND WINDOW ACTIVE" : "CURRENT OBSERVATION"}
          </span>
        </div>
      </div>

      {/* 2. Revisit Timeline Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {/* Elapsed since last LEO */}
        <div className="p-2 rounded-control bg-surface-raised border border-border space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-foreground-muted">
            <Clock className="w-3 h-3 text-foreground-muted" />
            <span>Time Since Last Pass</span>
          </div>
          <div className="text-sm font-bold text-foreground">
            {revisit.elapsedMinutesSinceObservation}m ago
          </div>
          <div className="text-[9px] text-foreground-muted truncate">
            {revisit.lastObservationTimeIso.split("T")[1]?.slice(0, 8)} UTC
          </div>
        </div>

        {/* Next Polar Pass Countdown */}
        <div className="p-2 rounded-control bg-surface-raised border border-border space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-accent">
            <Satellite className="w-3 h-3 text-accent" />
            <span>Next LEO Overpass</span>
          </div>
          <div className="text-sm font-bold text-accent">
            ~{revisit.nextLeoPass.minutesUntilPass}m remaining
          </div>
          <div className="text-[9px] text-foreground-muted truncate font-sans">
            {revisit.nextLeoPass.platform.replace("_", " ")} ({revisit.nextLeoPass.sensorResolutionNadirM}m)
          </div>
        </div>
      </div>

      {/* 3. Geostationary INSAT-3DR Cadence */}
      <div className="p-2 rounded-control bg-surface-raised/70 border border-border/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
          <div>
            <span className="font-semibold text-foreground text-[11px] block">
              INSAT-3DR Geostationary Infill
            </span>
            <span className="text-[10px] text-foreground-muted">
              Rapid Hemispheric Scan (15-min cadence)
            </span>
          </div>
        </div>
        <div className="text-right font-mono">
          <span className="text-xs font-bold text-foreground">
            in {revisit.insatNextScanMinutes}m
          </span>
          <span className="block text-[9px] text-state-success font-sans">
            Continuous Infill
          </span>
        </div>
      </div>

      {/* 4. Sensor Footprint & Distortion Geometry */}
      <div className="p-2.5 rounded-control bg-surface-raised border border-border space-y-1.5 text-xs font-mono">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Maximize2 className="w-3 h-3 text-foreground-muted" />
            True Ground Footprint:
          </span>
          <span className="text-foreground">
            {revisit.sensorFootprint.pixelWidthScanMeters}m × {revisit.sensorFootprint.pixelLengthTrackMeters}m
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 text-[10px] text-foreground-muted pt-1 border-t border-border/40">
          <div>
            <span className="block text-[9px]">Scan Angle:</span>
            <strong className="text-foreground">{revisit.sensorFootprint.scanAngleDeg}°</strong>
          </div>
          <div>
            <span className="block text-[9px]">Smear Factor:</span>
            <strong className={cn(
              isDistorted ? "text-state-warning" : "text-foreground"
            )}>
              {revisit.sensorFootprint.distortionFactor}× nadir
            </strong>
          </div>
          <div>
            <span className="block text-[9px]">Parallax Jitter:</span>
            <strong className="text-foreground">±{revisit.sensorFootprint.viewingParallaxShiftEstimateMeters}m</strong>
          </div>
        </div>
      </div>

      {/* 5. Blind-Window Operational Guidance Banner */}
      {isBlindWindow && (
        <div className="p-2 rounded-control bg-state-warning/10 border border-state-warning/30 text-[10.5px] text-foreground leading-relaxed flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-state-warning shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-state-warning uppercase text-[9.5px] block tracking-wide">
              Operational Blind-Window Guidance
            </span>
            <p className="text-foreground-secondary text-[10px]">
              {revisit.blindWindowGuidance}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
