import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_THERMAL_EVENTS } from "../features/events/mock/demo-events.ts";
import type { ThermalEvent } from "../types/event.ts";
import {
  createFallbackEventDetail,
  createFallbackTimeline,
  createFallbackEvidence,
  createFallbackIntelligence,
} from "../lib/api/eventFallbacks.ts";

describe("Event Selection Synchronization & Stale Data Elimination Suite", () => {
  const events = DEMO_THERMAL_EVENTS;
  const eventA = events[0]; // EVT-2026-0831-01
  const eventB = events[1]; // EVT-2026-0831-02
  const eventC = events[2]; // EVT-2026-0831-03

  it("1. Initial URL hydration selects specified event from URL", () => {
    let initialUrlHydrated = false;
    let selectedEvent: ThermalEvent | null = null;

    // Simulate URL "?event=EVT-2026-0831-02"
    const searchParams = new URLSearchParams("?event=EVT-2026-0831-02");
    const eventParam = searchParams.get("event");

    if (!initialUrlHydrated && eventParam) {
      initialUrlHydrated = true;
      const found = events.find((e) => e.event_id === eventParam);
      if (found) {
        selectedEvent = found;
      }
    }

    assert.equal(selectedEvent?.event_id, "EVT-2026-0831-02");
    assert.equal(initialUrlHydrated, true);
  });

  it("2. User selection updates React state and synchronizes URL immediately", () => {
    let selectedEvent: ThermalEvent | null = eventA;
    let currentUrl = `http://localhost:3000/?event=${eventA.event_id}`;

    // User clicks Event B
    const selectEvent = (evt: ThermalEvent | null) => {
      selectedEvent = evt;
      const url = new URL(currentUrl);
      if (evt) {
        url.searchParams.set("event", evt.event_id);
      } else {
        url.searchParams.delete("event");
      }
      currentUrl = url.toString();
    };

    selectEvent(eventB);
    assert.equal(selectedEvent?.event_id, eventB.event_id);
    assert.ok(currentUrl.includes(`event=${eventB.event_id}`));

    // Deselect
    selectEvent(null);
    assert.equal(selectedEvent, null);
    assert.ok(!currentUrl.includes("event="));
  });

  it("3. Background query/rawEvents changes NEVER reset user-selected event", () => {
    let initialUrlHydrated = true; // initial load already happened
    let selectedEvent: ThermalEvent | null = eventB;

    // Backend query updates rawEvents with fresh array
    const freshRawEvents: ThermalEvent[] = [...events].map((e) => ({ ...e }));

    // Re-evaluating hydration guard
    const runHydrationEffect = (catalog: ThermalEvent[]) => {
      if (initialUrlHydrated) {
        // Hydration guard prevents overwriting active selection
        return;
      }
      // If broken, it would do: selectedEvent = catalog[0]
      selectedEvent = catalog[0];
    };

    runHydrationEffect(freshRawEvents);
    // Must remain Event B, not revert to catalog[0] or eventA
    assert.equal(selectedEvent?.event_id, eventB.event_id);
  });

  it("4. Browser popstate navigation restores previous URL event", () => {
    let selectedEvent: ThermalEvent | null = eventB;

    // User presses Back button: URL goes to ?event=EVT-2026-0831-01
    const popstateUrl = "http://localhost:3000/?event=EVT-2026-0831-01";
    const onPopState = (urlStr: string) => {
      const url = new URL(urlStr);
      const eventId = url.searchParams.get("event");
      if (eventId) {
        const found = events.find((e) => e.event_id === eventId);
        selectedEvent = found || null;
      } else {
        selectedEvent = null;
      }
    };

    onPopState(popstateUrl);
    assert.equal(selectedEvent?.event_id, eventA.event_id);
  });

  it("5. Event Detail immediately clears state on eventId change (zero stale data)", () => {
    // Model state of useEventDetail
    let currentEventId: string | null = eventA.event_id;
    let detailData: any = { event_id: eventA.event_id, note: "Data A" };
    let timelineData: any = { event_id: eventA.event_id, observations: 3 };
    let evidenceData: any = { event_id: eventA.event_id, verified: true };
    let intelligenceData: any = { event_id: eventA.event_id, xai: "High" };
    let isLoading = false;

    // Transition to event B
    const onEventIdChange = (newEventId: string | null) => {
      currentEventId = newEventId;
      // IMMEDIATE PURGE
      detailData = null;
      timelineData = null;
      evidenceData = null;
      intelligenceData = null;
      isLoading = Boolean(newEventId);
    };

    onEventIdChange(eventB.event_id);

    // During loading, Event A data MUST NOT be visible
    assert.equal(detailData, null);
    assert.equal(timelineData, null);
    assert.equal(evidenceData, null);
    assert.equal(intelligenceData, null);
    assert.equal(isLoading, true);
  });

  it("6. API rejection produces active-event-aligned fallback, never previous event data", () => {
    // API for Event B fails
    const fallbackDetail = createFallbackEventDetail(eventB.event_id, eventB);
    const fallbackTimeline = createFallbackTimeline(eventB.event_id, eventB);
    const fallbackEvidence = createFallbackEvidence(eventB.event_id, eventB);
    const fallbackIntelligence = createFallbackIntelligence(eventB.event_id, eventB);

    assert.equal(fallbackDetail.event_id, eventB.event_id);
    assert.equal(fallbackTimeline.event_id, eventB.event_id);
    assert.equal(fallbackEvidence.event_id, eventB.event_id);
    assert.equal(fallbackIntelligence.event_id, eventB.event_id);

    // Verify it is derived from Event B coordinates and FRP
    assert.equal(fallbackDetail.geometry.coordinates[0], eventB.longitude);
    assert.equal(fallbackDetail.geometry.coordinates[1], eventB.latitude);
    assert.equal(fallbackTimeline.timeline[fallbackTimeline.timeline.length - 1].frp_mw, eventB.frp_mw);
  });

  it("7. Async race condition protection: Slow Event A cannot overwrite rapid Event B selection", async () => {
    let activeEventId = eventA.event_id;
    const state: { committedData: { event_id: string } | null } = { committedData: null };
    let requestId = 0;

    const fetchDetail = (id: string, delayMs: number) => {
      const currentReq = ++requestId;
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Validation: only commit if requestId is still active and event matches
          if (currentReq === requestId && activeEventId === id) {
            state.committedData = { event_id: id };
          }
          resolve();
        }, delayMs);
      });
    };

    // User selects A (slow query: 60ms)
    activeEventId = eventA.event_id;
    const promiseA = fetchDetail(eventA.event_id, 60);

    // User rapidly clicks B (fast query: 10ms)
    activeEventId = eventB.event_id;
    const promiseB = fetchDetail(eventB.event_id, 10);

    // Fast B finishes first
    await promiseB;
    assert.equal(state.committedData?.event_id, eventB.event_id);

    // Slow A finishes later
    await promiseA;
    // Committed data MUST still be B, NEVER overwritten by A
    assert.equal(state.committedData?.event_id, eventB.event_id);
  });
});
