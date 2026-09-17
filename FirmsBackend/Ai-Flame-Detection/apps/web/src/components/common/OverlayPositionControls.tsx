"use client";

import React from "react";
import { GripVertical, Maximize2, RotateCcw, LayoutTemplate } from "lucide-react";
import type { PositionMode } from "@/types/overlay";
import { cn } from "@/lib/utils";

export interface OverlayPositionControlsProps {
  mode: PositionMode;
  isDragging?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onCycleMode?: () => void;
  onToggleFloating?: () => void;
  onReset?: () => void;
  className?: string;
  showModeSwitch?: boolean;
  showReset?: boolean;
}

const MODE_LABELS: Record<PositionMode, string> = {
  "docked-bl": "Docked: Bottom-Left",
  "docked-br": "Docked: Bottom-Right",
  "docked-tl": "Docked: Top-Left",
  "docked-tr": "Docked: Top-Right",
  "docked-bc": "Docked: Bottom-Center",
  "docked-tc": "Docked: Top-Center",
  floating: "Free Floating",
};

export function OverlayPositionControls({
  mode,
  isDragging = false,
  onPointerDown,
  onCycleMode,
  onToggleFloating,
  onReset,
  className,
  showModeSwitch = true,
  showReset = true,
}: OverlayPositionControlsProps) {
  return (
    <div className={cn("flex items-center gap-1 shrink-0 font-mono text-[10px]", className)}>
      {/* Drag Handle */}
      <div
        onPointerDown={onPointerDown}
        title="Drag from handle to move or float anywhere"
        aria-label="Drag to reposition panel"
        className={cn(
          "p-1 rounded-control transition-colors flex items-center justify-center select-none touch-none",
          isDragging
            ? "cursor-grabbing bg-accent/20 text-accent"
            : "cursor-grab text-foreground-muted hover:text-foreground hover:bg-surface-hover"
        )}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Dock Mode Cycle Switcher */}
      {showModeSwitch && onCycleMode && (
        <button
          type="button"
          onClick={onCycleMode}
          title={`Current: ${MODE_LABELS[mode]} (Click to cycle dock position)`}
          aria-label={`Cycle position mode. Currently ${MODE_LABELS[mode]}`}
          className="p-1 text-foreground-muted hover:text-foreground rounded-control hover:bg-surface-hover transition-colors"
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Toggle Floating Mode */}
      {onToggleFloating && (
        <button
          type="button"
          onClick={onToggleFloating}
          title={mode === "floating" ? "Dock card to corner" : "Switch to Free Floating mode"}
          aria-label={mode === "floating" ? "Dock card" : "Float card"}
          className={cn(
            "p-1 rounded-control transition-colors",
            mode === "floating"
              ? "text-accent bg-accent/15 hover:bg-accent/25"
              : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
          )}
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      )}

      {/* Reset to Default */}
      {showReset && onReset && (
        <button
          type="button"
          onClick={onReset}
          title="Reset position to default"
          aria-label="Reset position to default"
          className="p-1 text-foreground-muted hover:text-state-warning rounded-control hover:bg-surface-hover transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
