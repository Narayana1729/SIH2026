"use client";

import React from "react";
import { Database, Cpu, Clock, Play } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { APP_CONFIG } from "@/config/ui";
import { useEventContext } from "@/context/EventContext";

export type TimeRange = "1h" | "6h" | "24h" | "48h" | "7d" | "ALL";

export function StatusBar() {
  const {
    stats,
    timeRange,
    setTimeRange,
    isLiveBackend,
    playbackMode,
    resetToLive,
  } = useEventContext();

  const isPlayback = playbackMode === "PLAYBACK";

  return (
    <footer className="h-9 w-full bg-surface border-t border-border flex items-center justify-between px-3 z-40 select-none shrink-0 font-sans text-xs">
      {/* 1. Left: Data Stream & Health */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-foreground-secondary">
          <Database className="w-3.5 h-3.5 text-accent" />
          <span className="font-semibold text-foreground">NASA FIRMS</span>
          <span className="text-foreground-muted hidden sm:inline">· VIIRS / MODIS</span>
          <StatusDot status={isLiveBackend ? "live" : "warning"} size="sm" className="ml-1" />
        </div>

        <div className="h-3.5 w-[1px] bg-border hidden md:block" />

        {/* Real-time dynamic counters summary */}
        <div className="hidden md:flex items-center gap-2 text-foreground-muted text-[11px]">
          <span>
            Active: <strong className="text-foreground font-mono">{stats.total}</strong>
          </span>
          <span>·</span>
          <span>
            Industrial: <strong className="text-foreground font-mono">{stats.industrial}</strong>
          </span>
          <span>·</span>
          <span>
            Review: <strong className="text-state-warning font-mono">{stats.reviewRequired}</strong>
          </span>
        </div>

        {/* Playback mode pill if active */}
        {isPlayback && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-accent/10 border border-accent/20 text-accent text-xs font-medium">
            <Play className="w-2.5 h-2.5 fill-current" />
            <span>Playback Active</span>
            <button
              onClick={resetToLive}
              title="Return to live stream"
              className="ml-1 px-1 py-0.2 rounded bg-surface hover:bg-surface-hover text-state-success border border-border text-[11px] transition-colors"
            >
              Live ⟲
            </button>
          </div>
        )}
      </div>

      {/* 2. Center: Time Filter Segmented Control */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground-muted hidden sm:flex items-center gap-1">
          <Clock className="w-3 h-3" /> Window:
        </span>
        <SegmentedControl<TimeRange>
          size="sm"
          value={timeRange.toUpperCase() === "ALL" ? "ALL" : (timeRange.toLowerCase() as TimeRange)}
          onChange={(val) => setTimeRange(val)}
          options={[
            { value: "1h", label: "1h" },
            { value: "6h", label: "6h" },
            { value: "24h", label: "24h" },
            { value: "48h", label: "48h" },
            { value: "7d", label: "7d" },
            { value: "ALL", label: "All" },
          ]}
        />
      </div>

      {/* 3. Right: Model Badge & Health */}
      <div className="hidden sm:flex items-center gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-foreground-muted text-[11px]">
          <Cpu className="w-3.5 h-3.5 text-foreground-secondary" />
          <span>
            Model: <strong className="text-foreground font-mono">{APP_CONFIG.modelName}</strong>
          </span>
        </div>

        <Badge variant="success" size="sm" className="text-[10px] py-0">
          Operational
        </Badge>
      </div>
    </footer>
  );
}
