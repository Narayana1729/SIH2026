"use client";

import React from "react";
import { Radar, Satellite, Cpu, MapPin, Wind, Siren, Archive, Check } from "lucide-react";

interface MissionControlWorkflowProps {
  currentStep?: number; // 1 to 7
  className?: string;
}

const WORKFLOW_STEPS = [
  { id: 1, label: "DETECT", desc: "Satellite Sensor Ingestion", icon: Radar },
  { id: 2, label: "VERIFY", desc: "Cross-Sensor Consistency", icon: Satellite },
  { id: 3, label: "CLASSIFY", desc: "Pyrometry + ML Decision", icon: Cpu },
  { id: 4, label: "ASSESS", desc: "Infrastructure Proximity", icon: MapPin },
  { id: 5, label: "PREDICT", desc: "Dispersion & Exposure", icon: Wind },
  { id: 6, label: "ACT", desc: "Incident Command Action", icon: Siren },
  { id: 7, label: "ARCHIVE", desc: "Audit Dossier Generated", icon: Archive },
];

export function MissionControlWorkflow({ currentStep = 6, className }: MissionControlWorkflowProps) {
  return (
    <div className={`p-2.5 rounded-panel bg-surface border border-border space-y-2 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] font-semibold text-foreground tracking-wide uppercase">
            PYROSAT Operational Mission Pipeline
          </span>
        </div>
        <span className="text-[10px] text-foreground-muted font-mono">
          Step {currentStep} of 7 Active
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WORKFLOW_STEPS.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <div
              key={step.id}
              className={`p-1.5 rounded-control text-center transition-all ${
                isCurrent
                  ? "bg-accent/15 border border-accent/40 shadow-sm"
                  : isCompleted
                  ? "bg-surface-raised border border-border"
                  : "bg-surface/50 border border-border/40 opacity-60"
              }`}
            >
              <div className="flex items-center justify-center mb-1">
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-state-success" />
                ) : (
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isCurrent ? "text-accent" : "text-foreground-muted"
                    }`}
                  />
                )}
              </div>
              <div
                className={`text-[9px] font-bold tracking-wider uppercase ${
                  isCurrent
                    ? "text-accent"
                    : isCompleted
                    ? "text-foreground"
                    : "text-foreground-muted"
                }`}
              >
                {step.label}
              </div>
              <div className="hidden lg:block text-[8px] text-foreground-muted truncate mt-0.5">
                {step.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
