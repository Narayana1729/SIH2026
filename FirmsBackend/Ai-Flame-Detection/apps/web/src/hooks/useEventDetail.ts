"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchEventDetail,
  fetchEventTimeline,
  fetchEventEvidence,
  fetchEventIntelligence,
} from "@/lib/api/events";
import { ApiClientError } from "@/lib/api/client";
import {
  createFallbackEventDetail,
  createFallbackTimeline,
  createFallbackEvidence,
  createFallbackIntelligence,
} from "@/lib/api/eventFallbacks";
import type {
  ThermalEvent,
  EventDetailResponse,
  EventTimelineResponse,
  EventEvidenceResponse,
} from "@/types/event";
import type { IntelligenceResult } from "@/types/intelligence";

export interface UseEventDetailResult {
  detail: EventDetailResponse | null;
  timeline: EventTimelineResponse | null;
  evidence: EventEvidenceResponse | null;
  intelligence: IntelligenceResult | null;
  isLoading: boolean;
  isError: boolean;
  error: ApiClientError | null;
  refetch: () => Promise<void>;
}

export function useEventDetail(
  eventId: string | null | undefined,
  candidateEvent?: ThermalEvent | null
): UseEventDetailResult {
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [timeline, setTimeline] = useState<EventTimelineResponse | null>(null);
  const [evidence, setEvidence] = useState<EventEvidenceResponse | null>(null);
  const [intelligence, setIntelligence] = useState<IntelligenceResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<ApiClientError | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  const loadData = useCallback(async (id: string) => {
    // 1. Race condition guard: mark active request ID
    activeRequestIdRef.current = id;

    // 2. Abort any previous pending in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 3. Immediately clear all event-specific state for clean transition
    setDetail(null);
    setTimeline(null);
    setEvidence(null);
    setIntelligence(null);
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const [detailRes, timelineRes, evidenceRes, intelligenceRes] = await Promise.allSettled([
        fetchEventDetail(id, controller.signal),
        fetchEventTimeline(id, controller.signal),
        fetchEventEvidence(id, controller.signal),
        fetchEventIntelligence(id, controller.signal),
      ]);

      // 4. Validate response still belongs to the currently active event ID
      if (activeRequestIdRef.current !== id) {
        return;
      }

      // 5. Commit event-aligned data, falling back gracefully to active event-derived fixtures if offline
      const resolvedDetail =
        detailRes.status === "fulfilled"
          ? detailRes.value
          : createFallbackEventDetail(id, candidateEvent);

      const resolvedTimeline =
        timelineRes.status === "fulfilled"
          ? timelineRes.value
          : createFallbackTimeline(id, candidateEvent);

      const resolvedEvidence =
        evidenceRes.status === "fulfilled"
          ? evidenceRes.value
          : createFallbackEvidence(id, candidateEvent);

      const resolvedIntelligence =
        intelligenceRes.status === "fulfilled"
          ? intelligenceRes.value
          : createFallbackIntelligence(id, candidateEvent);

      setDetail(resolvedDetail);
      setTimeline(resolvedTimeline);
      setEvidence(resolvedEvidence);
      setIntelligence(resolvedIntelligence);
      setIsError(false);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (activeRequestIdRef.current !== id) {
        return;
      }

      // Guarantee fallback data derived from active event so UI is never left with stale data
      setDetail(createFallbackEventDetail(id, candidateEvent));
      setTimeline(createFallbackTimeline(id, candidateEvent));
      setEvidence(createFallbackEvidence(id, candidateEvent));
      setIntelligence(createFallbackIntelligence(id, candidateEvent));

      const clientError =
        err instanceof ApiClientError
          ? err
          : new ApiClientError({
              message: err instanceof Error ? err.message : "Failed to load event intelligence",
              status: 0,
              statusText: "Unknown Error",
            });
      setIsError(true);
      setError(clientError);
    } finally {
      if (activeRequestIdRef.current === id) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [candidateEvent]);

  useEffect(() => {
    if (!eventId) {
      activeRequestIdRef.current = null;
      setDetail(null);
      setTimeline(null);
      setEvidence(null);
      setIntelligence(null);
      setIsLoading(false);
      setIsError(false);
      setError(null);
      return;
    }

    loadData(eventId);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [eventId, loadData]);

  const refetch = useCallback(async () => {
    if (eventId) {
      await loadData(eventId);
    }
  }, [eventId, loadData]);

  return {
    detail,
    timeline,
    evidence,
    intelligence,
    isLoading,
    isError,
    error,
    refetch,
  };
}
