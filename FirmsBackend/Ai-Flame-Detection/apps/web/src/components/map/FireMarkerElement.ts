import { ThermalEvent } from "@/types/event";
import { calculateOperationalRisk } from "@/lib/risk/scoring";
import { formatFrp } from "@/lib/format/numbers";
import { formatCoordinate } from "@/lib/format/coordinates";
import { formatUtcTime } from "@/lib/format/dates";
import { Z_INDEX } from "@/config/zIndex";

export interface CreateMarkerOptions {
  event: ThermalEvent;
  isSelected?: boolean;
  onSelect?: (event: ThermalEvent) => void;
}

function getMarkerColors(event: ThermalEvent) {
  const isIndustrial = event.classification === "INDUSTRIAL";
  const isUnknown = event.classification === "UNKNOWN";

  if (isIndustrial) {
    return {
      border: "var(--accent-primary, #2563eb)",
      ring: "var(--accent-primary, #2563eb)",
      labelBg: "bg-accent/10 text-accent border-accent/20",
    };
  }
  if (isUnknown) {
    return {
      border: "var(--state-warning, #d97706)",
      ring: "var(--state-warning, #d97706)",
      labelBg: "bg-state-warning/10 text-state-warning border-state-warning/20",
    };
  }
  return {
    border: "var(--state-success, #16a34a)",
    ring: "var(--state-success, #16a34a)",
    labelBg: "bg-state-success/10 text-state-success border-state-success/20",
  };
}

export function updateFireMarkerSelection(
  el: HTMLElement,
  isSelected: boolean,
  event: ThermalEvent
): void {
  // Update bound event reference so click listener always receives latest event object
  (el as any).__event = event;
  el.setAttribute("data-marker-id", event.event_id);

  const core = el.querySelector<HTMLElement>("[data-marker-core]");
  if (!core) return;

  const colors = getMarkerColors(event);

  if (isSelected) {
    core.classList.add("ring-2", "ring-accent", "ring-offset-2", "ring-offset-background");
    core.style.borderColor = "var(--accent-primary, #2563eb)";
    core.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
    core.style.transform = "scale(1.15)";
  } else {
    core.classList.remove("ring-2", "ring-accent", "ring-offset-2", "ring-offset-background");
    core.style.borderColor = colors.border;
    core.style.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.15)";
    core.style.transform = "scale(1)";
  }
}

export function createFireMarkerElement({
  event,
  isSelected = false,
  onSelect,
}: CreateMarkerOptions): HTMLElement {
  const risk = calculateOperationalRisk(event);
  const colors = getMarkerColors(event);

  const el = document.createElement("div");
  (el as any).__event = event;
  el.className = "group relative flex items-center justify-center cursor-pointer select-none pointer-events-auto";
  el.style.transform = "translate(-50%, -50%) translateZ(0)";
  el.style.pointerEvents = "auto";
  el.style.zIndex = String(Z_INDEX.mapMarkers);
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("data-marker-id", event.event_id);
  el.setAttribute(
    "aria-label",
    `Thermal Event ${event.event_id}, ${event.classification}, ${event.frp_mw.toFixed(1)} MW, Priority ${risk.level}`
  );

  // Clean size calculation based on FRP
  let markerSize = 26;
  let flameSize = 14;
  if (event.frp_mw > 200) {
    markerSize = 32;
    flameSize = 18;
  } else if (event.frp_mw > 80) {
    markerSize = 28;
    flameSize = 16;
  }

  const isReviewRequired = event.uncertainty_state === "REVIEW_REQUIRED";

  // Core Marker Container
  const core = document.createElement("div");
  core.setAttribute("data-marker-core", "true");
  core.className = `relative flex items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-110 active:scale-95 bg-surface pointer-events-auto ${
    isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
  }`;
  core.style.width = `${markerSize}px`;
  core.style.height = `${markerSize}px`;
  core.style.border = `2px solid ${isSelected ? "var(--accent-primary, #2563eb)" : colors.border}`;
  core.style.boxShadow = isSelected
    ? "0 2px 8px rgba(0, 0, 0, 0.2)"
    : "0 1px 4px rgba(0, 0, 0, 0.15)";

  // Clean Flame Icon
  const flame = document.createElement("span");
  flame.style.fontSize = `${flameSize}px`;
  flame.style.lineHeight = "1";
  flame.innerText = "🔥";
  core.appendChild(flame);

  // Review Required Badge
  if (isReviewRequired) {
    const warningBadge = document.createElement("div");
    warningBadge.className =
      "absolute -top-1 -right-1 w-3.5 h-3.5 bg-state-warning text-white text-[9px] font-sans font-bold rounded-full flex items-center justify-center border border-background shadow-sm";
    warningBadge.innerText = "!";
    core.appendChild(warningBadge);
  }

  el.appendChild(core);

  // Hover Tooltip Popup with clean metadata
  const coordText = formatCoordinate(event.latitude, event.longitude);
  const timeText = event.start_time ? formatUtcTime(event.start_time) : "LIVE";
  const priorityLabel = risk.isIndeterminate ? "PRIORITY: UNK" : `PRIORITY: ${risk.level}`;

  const tooltip = document.createElement("div");
  tooltip.className =
    "absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150";
  tooltip.innerHTML = `
    <div class="bg-surface/95 border border-border text-foreground px-2.5 py-1.5 rounded-control shadow-elevated text-xs font-sans whitespace-nowrap backdrop-blur-md">
      <div class="flex items-center gap-1.5 font-medium">
        <span class="text-thermal-primary">🔥</span>
        <span class="font-mono text-[11px] font-semibold">${event.event_id}</span>
        <span class="text-[10px] px-1 py-0.2 rounded font-medium border ${colors.labelBg}">${event.classification}</span>
        <span class="text-[10px] px-1 py-0.2 rounded bg-surface-raised border border-border text-foreground-secondary">${priorityLabel}</span>
      </div>
      <div class="text-[11px] text-foreground-muted mt-1 flex items-center justify-between gap-3 font-mono">
        <span class="text-foreground font-semibold">${formatFrp(event.frp_mw)}</span>
        <span>${(event.confidence * 100).toFixed(0)}% CONF</span>
      </div>
      <div class="text-[10px] text-foreground-muted mt-0.5 flex items-center justify-between gap-2 border-t border-border pt-1 font-mono">
        <span>${coordText}</span>
        <span>${timeText}</span>
      </div>
    </div>
    <div class="w-1.5 h-1.5 bg-surface border-r border-b border-border rotate-45 -mt-1"></div>
  `;
  el.appendChild(tooltip);

  // Click / Selection handler with dynamic event lookup
  if (onSelect) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetEvent: ThermalEvent = (el as any).__event || event;
      onSelect(targetEvent);
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        const targetEvent: ThermalEvent = (el as any).__event || event;
        onSelect(targetEvent);
      }
    });
  }

  return el;
}
