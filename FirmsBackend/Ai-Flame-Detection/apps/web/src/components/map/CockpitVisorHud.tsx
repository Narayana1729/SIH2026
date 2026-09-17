"use client";

import React, { useEffect, useState } from "react";
import { Crosshair, Volume2, VolumeX, Compass, Navigation, Radio } from "lucide-react";
import { tacticalAudio } from "@/lib/map/cesium-tactical-audio";
import { cn } from "@/lib/utils";

export interface CockpitTelemetry {
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
  altitudeMeters: number;
  groundSpeedKts: number;
  lat: number;
  lng: number;
  targetBearingDeg?: number | null;
  targetDistanceKm?: number | null;
  targetName?: string | null;
}

export interface CockpitVisorHudProps {
  telemetry: CockpitTelemetry;
  isActive: boolean;
  onToggleActive?: () => void;
  className?: string;
}

export function CockpitVisorHud({
  telemetry,
  isActive,
  onToggleActive,
  className,
}: CockpitVisorHudProps) {
  const [audioEnabled, setAudioEnabled] = useState(tacticalAudio.enabled);

  useEffect(() => {
    setAudioEnabled(tacticalAudio.enabled);
  }, []);

  const handleToggleAudio = () => {
    const next = tacticalAudio.toggleAudio();
    setAudioEnabled(next);
    if (next) tacticalAudio.playClick();
  };

  if (!isActive) {
    return (
      <div className={cn("absolute bottom-16 right-4 z-30", className)}>
        <button
          onClick={onToggleActive}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface/90 hover:bg-surface-raised border border-border text-foreground-secondary hover:text-foreground text-xs font-mono backdrop-blur-md shadow-panel transition-all"
          title="Toggle Aircraft Tactical Cockpit HUD Visor"
        >
          <Navigation className="w-3.5 h-3.5 text-accent" />
          <span>COCKPIT HUD</span>
        </button>
      </div>
    );
  }

  const {
    pitchDeg = 0,
    rollDeg = 0,
    headingDeg = 0,
    altitudeMeters = 0,
    groundSpeedKts = 0,
    lat = 0,
    lng = 0,
    targetBearingDeg,
    targetDistanceKm,
    targetName,
  } = telemetry;

  // Render roll arc translation/rotation
  const rollTransform = `rotate(${-rollDeg}deg)`;
  // Pitch ladder vertical translation (clamp within visor view)
  const pitchOffsetPx = Math.max(-120, Math.min(120, pitchDeg * 4));

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 pointer-events-none select-none overflow-hidden font-mono text-xs text-accent",
        className
      )}
    >
      {/* 1. Visor Glass Vignette & Scanlines */}
      <div className="absolute inset-0 bg-radial-vignette opacity-70 pointer-events-none" />

      {/* 2. Top Banner Controls & State */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-surface/85 backdrop-blur-md px-4 py-1.5 rounded-control border border-accent/40 shadow-panel pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-state-success animate-pulse" />
          <span className="font-semibold tracking-wider text-state-success">TACTICAL VISOR · ACTIVE</span>
        </div>
        <span className="text-border-strong">|</span>
        <div className="flex items-center gap-1 text-foreground-muted">
          <Compass className="w-3.5 h-3.5 text-accent" />
          <span>HDG {Math.round(headingDeg).toString().padStart(3, "0")}°</span>
        </div>
        <span className="text-border-strong">|</span>
        <button
          onClick={handleToggleAudio}
          className="flex items-center gap-1 text-foreground-secondary hover:text-foreground transition-colors"
          title="Toggle Tactical Sound Effects"
        >
          {audioEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-accent" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-foreground-muted" />
          )}
          <span>{audioEnabled ? "SFX ON" : "MUTED"}</span>
        </button>
        <span className="text-border-strong">|</span>
        <button
          onClick={onToggleActive}
          className="text-state-warning hover:text-state-warning/80 font-bold px-1.5 py-0.5 rounded border border-state-warning/30 bg-state-warning/10"
        >
          EXIT HUD
        </button>
      </div>

      {/* 3. Left Speed & Telemetry Ribbon */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-start gap-1 bg-surface/80 backdrop-blur-md p-3 rounded-panel border border-border shadow-panel">
        <span className="text-[10px] text-foreground-muted tracking-wider">SPEED (KTS)</span>
        <span className="text-lg font-bold text-foreground font-mono">
          {Math.round(groundSpeedKts)}
        </span>
        <div className="w-16 h-0.5 bg-accent/40 my-1" />
        <span className="text-[10px] text-foreground-muted tracking-wider">POS LAT / LNG</span>
        <span className="text-[10px] text-foreground-secondary font-mono">
          {lat.toFixed(4)}°N
        </span>
        <span className="text-[10px] text-foreground-secondary font-mono">
          {lng.toFixed(4)}°E
        </span>
      </div>

      {/* 4. Right Altitude & Pitch Ribbon */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end gap-1 bg-surface/80 backdrop-blur-md p-3 rounded-panel border border-border shadow-panel">
        <span className="text-[10px] text-foreground-muted tracking-wider">ALTITUDE (MSL)</span>
        <span className="text-lg font-bold text-accent font-mono">
          {Math.round(altitudeMeters).toLocaleString()} m
        </span>
        <div className="w-16 h-0.5 bg-accent/40 my-1" />
        <span className="text-[10px] text-foreground-muted tracking-wider">PITCH / ROLL</span>
        <span className="text-[10px] text-foreground-secondary font-mono">
          P: {pitchDeg.toFixed(1)}°
        </span>
        <span className="text-[10px] text-foreground-secondary font-mono">
          R: {rollDeg.toFixed(1)}°
        </span>
      </div>

      {/* 5. Center Artificial Horizon & Pitch Ladder */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ transform: rollTransform }}
      >
        {/* Reticle Crosshair */}
        <div className="relative flex items-center justify-center">
          <Crosshair className="w-12 h-12 text-accent/80 opacity-90 animate-pulse" />
          <div className="absolute w-2 h-2 rounded-full bg-accent" />

          {/* Level Horizon Bar */}
          <div
            className="absolute flex items-center gap-3 transition-transform duration-75"
            style={{ transform: `translateY(${-pitchOffsetPx}px)` }}
          >
            <div className="w-24 h-0.5 bg-accent/70 shadow-glow" />
            <span className="text-[9px] font-bold text-accent px-1 bg-surface/90 border border-accent/40 rounded">
              HORIZON
            </span>
            <div className="w-24 h-0.5 bg-accent/70 shadow-glow" />
          </div>

          {/* Pitch Ladder Marks (+10, +20, -10, -20) */}
          <div
            className="absolute flex flex-col items-center gap-6 transition-transform duration-75 pointer-events-none opacity-60"
            style={{ transform: `translateY(${-pitchOffsetPx}px)` }}
          >
            <div className="flex items-center gap-8 text-[9px]">
              <span className="w-6 h-0.5 bg-accent border-b border-accent" />
              <span>+20</span>
              <span className="w-6 h-0.5 bg-accent border-b border-accent" />
            </div>
            <div className="flex items-center gap-8 text-[9px]">
              <span className="w-8 h-0.5 bg-accent" />
              <span>+10</span>
              <span className="w-8 h-0.5 bg-accent" />
            </div>
            <div className="h-6" /> {/* Zero gap */}
            <div className="flex items-center gap-8 text-[9px]">
              <span className="w-8 h-0.5 border-t border-dashed border-accent" />
              <span>-10</span>
              <span className="w-8 h-0.5 border-t border-dashed border-accent" />
            </div>
            <div className="flex items-center gap-8 text-[9px]">
              <span className="w-6 h-0.5 border-t border-dashed border-accent" />
              <span>-20</span>
              <span className="w-6 h-0.5 border-t border-dashed border-accent" />
            </div>
          </div>
        </div>
      </div>

      {/* 6. Target Vector Direction & Lock Banner */}
      {targetBearingDeg !== null && targetBearingDeg !== undefined && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-md px-4 py-2 rounded-panel border border-state-warning/50 shadow-panel flex items-center gap-3 text-xs pointer-events-auto">
          <Radio className="w-4 h-4 text-state-warning animate-pulse" />
          <div className="flex flex-col">
            <span className="font-bold text-state-warning flex items-center gap-1.5">
              <span>TARGET VECTOR:</span>
              <span className="text-foreground">{targetName || "Thermal Incident"}</span>
            </span>
            <span className="text-[11px] text-foreground-muted">
              BRG {Math.round(targetBearingDeg)}° · DIST {targetDistanceKm ? targetDistanceKm.toFixed(1) : "--"} km
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
