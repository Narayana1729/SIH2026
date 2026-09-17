"use client";

import React, { useState } from "react";
import type { AtmosphericDispersionResult } from "@/types/dispersion";
import type { ThermalEvent } from "@/types/event";
import {
  Wind,
  Compass,
  ArrowUpRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useOverlayPosition } from "@/hooks/useOverlayPosition";
import { OverlayPositionControls } from "@/components/common/OverlayPositionControls";
import { cn } from "@/lib/utils";

export interface FloatingWindIntelligenceCardProps {
  event: ThermalEvent | null;
  dispersion: AtmosphericDispersionResult | null;
  isLoading?: boolean;
  onFocusPlume?: () => void;
  className?: string;
}

export function FloatingWindIntelligenceCard({
  event,
  dispersion,
  isLoading = false,
  onFocusPlume,
  className,
}: FloatingWindIntelligenceCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const {
    mode: overlayMode,
    isDragging: isOverlayDragging,
    cardRef: overlayCardRef,
    handlePointerDown: handleOverlayPointerDown,
    cycleMode: cycleOverlayMode,
    toggleFloating: toggleOverlayFloating,
    resetPosition: resetOverlayPosition,
    style: overlayStyle,
    containerClassName: overlayContainerClassName,
  } = useOverlayPosition({
    id: "wind-intelligence",
    defaultPosition: "docked-tr",
    allowedModes: ["docked-tr", "docked-tl", "docked-br", "docked-bl", "floating"],
  });

  if (!event || !dispersion || !dispersion.wind || !dispersion.dispersion) {
    return null;
  }

  const { wind, dispersion: summary, data_quality } = dispersion;
  const speedKmh = (wind.speed_ms * 3.6).toFixed(1);

  const qualityBadgeClass =
    data_quality === "LIVE"
      ? "bg-state-success/20 text-state-success border-state-success/40"
      : data_quality === "CACHED"
      ? "bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40"
      : data_quality === "FALLBACK"
      ? "bg-state-warning/20 text-state-warning border-state-warning/40"
      : "bg-surface-hover text-foreground-muted border-border";

  return (
    <div
      ref={overlayCardRef}
      style={overlayStyle}
      className={cn(
        overlayContainerClassName,
        "w-[290px] max-w-[90vw]",
        isOverlayDragging && "shadow-2xl ring-1 ring-accent-cyan/50"
      )}
    >
      <div
        className={cn(
          "w-full pointer-events-auto select-none font-mono bg-surface-raised/95 backdrop-blur-md border border-border/90 rounded-panel shadow-panel flex flex-col transition-shadow duration-150 animate-in fade-in duration-200",
          className
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "px-3 py-2 flex items-center justify-between border-border/60 transition-colors select-none",
            isCollapsed ? "border-b-0" : "border-b pb-2"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Wind className="w-3.5 h-3.5 text-accent-cyan shrink-0 animate-pulse-subtle" />
            <span className="text-[10.5px] font-bold text-foreground uppercase tracking-wider truncate">
              WIND INTELLIGENCE
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "text-[8.5px] px-1.5 py-0.2 rounded border font-bold uppercase",
                qualityBadgeClass
              )}
            >
              {data_quality === "LIVE" ? "LIVE MET" : data_quality}
            </span>

            <OverlayPositionControls
              mode={overlayMode}
              isDragging={isOverlayDragging}
              onPointerDown={handleOverlayPointerDown}
              onCycleMode={cycleOverlayMode}
              onToggleFloating={toggleOverlayFloating}
              onReset={resetOverlayPosition}
            />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
              title={isCollapsed ? "Expand wind intelligence" : "Collapse wind intelligence"}
              aria-label={isCollapsed ? "Expand wind intelligence" : "Collapse wind intelligence"}
              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface-hover active:scale-95 transition-all"
            >
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

      {/* Expanded Metrics Body */}
      {!isCollapsed && (
        <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-[10px] bg-background/90 p-2.5 rounded-control border border-border/60">
            <div>
              <span className="text-foreground-muted block text-[9px] uppercase tracking-wider">
                Wind Velocity
              </span>
              <span className="font-bold text-foreground text-xs">
                {wind.speed_ms.toFixed(1)} m/s{" "}
                <span className="text-foreground-muted text-[9.5px]">({speedKmh} km/h)</span>
              </span>
            </div>

            <div>
              <span className="text-foreground-muted block text-[9px] uppercase tracking-wider">
                Hazard Bearing
              </span>
              <span className="font-bold text-state-error text-xs flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {wind.direction_from_label} → {wind.downwind_direction_label}
              </span>
            </div>

            <div className="col-span-2 pt-1.5 border-t border-border/40 flex items-center justify-between">
              <span className="text-foreground-muted text-[9px] uppercase tracking-wider">
                Downwind Reach / Corridor
              </span>
              <span className="font-bold text-[10px] text-accent-cyan">
                {summary.max_hazard_distance_km.toFixed(1)} km (Stability Class {summary.stability_class})
              </span>
            </div>
          </div>

          {/* Focus Action Button */}
          {onFocusPlume && (
              <button
                type="button"
                onClick={onFocusPlume}
                className="w-full py-1.5 px-3 rounded-control font-bold text-[10px] bg-accent-cyan hover:bg-accent-cyan/90 text-background flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
              >
                <Compass className="w-3 h-3 text-background" />
                <span className="text-background">FOCUS WIND &amp; PLUME DISPERSION</span>
              </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
