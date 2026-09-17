"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  Settings,
  Flame,
  Sliders,
  ChevronLeft,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Sun,
  Moon,
  Laptop,
  Check,
} from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/Badge";
import { APP_CONFIG } from "@/config/ui";
import { formatUtcDateTime } from "@/lib/format/dates";
import { useEventContext } from "@/context/EventContext";
import { useTheme } from "@/context/ThemeContext";
import { AiSimulationLabModal } from "@/components/simulation/AiSimulationLabModal";
import { NotificationsModal } from "@/components/app-shell/NotificationsModal";
import { PlatformSettingsModal } from "@/components/app-shell/PlatformSettingsModal";
import { FirmsCsvUploadModal } from "@/components/ingestion/FirmsCsvUploadModal";
import { ModelBenchmarkModal } from "@/components/benchmark/ModelBenchmarkModal";
import { AgniAssistant } from "@/components/agni";
import { cn } from "@/lib/utils";
import { Upload, BarChart3 } from "lucide-react";

const CLASSIFICATION_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "INDUSTRIAL", label: "Industrial" },
  { id: "NON_INDUSTRIAL", label: "Non-Ind" },
  { id: "UNKNOWN", label: "Unknown" },
  { id: "REVIEW_REQUIRED", label: "Review" },
];

export function TopBar() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isSimLabOpen, setIsSimLabOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const {
    activeViewMode,
    setActiveViewMode,
    selectedState,
    selectedDistrict,
    returnToDashboard,
    searchQuery,
    setSearchQuery,
    selectedClassification,
    setSelectedClassification,
    filteredEvents,
    rawEvents,
    isDemoMode,
    toggleDemoMode,
    isLiveBackend,
    unreadAlertCount,
    injectSimulatedEvent,
  } = useEventContext();

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateTime = () => setCurrentTime(formatUtcDateTime(new Date()));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global ⌘K / Ctrl+K keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close theme menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    if (isThemeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isThemeMenuOpen]);

  const getThemeIcon = () => {
    if (theme === "system") {
      return <Laptop className="w-3.5 h-3.5 text-foreground-secondary" />;
    }
    if (theme === "dark") {
      return <Moon className="w-3.5 h-3.5 text-foreground-secondary" />;
    }
    return <Sun className="w-3.5 h-3.5 text-foreground-secondary" />;
  };

  const getThemeTooltip = () => {
    if (theme === "system") return `Theme: System default (${resolvedTheme})`;
    if (theme === "dark") return "Theme: Dark mode";
    return "Theme: Light mode";
  };

  return (
    <>
      <header className="h-12 w-full bg-surface border-b border-border flex items-center justify-between px-3 z-40 select-none shrink-0 shadow-panel gap-2 font-sans">
        {/* 1. Left: Brand Identity, Return Action & View Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-control bg-thermal/10 border border-thermal/25 flex items-center justify-center text-thermal shrink-0">
              <Flame className="w-4 h-4 text-thermal" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-xs font-bold tracking-tight text-foreground font-sans">
                  PYROSAT
                </span>
                <span className="text-[11px] font-medium text-foreground-muted hidden sm:inline">
                  Flame Intelligence
                </span>
              </div>
              <div className="text-[10px] text-foreground-muted hidden md:block mt-0.5">
                Thermal Monitoring & Industrial AI
              </div>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

          {/* Primary View Mode Switcher (Dashboard vs Geospatial Map) */}
          <div className="flex items-center bg-surface-raised p-0.5 rounded-control border border-border">
            <button
              onClick={() => setActiveViewMode("DASHBOARD")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-control transition-all",
                activeViewMode === "DASHBOARD"
                  ? "bg-surface text-foreground font-semibold shadow-sm border border-border"
                  : "text-foreground-secondary hover:text-foreground border border-transparent"
              )}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveViewMode("MISSION_CONTROL")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-control transition-all",
                activeViewMode === "MISSION_CONTROL"
                  ? "bg-surface text-foreground font-semibold shadow-sm border border-border"
                  : "text-foreground-secondary hover:text-foreground border border-transparent"
              )}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Geospatial Map</span>
            </button>
          </div>

          {/* Telemetry Mode Indicator / Toggle (Live vs Demo Mock) */}
          <button
            onClick={toggleDemoMode}
            title={isDemoMode ? "Currently showing simulated demo data. Click to switch to Live Satellite Feed." : "Currently showing live satellite telemetry. Click to include demo catalog."}
            className={cn(
              "hidden md:flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-control border transition-all shadow-panel cursor-pointer",
              isDemoMode
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isDemoMode ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
              )}
            />
            <span>{isDemoMode ? "DEMO MODE" : "LIVE FEED"}</span>
          </button>

          {/* Return to Dashboard Quick Action when in Advanced Map */}
          {activeViewMode === "MISSION_CONTROL" && (
            <button
              onClick={returnToDashboard}
              title="Return to Dashboard"
              className="hidden lg:flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-control bg-surface hover:bg-surface-hover border border-border text-foreground transition-colors shadow-panel"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          )}

          {/* Active Scope Indicator Badge */}
          {selectedState !== "ALL" && (
            <div className="hidden xl:flex items-center gap-1 px-2 py-0.5 rounded-control bg-surface-raised border border-border text-foreground text-xs">
              <MapPin className="w-3 h-3 text-accent" />
              <span className="font-medium">
                {selectedState}
                {selectedDistrict !== "ALL" ? ` › ${selectedDistrict}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* 2. Center: Search & Quick Classification Chips */}
        <div className="flex items-center gap-2 flex-1 max-w-lg mx-2">
          <div className="relative flex-1">
            <SearchInput
              ref={searchInputRef}
              placeholder="Search event ID, refinery, power plant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              shortcut="⌘K"
            />
          </div>

          {/* Quick classification filter pills (when in Map View) */}
          {activeViewMode === "MISSION_CONTROL" && (
            <div className="hidden xl:flex items-center gap-1 bg-surface-raised p-0.5 rounded-control border border-border">
              {CLASSIFICATION_FILTERS.map((filter) => {
                const isSelected = selectedClassification === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedClassification(filter.id)}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-control transition-all duration-150 font-medium",
                      isSelected
                        ? "bg-surface text-foreground font-semibold shadow-sm border border-border"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface-hover/60 border border-transparent"
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Right: AGNI, AI Simulation Lab, Theme Toggle, Clock */}
        <div className="flex items-center gap-2 shrink-0">
          {/* AGNI AI Voice Intelligence Assistant */}
          <AgniAssistant onOpenSimLab={() => setIsSimLabOpen(true)} />

          {/* FIRMS CSV Ingestion Action */}
          <button
            onClick={() => setIsCsvUploadOpen(true)}
            title="Ingest raw NASA FIRMS CSV dataset for batch fire classification"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-control bg-surface hover:bg-surface-hover border border-border text-foreground transition-colors shadow-panel"
          >
            <Upload className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">FIRMS CSV</span>
          </button>

          {/* AI Simulation Lab Button */}
          <button
            onClick={() => setIsSimLabOpen(true)}
            title="Open AI Simulation & Convective Plume Lab"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-control bg-surface hover:bg-surface-hover border border-border text-foreground transition-colors shadow-panel"
          >
            <Sliders className="w-3.5 h-3.5 text-foreground-secondary" />
            <span className="hidden sm:inline">AI Sim Lab</span>
          </button>

          {/* ML Benchmark & Model Governance Button */}
          <button
            onClick={() => setIsBenchmarkOpen(true)}
            title="Open Fire Classification Model Benchmarks & Metrics"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-control bg-surface hover:bg-surface-hover border border-border text-foreground transition-colors shadow-panel"
          >
            <BarChart3 className="w-3.5 h-3.5 text-foreground-secondary" />
            <span className="hidden md:inline">ML Metrics</span>
          </button>

          {/* Filter matches badge */}
          <div className="hidden md:flex items-center gap-1 text-xs text-foreground-secondary bg-surface-raised px-2 py-0.5 rounded-control border border-border">
            <span className="text-foreground font-semibold">{filteredEvents.length}</span>
            <span className="text-foreground-muted">/ {rawEvents.length}</span>
          </div>

          {/* Live UTC Clock */}
          <div className="hidden lg:flex items-center text-xs font-mono text-foreground-secondary bg-surface-raised px-2 py-0.5 rounded-control border border-border">
            <span>{currentTime || "UTC LIVE"}</span>
          </div>

          <div className="h-4 w-[1px] bg-border mx-0.5 hidden lg:block" />

          {/* Theme Selector (Light / Dark / System default) */}
          <div className="relative" ref={themeMenuRef}>
            <Tooltip content={`${getThemeTooltip()} (Click to select)`} position="bottom">
              <button
                onClick={() => setIsThemeMenuOpen((prev) => !prev)}
                aria-label="Select theme appearance"
                className="w-8 h-8 rounded-control flex items-center justify-center bg-surface hover:bg-surface-hover border border-border text-foreground transition-colors shadow-panel"
              >
                {getThemeIcon()}
              </button>
            </Tooltip>

            {isThemeMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-surface rounded-panel border border-border shadow-elevated p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[10px] font-semibold text-foreground-muted px-2 py-1 tracking-wider uppercase">
                  Appearance
                </div>
                <button
                  onClick={() => {
                    setTheme("light");
                    setIsThemeMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-control text-xs font-medium text-foreground transition-colors",
                    theme === "light"
                      ? "bg-accent/10 text-accent font-semibold"
                      : "hover:bg-surface-hover"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-foreground-secondary" />
                    Light
                  </span>
                  {theme === "light" && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
                <button
                  onClick={() => {
                    setTheme("dark");
                    setIsThemeMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-control text-xs font-medium text-foreground transition-colors",
                    theme === "dark"
                      ? "bg-accent/10 text-accent font-semibold"
                      : "hover:bg-surface-hover"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5 text-foreground-secondary" />
                    Dark
                  </span>
                  {theme === "dark" && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
                <button
                  onClick={() => {
                    setTheme("system");
                    setIsThemeMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-control text-xs font-medium text-foreground transition-colors",
                    theme === "system"
                      ? "bg-accent/10 text-accent font-semibold"
                      : "hover:bg-surface-hover"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5 text-foreground-secondary" />
                    System default
                  </span>
                  {theme === "system" && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              </div>
            )}
          </div>

          {/* System Settings & Notifications */}
          <div className="flex items-center gap-1">
            <Tooltip content="Notifications & Alerts" position="bottom">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(true)}
                  aria-label="Open Notifications"
                  className="w-8 h-8 rounded-control flex items-center justify-center bg-surface hover:bg-surface-hover border border-border text-foreground-secondary hover:text-foreground transition-colors shadow-panel relative"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {unreadAlertCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                      {unreadAlertCount > 9 ? "9+" : unreadAlertCount}
                    </span>
                  )}
                </button>
              </div>
            </Tooltip>

            <Tooltip content="Platform Configuration" position="bottom">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Open Platform Configuration"
                className="w-8 h-8 rounded-control flex items-center justify-center bg-surface hover:bg-surface-hover border border-border text-foreground-secondary hover:text-foreground transition-colors shadow-panel"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* NASA FIRMS CSV Batch Ingestion & Classification Modal */}
      <FirmsCsvUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
      />

      {/* AI Simulation Lab Modal */}
      <AiSimulationLabModal
        isOpen={isSimLabOpen}
        onClose={() => setIsSimLabOpen(false)}
        onInjectSimulatedEvent={injectSimulatedEvent}
      />

      {/* Fire Classification Model Benchmark Modal */}
      <ModelBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* Real-time Notifications & Alerts Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Platform & Operator Settings Modal */}
      <PlatformSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
