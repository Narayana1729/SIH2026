"use client";

import React, { useMemo, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  Flame,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useEventContext } from "@/context/EventContext";
import {
  formatTimelineStamp,
  formatTimelineAxisLabel,
} from "@/lib/playback/temporal";
import type { PlaybackSpeed, TimeWindow } from "@/types/playback";
import { cn } from "@/lib/utils";
import { useOverlayPosition } from "@/hooks/useOverlayPosition";
import { OverlayPositionControls } from "@/components/common/OverlayPositionControls";

export interface TimelinePlaybackBarProps {
  className?: string;
}

const TIME_WINDOWS: TimeWindow[] = ["1H", "6H", "24H", "48H", "7D", "ALL"];
const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8];

export function TimelinePlaybackBar({ className }: TimelinePlaybackBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Universal Overlay Positioning System
  const {
    mode: overlayMode,
    isDragging: isOverlayDragging,
    cardRef: overlayCardRef,
    handlePointerDown: handleOverlayPointerDown,
    cycleMode: cycleOverlayMode,
    toggleFloating: toggleOverlayFloating,
    resetPosition: resetOverlayPosition,
    containerStyle: overlayStyle,
    containerClassName: overlayContainerClassName,
  } = useOverlayPosition({
    id: "timeline-playback",
    defaultMode: "docked-bc",
    allowedModes: ["docked-bc", "docked-tc", "floating"],
    defaultCoordinates: () => ({
      x: typeof window !== "undefined" ? Math.max(16, (window.innerWidth - 640) / 2) : 200,
      y: typeof window !== "undefined" ? Math.max(50, window.innerHeight - 110) : 600,
    }),
  });

  const {
    timeRange,
    setTimeRange,
    playbackMode,
    isPlaying,
    playbackSpeed,
    playbackTime,
    playbackRange,
    playbackProgress,
    setPlaybackProgress,
    setPlaybackSpeed,
    togglePlayPause,
    stepForward,
    stepBackward,
    resetToLive,
    filteredEvents,
    rawEvents,
  } = useEventContext();

  const isLive = playbackMode === "LIVE";
  const startLabel = useMemo(
    () => formatTimelineAxisLabel(playbackRange.start),
    [playbackRange.start]
  );
  const endLabel = useMemo(
    () => formatTimelineAxisLabel(playbackRange.end),
    [playbackRange.end]
  );
  const currentStamp = useMemo(
    () => formatTimelineStamp(playbackTime),
    [playbackTime]
  );

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setPlaybackProgress(val);
    }
  };

  if (isCollapsed) {
    return (
      <div
        ref={overlayCardRef}
        style={overlayStyle}
        className={cn(
          overlayContainerClassName,
          "w-[96%] sm:w-[640px] max-w-[96vw]",
          isOverlayDragging && "shadow-2xl ring-1 ring-accent"
        )}
      >
        <div
          className={cn(
            "pointer-events-auto select-none font-sans bg-surface/95 backdrop-blur-md border border-border rounded-panel shadow-elevated px-3.5 py-2 flex items-center justify-between transition-all duration-150 text-xs",
            className
          )}
        >
          {/* Left: Mode Indicator & Summary */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (isLive) {
                  togglePlayPause();
                } else {
                  resetToLive();
                }
              }}
              title={isLive ? "Click to start Temporal Playback" : "Click to return to Live mode"}
              className={cn(
                "h-7 px-2.5 rounded-control text-xs font-medium border flex items-center gap-1.5 transition-colors shadow-sm",
                isLive
                  ? "bg-state-success/10 border-state-success/20 text-state-success hover:bg-state-success/20"
                  : "bg-accent/10 border-accent/20 text-accent hover:bg-accent/20"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isLive ? "bg-state-success" : "bg-accent"
                )}
              />
              <span>{isLive ? "Live Stream" : "Playback"}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-foreground font-medium px-2 py-0.5 rounded bg-surface-raised border border-border text-xs">
              <Clock className="w-3 h-3 text-foreground-muted" />
              <span className="font-mono">{currentStamp}</span>
              <span className="text-border">|</span>
              <span className="text-foreground-secondary flex items-center gap-1">
                <Flame className="w-3 h-3 text-thermal" />
                <span className="font-mono">{filteredEvents.length}</span> Events
              </span>
            </div>
          </div>

          {/* Right: Positioning & Expand Control */}
          <div className="flex items-center gap-1">
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
              onClick={() => setIsCollapsed(false)}
              title="Expand timeline"
              aria-label="Expand timeline"
              className="w-6 h-6 flex items-center justify-center rounded-control text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={overlayCardRef}
      style={overlayStyle}
      className={cn(
        overlayContainerClassName,
        "w-[96%] sm:w-[640px] max-w-[96vw]",
        isOverlayDragging && "shadow-2xl ring-1 ring-accent"
      )}
    >
      <div
        className={cn(
          "pointer-events-auto select-none font-sans bg-surface/95 backdrop-blur-md border border-border rounded-panel shadow-elevated px-3.5 py-2.5 flex flex-col gap-2 transition-all duration-150 text-xs",
          className
        )}
      >
        {/* 1. Top Control Bar: Mode Badge, Window Selector, Transport, Speed, Collapse */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Mode Indicator & Window Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Pill */}
            <button
              onClick={() => {
                if (isLive) {
                  togglePlayPause();
                } else {
                  resetToLive();
                }
              }}
              title={isLive ? "Click to start Temporal Playback" : "Click to return to Live mode"}
              className={cn(
                "h-7 px-2.5 rounded-control text-xs font-medium border flex items-center gap-1.5 transition-colors shadow-sm",
                isLive
                  ? "bg-state-success/10 border-state-success/20 text-state-success hover:bg-state-success/20"
                  : "bg-accent/10 border-accent/20 text-accent hover:bg-accent/20"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isLive ? "bg-state-success" : "bg-accent"
                )}
              />
              <span>{isLive ? "Live Stream" : "Playback"}</span>
            </button>

            {/* Time Window Buttons */}
            <div className="flex items-center bg-surface-raised border border-border rounded-control p-0.5">
              {TIME_WINDOWS.map((win) => {
                const isSelected =
                  timeRange.toUpperCase() === win.toUpperCase() ||
                  (win === "ALL" && timeRange.toUpperCase() === "ALL");
                return (
                  <button
                    key={win}
                    onClick={() => setTimeRange(win)}
                    className={cn(
                      "h-6 px-2 text-xs font-medium rounded-control transition-colors",
                      isSelected
                        ? "bg-accent text-white shadow-sm"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface-hover/60"
                    )}
                  >
                    {win}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transport Controls, Playhead Info & Collapse Button */}
          <div className="flex items-center gap-2">
            {/* Transport Buttons */}
            <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-control p-0.5">
              <button
                onClick={() => stepBackward(0.05)}
                title="Step Backward (5%)"
                aria-label="Step Backward"
                className="w-6 h-6 flex items-center justify-center rounded-control text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePlayPause}
                title={isPlaying ? "Pause Playback" : "Play Timeline"}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="h-6 px-2.5 flex items-center gap-1 rounded-control bg-accent text-white hover:bg-accent/90 font-medium text-xs transition-colors shadow-sm"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3 h-3 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <button
                onClick={() => stepForward(0.05)}
                title="Step Forward (5%)"
                aria-label="Step Forward"
                className="w-6 h-6 flex items-center justify-center rounded-control text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center bg-surface-raised border border-border rounded-control p-0.5">
              {SPEEDS.map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={cn(
                    "h-6 px-1.5 text-[11px] font-mono rounded-control transition-colors",
                    playbackSpeed === spd
                      ? "bg-surface text-foreground font-bold shadow-sm"
                      : "text-foreground-muted hover:text-foreground"
                  )}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Overlay Positioning Controls */}
            <OverlayPositionControls
              mode={overlayMode}
              isDragging={isOverlayDragging}
              onPointerDown={handleOverlayPointerDown}
              onCycleMode={cycleOverlayMode}
              onToggleFloating={toggleOverlayFloating}
              onReset={resetOverlayPosition}
            />

            {/* Collapse Button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              title="Minimize timeline"
              aria-label="Minimize timeline"
              className="w-6 h-6 flex items-center justify-center rounded-control text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Interactive Timeline Scrubbing Track */}
        <div className="flex flex-col gap-1">
          <div className="relative flex items-center w-full">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={playbackProgress}
              onChange={handleSliderChange}
              aria-label="Timeline scrubber"
              className="w-full h-1.5 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>

          {/* 3. Bottom Axis Timestamps & Active Window Telemetry */}
          <div className="flex items-center justify-between text-[11px] font-mono text-foreground-muted px-0.5">
            <span>{startLabel}</span>

            <div className="flex items-center gap-2 text-foreground font-semibold bg-surface-raised px-2 py-0.5 rounded border border-border">
              <Clock className="w-3 h-3 text-foreground-muted" />
              <span>{currentStamp}</span>
              <span className="text-border">|</span>
              <span className="text-foreground-secondary flex items-center gap-1 font-sans">
                <Flame className="w-3 h-3 text-thermal" />
                <span className="font-mono">{filteredEvents.length}</span> / {rawEvents.length}
              </span>
            </div>

            <span>{endLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
