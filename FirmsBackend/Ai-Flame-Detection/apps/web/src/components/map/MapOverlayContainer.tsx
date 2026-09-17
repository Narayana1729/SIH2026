"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Z_INDEX } from "@/config/zIndex";

export interface MapOverlayContainerProps {
  children?: React.ReactNode;
  controls?: React.ReactNode;
  hud?: React.ReactNode;
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  selectedEventCard?: React.ReactNode;
  className?: string;
}

export function MapOverlayContainer({
  children,
  controls,
  hud,
  leftPanel,
  rightPanel,
  selectedEventCard,
  className,
}: MapOverlayContainerProps) {
  return (
    <div
      style={{ zIndex: Z_INDEX.overlays }}
      className={cn("absolute inset-0 pointer-events-none overflow-visible", className)}
    >
      {/* 1. Top HUD Area (Coordinates, Mode Switcher, Quick Actions) */}
      {hud && <div className="absolute top-3 left-3 right-3 pointer-events-none">{hud}</div>}

      {/* 2. Left Floating Panel Region (GIS Layers) */}
      {leftPanel && (
        <div className="absolute top-16 left-3 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-200">
          {leftPanel}
        </div>
      )}

      {/* 3. Right Floating Panel Region (Thermal Intelligence) */}
      {rightPanel}

      {/* 4. Bottom-Left / Responsive Bottom Sheet Selected Event Snapshot Card */}
      {selectedEventCard}

      {/* 5. Bottom Right Navigation Controls */}
      {controls && (
        <div className="absolute bottom-6 right-3 pointer-events-auto">
          {controls}
        </div>
      )}

      {/* 6. Direct Child Overlays (Timeline, Wind Intel, etc.) */}
      {children}
    </div>
  );
}
