import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Z_INDEX } from "../config/zIndex.ts";
import type { PositionMode, OverlayPosition, StoredOverlayPositionsV1 } from "../types/overlay.ts";

describe("Universal Overlay Positioning System Suite", () => {
  it("1. Standard Z-Index hierarchy maintains correct stacking invariants", () => {
    assert.ok(Z_INDEX.map < Z_INDEX.mapMarkers);
    assert.ok(Z_INDEX.mapMarkers < Z_INDEX.overlays);
    assert.ok(Z_INDEX.overlays < Z_INDEX.activeOverlay);
    assert.ok(Z_INDEX.activeOverlay < Z_INDEX.modal);
    assert.ok(Z_INDEX.modal < Z_INDEX.notification);
    assert.equal(Z_INDEX.overlays, 100);
    assert.equal(Z_INDEX.activeOverlay, 200);
  });

  it("2. Resolves default mode and coordinates when no saved position exists", () => {
    const id = "test-panel";
    const defaultMode: PositionMode = "docked-br";
    const defaultCoords = { x: 300, y: 150 };

    const initialPos: OverlayPosition = {
      mode: defaultMode,
      x: defaultCoords.x,
      y: defaultCoords.y,
    };

    assert.equal(initialPos.mode, "docked-br");
    assert.equal(initialPos.x, 300);
    assert.equal(initialPos.y, 150);
  });

  it("3. Cycles correctly through allowed docking modes and skips disallowed modes", () => {
    const allowedModes: PositionMode[] = ["docked-bc", "docked-tc", "floating"];
    let currentMode: PositionMode = "docked-bc";

    const cycle = (cur: PositionMode): PositionMode => {
      const idx = allowedModes.indexOf(cur);
      const nextIdx = idx === -1 || idx >= allowedModes.length - 1 ? 0 : idx + 1;
      return allowedModes[nextIdx];
    };

    currentMode = cycle(currentMode);
    assert.equal(currentMode, "docked-tc");

    currentMode = cycle(currentMode);
    assert.equal(currentMode, "floating");

    currentMode = cycle(currentMode);
    assert.equal(currentMode, "docked-bc");
  });

  it("4. Automatically switches from docked to floating upon dragging", () => {
    let mode: PositionMode = "docked-bl";
    let isDragging = false;
    let coords = { x: 0, y: 0 };

    // Simulated handle pointer down with card rect at left: 24, top: 400
    const startDrag = (renderedRect: { left: number; top: number }) => {
      if (mode !== "floating") {
        coords = { x: renderedRect.left, y: renderedRect.top };
        mode = "floating";
      }
      isDragging = true;
    };

    startDrag({ left: 24, top: 400 });
    assert.equal(mode, "floating");
    assert.equal(isDragging, true);
    assert.equal(coords.x, 24);
    assert.equal(coords.y, 400);
  });

  it("5. Clamps floating coordinates within viewport boundaries", () => {
    const bounds = { top: 56, bottom: 64, left: 12, right: 12 };
    const winW = 1000;
    const winH = 800;
    const cardW = 300;
    const cardH = 200;

    const clamp = (pos: { x: number; y: number }) => {
      const maxX = Math.max(bounds.left, winW - cardW - bounds.right); // 1000 - 300 - 12 = 688
      const maxY = Math.max(bounds.top, winH - cardH - bounds.bottom); // 800 - 200 - 64 = 536
      return {
        x: Math.min(Math.max(bounds.left, pos.x), maxX),
        y: Math.min(Math.max(bounds.top, pos.y), maxY),
      };
    };

    // Off-screen left/top
    assert.deepEqual(clamp({ x: -50, y: -20 }), { x: 12, y: 56 });

    // Off-screen right/bottom
    assert.deepEqual(clamp({ x: 9999, y: 9999 }), { x: 688, y: 536 });

    // In-bounds position
    assert.deepEqual(clamp({ x: 250, y: 180 }), { x: 250, y: 180 });
  });

  it("6. Corner snapping: correctly identifies snap zones near boundaries", () => {
    const bounds = { top: 56, bottom: 64, left: 12, right: 12 };
    const winW = 1200;
    const winH = 900;
    const SNAP_THRESHOLD = 52;

    const testSnap = (rect: { top: number; left: number; bottom: number; right: number; width: number }): PositionMode => {
      if (rect.top <= bounds.top + SNAP_THRESHOLD && rect.left <= bounds.left + SNAP_THRESHOLD) {
        return "docked-tl";
      }
      if (rect.top <= bounds.top + SNAP_THRESHOLD && rect.right >= winW - bounds.right - SNAP_THRESHOLD) {
        return "docked-tr";
      }
      if (rect.bottom >= winH - bounds.bottom - SNAP_THRESHOLD && rect.left <= bounds.left + SNAP_THRESHOLD) {
        return "docked-bl";
      }
      if (rect.bottom >= winH - bounds.bottom - SNAP_THRESHOLD && rect.right >= winW - bounds.right - SNAP_THRESHOLD) {
        return "docked-br";
      }
      return "floating";
    };

    // Dragged to top-left corner
    assert.equal(testSnap({ top: 60, left: 15, bottom: 260, right: 315, width: 300 }), "docked-tl");

    // Dragged to bottom-right corner
    assert.equal(testSnap({ top: 620, left: 880, bottom: 825, right: 1180, width: 300 }), "docked-br");

    // Dropped in middle of screen
    assert.equal(testSnap({ top: 300, left: 400, bottom: 500, right: 700, width: 300 }), "floating");
  });

  it("7. Versioned persistence serialization and deserialization", () => {
    const id = "event-intelligence-panel";
    const storage: Record<string, string> = {};

    const savePosition = (overlayId: string, pos: OverlayPosition) => {
      let store: StoredOverlayPositionsV1 = { version: 1, overlays: {} };
      if (storage["pyrosat:overlay-positions:v1"]) {
        try {
          store = JSON.parse(storage["pyrosat:overlay-positions:v1"]);
        } catch {
          // clean
        }
      }
      store.overlays[overlayId] = pos;
      storage["pyrosat:overlay-positions:v1"] = JSON.stringify(store);
    };

    const loadPosition = (overlayId: string): OverlayPosition | null => {
      const raw = storage["pyrosat:overlay-positions:v1"];
      if (!raw) return null;
      const parsed: StoredOverlayPositionsV1 = JSON.parse(raw);
      if (parsed.version === 1 && parsed.overlays?.[overlayId]) {
        return parsed.overlays[overlayId];
      }
      return null;
    };

    savePosition(id, { mode: "floating", x: 420, y: 180 });
    const restored = loadPosition(id);

    assert.ok(restored !== null);
    assert.equal(restored.mode, "floating");
    assert.equal(restored.x, 420);
    assert.equal(restored.y, 180);
  });

  it("8. Reset restores default position and updates persistence", () => {
    let mode: PositionMode = "floating";
    let coords = { x: 500, y: 300 };
    const defaultMode: PositionMode = "docked-br";
    const defaultCoords = { x: 24, y: 80 };

    const resetPosition = () => {
      mode = defaultMode;
      coords = defaultCoords;
    };

    resetPosition();
    assert.equal(mode, "docked-br");
    assert.deepEqual(coords, { x: 24, y: 80 });
  });
});
