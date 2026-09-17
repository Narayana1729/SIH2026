"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  X,
  Key,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Shield,
  Layers,
  RotateCcw,
  Check,
  Save,
  Globe,
  Map as MapIcon,
  Info,
} from "lucide-react";
import { useEventContext } from "@/context/EventContext";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface PlatformSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type OperatorRole = "VIEWER" | "ANALYST" | "DISPATCHER" | "ADMIN";
export type PollingRate = "15s" | "30s" | "60s" | "MANUAL";
export type DefaultMapMode = "2D" | "3D";

export function PlatformSettingsModal({ isOpen, onClose }: PlatformSettingsModalProps) {
  const { minFrpFilter, setMinFrpFilter } = useEventContext();

  // Settings State
  const [operatorRole, setOperatorRole] = useState<OperatorRole>("ANALYST");
  const [authToken, setAuthToken] = useState<string>("");
  const [pollingRate, setPollingRate] = useState<PollingRate>("30s");
  const [audioAlarmsEnabled, setAudioAlarmsEnabled] = useState<boolean>(true);
  const [defaultMapMode, setDefaultMapMode] = useState<DefaultMapMode>("2D");

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  // Load initial settings on mount / open
  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      try {
        const savedRole = localStorage.getItem("pyrosat_operator_role") as OperatorRole;
        if (savedRole) setOperatorRole(savedRole);

        const savedToken = localStorage.getItem("pyrosat_auth_token");
        if (savedToken) setAuthToken(savedToken);

        const savedRate = localStorage.getItem("pyrosat_polling_rate") as PollingRate;
        if (savedRate) setPollingRate(savedRate);

        const savedAudio = localStorage.getItem("pyrosat_audio_alarms");
        if (savedAudio !== null) setAudioAlarmsEnabled(savedAudio === "true");

        const savedMapMode = localStorage.getItem("pyrosat_default_map_mode") as DefaultMapMode;
        if (savedMapMode) setDefaultMapMode(savedMapMode);
      } catch {
        // ignore error
      }
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveSettings = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pyrosat_operator_role", operatorRole);
        localStorage.setItem("pyrosat_auth_token", authToken.trim());
        localStorage.setItem("pyrosat_polling_rate", pollingRate);
        localStorage.setItem("pyrosat_audio_alarms", String(audioAlarmsEnabled));
        localStorage.setItem("pyrosat_default_map_mode", defaultMapMode);
        localStorage.setItem("pyrosat_min_frp", String(minFrpFilter));
      } catch {
        // ignore
      }
    }
    setSaveStatus("saved");
    setTimeout(() => {
      setSaveStatus("idle");
      onClose();
    }, 600);
  };

  const handleGenerateDemoToken = (role: OperatorRole) => {
    // Generate an RFC 7519 compatible demo token format
    const demoToken = `pyrosat_demo_${role.toLowerCase()}_${Date.now()}`;
    setAuthToken(demoToken);
    setOperatorRole(role);
  };

  const handleResetDefaults = () => {
    setOperatorRole("ANALYST");
    setAuthToken("");
    setPollingRate("30s");
    setAudioAlarmsEnabled(true);
    setDefaultMapMode("2D");
    setMinFrpFilter(0);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("pyrosat_operator_role");
        localStorage.removeItem("pyrosat_auth_token");
        localStorage.removeItem("pyrosat_polling_rate");
        localStorage.removeItem("pyrosat_audio_alarms");
        localStorage.removeItem("pyrosat_default_map_mode");
        localStorage.removeItem("pyrosat_min_frp");
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Platform and Mission Control Configuration"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-panel shadow-elevated overflow-hidden flex flex-col max-h-[90vh] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-control bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Platform Configuration & RBAC
              </h2>
              <p className="text-[11px] text-foreground-muted">
                Operator credentials, telemetry refresh intervals, and rendering preferences
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-foreground-muted hover:text-foreground rounded-control hover:bg-surface-hover transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* 1. Active Operator Role (RBAC) */}
          <div className="p-3 rounded-panel bg-surface-raised border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-accent" />
                Active Operator Access Role
              </span>
              <Badge variant="neutral">{operatorRole}</Badge>
            </div>
            <p className="text-[11px] text-foreground-secondary">
              Determines clearance for emergency notifications, NDRF mobilizations, and CAP alerts.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {(["VIEWER", "ANALYST", "DISPATCHER", "ADMIN"] as OperatorRole[]).map((role) => {
                const isSelected = operatorRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setOperatorRole(role)}
                    className={cn(
                      "py-1.5 px-2 rounded-control text-center font-medium transition-all text-xs",
                      isSelected
                        ? "bg-accent text-white font-semibold shadow-sm"
                        : "bg-surface hover:bg-surface-hover border border-border text-foreground-secondary hover:text-foreground"
                    )}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. API Authentication & Token */}
          <div className="p-3 rounded-panel bg-surface-raised border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-accent" />
                API Token / Bearer Credentials
              </span>
              <span className="text-[10px] font-mono text-foreground-muted">
                {authToken ? "CONFIGURED" : "ANONYMOUS"}
              </span>
            </div>
            <p className="text-[11px] text-foreground-secondary">
              Attached to outbound API dispatch requests (`Authorization: Bearer` or `X-API-Key`).
            </p>
            <div className="space-y-1.5">
              <input
                type="text"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Enter JWT access token or API key..."
                className="w-full px-2.5 py-1.5 rounded-control bg-surface border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleGenerateDemoToken("ANALYST")}
                  className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border text-[11px] text-foreground-secondary hover:text-foreground rounded-control transition-colors"
                >
                  Generate Analyst Demo Token
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateDemoToken("DISPATCHER")}
                  className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border text-[11px] text-foreground-secondary hover:text-foreground rounded-control transition-colors"
                >
                  Generate Dispatcher Demo Token
                </button>
              </div>
            </div>
          </div>

          {/* 3. Minimum FRP Threshold Filter */}
          <div className="p-3 rounded-panel bg-surface-raised border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-accent" />
                Minimum Fire Radiative Power (FRP) Filter
              </span>
              <span className="font-mono text-accent font-semibold">
                {minFrpFilter > 0 ? `≥ ${minFrpFilter} MW` : "ALL (0 MW)"}
              </span>
            </div>
            <p className="text-[11px] text-foreground-secondary">
              Filter out low-intensity subpixel combustion detections below the selected MW cutoff.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minFrpFilter}
                onChange={(e) => setMinFrpFilter(Number(e.target.value))}
                className="flex-1 accent-accent cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setMinFrpFilter(0)}
                className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border text-[11px] text-foreground-muted hover:text-foreground rounded-control transition-colors shrink-0"
              >
                Reset
              </button>
            </div>
          </div>

          {/* 4. Telemetry Polling & Map Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Polling Rate */}
            <div className="p-3 rounded-panel bg-surface-raised border border-border space-y-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-accent" />
                Telemetry Refresh
              </span>
              <div className="grid grid-cols-2 gap-1 pt-1">
                {(["15s", "30s", "60s", "MANUAL"] as PollingRate[]).map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPollingRate(rate)}
                    className={cn(
                      "py-1 px-1.5 rounded-control text-center text-xs font-medium transition-all",
                      pollingRate === rate
                        ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                        : "bg-surface hover:bg-surface-hover border border-border text-foreground-secondary"
                    )}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Map Rendering */}
            <div className="p-3 rounded-panel bg-surface-raised border border-border space-y-2">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent" />
                Default Map Engine
              </span>
              <div className="grid grid-cols-2 gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => setDefaultMapMode("2D")}
                  className={cn(
                    "py-1 px-1.5 rounded-control text-center text-xs font-medium flex items-center justify-center gap-1 transition-all",
                    defaultMapMode === "2D"
                      ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                      : "bg-surface hover:bg-surface-hover border border-border text-foreground-secondary"
                  )}
                >
                  <MapIcon className="w-3 h-3" />
                  2D Flat Map
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultMapMode("3D")}
                  className={cn(
                    "py-1 px-1.5 rounded-control text-center text-xs font-medium flex items-center justify-center gap-1 transition-all",
                    defaultMapMode === "3D"
                      ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                      : "bg-surface hover:bg-surface-hover border border-border text-foreground-secondary"
                  )}
                >
                  <Globe className="w-3 h-3" />
                  3D Globe
                </button>
              </div>
            </div>
          </div>

          {/* 5. Audio Alarms */}
          <div className="p-3 rounded-panel bg-surface-raised border border-border flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {audioAlarmsEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-foreground-muted" />
                )}
                Audio Alarms for Critical Anomalies
              </span>
              <p className="text-[11px] text-foreground-secondary">
                Audible chime when a CRITICAL severity thermal event (&gt; 100 MW) is detected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAudioAlarmsEnabled((prev) => !prev)}
              className={cn(
                "px-3 py-1 rounded-control text-xs font-semibold transition-all border",
                audioAlarmsEnabled
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                  : "bg-surface border-border text-foreground-muted"
              )}
            >
              {audioAlarmsEnabled ? "ENABLED" : "MUTED"}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-border bg-surface-raised flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground hover:bg-surface-hover rounded-control transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-foreground-secondary hover:text-foreground text-xs font-medium rounded-control border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-control transition-colors shadow-sm"
            >
              {saveStatus === "saved" ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
