import type {
  EscalationDecision,
  EventResponseRecommendation,
  NotificationRequest,
  NotificationResponse,
  ResponseActivityRecord,
  ChannelResult,
} from "../../types/responders.ts";
import type { ThermalEvent } from "../../types/event.ts";
import { calculateLocalResponseRecommendation } from "./engine.ts";

function buildApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (typeof window !== "undefined") {
    return cleanEndpoint;
  }
  const base = process.env?.BACKEND_INTERNAL_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8000";
  return `${base}${cleanEndpoint}`;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (typeof window !== "undefined") {
    try {
      const token = localStorage.getItem("pyrosat_auth_token");
      if (token) {
        if (token.startsWith("ey") || token.includes(".")) {
          headers["Authorization"] = `Bearer ${token}`;
        } else {
          headers["X-API-Key"] = token;
        }
      }
    } catch {
      // ignore
    }
  }
  return headers;
}

// In-memory frontend session activity store for offline demo persistence
const localSessionActivity: ResponseActivityRecord[] = [];

/**
 * Fetches prioritized emergency responder recommendations from FastAPI backend
 * or seamlessly falls back to the deterministic local engine.
 */
export async function fetchEventResponders(
  event: ThermalEvent,
  demoPhone?: string
): Promise<EventResponseRecommendation> {
  try {
    const cleanEndpoint = `/events/${encodeURIComponent(event.event_id)}/responders${
      demoPhone ? `?demo_phone=${encodeURIComponent(demoPhone)}` : ""
    }`;
    const url = buildApiUrl(cleanEndpoint);
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      return data as EventResponseRecommendation;
    }
  } catch {
    // Network or server error -> fallback locally
  }
  return calculateLocalResponseRecommendation(event);
}

export async function fetchEventEscalation(
  eventId: string
): Promise<EscalationDecision | null> {
  try {
    const url = buildApiUrl(`/events/${encodeURIComponent(eventId)}/escalation`);
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return (await res.json()) as EscalationDecision;
    }
  } catch {
    // Network or server error -> fallback to null
  }
  return null;
}

/**
 * Submits an emergency notification to the backend or logs in local session store.
 */
export async function postNotifyResponder(
  eventId: string,
  request: NotificationRequest,
  responderName: string,
  responderType: string
): Promise<NotificationResponse> {
  try {
    const url = buildApiUrl(`/events/${encodeURIComponent(eventId)}/response/notify`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(request),
    });

    if (res.ok) {
      const data = (await res.json()) as NotificationResponse;
      // Also cache in local session
      localSessionActivity.unshift({
        notification_id: data.notification_id,
        event_id: data.event_id,
        responder_id: data.responder_id,
        responder_name: data.responder_name,
        responder_type: responderType as any,
        action: data.action,
        status: data.status,
        mode: data.mode,
        escalation_type: data.escalation_type,
        trigger_source: data.trigger_source || data.escalation_type,
        recipient_phone: data.recipient_phone,
        destination_masked: data.destination_masked,
        correlation_id: data.correlation_id,
        channels: data.channels,
        timestamp: data.timestamp,
        analyst_notes: request.analyst_notes,
      });
      return data;
    }
  } catch {
    // Fallback simulation
  }

  // Local deterministic simulation fallback
  const now = new Date().toISOString();
  const notifId = `NOTIF-${eventId}-${request.responder_id}-${Date.now()}`;
  const phone = request.recipient_phone || "+91-112";
  const maskedPhone = phone.length > 4 ? `+91 ******${phone.slice(-4)}` : "****";
  const corrId = `CORR-${eventId}-LOCAL`;

  const channels: ChannelResult[] = (
    request.channels || ["SMS", "WHATSAPP"]
  ).map((ch) => ({
    channel: ch,
    status: "SIMULATED",
    recipient: phone,
    destination_masked: maskedPhone,
    message: `${ch} demo notification simulated successfully.`,
    provider_message_id: `SIM-${ch}-${Date.now()}`,
    correlation_id: corrId,
    submitted_at: now,
    delivered_at: now,
    retry_count: 0,
  }));

  const response: NotificationResponse = {
    notification_id: notifId,
    event_id: eventId,
    responder_id: request.responder_id,
    responder_name: responderName,
    action: request.action || "NOTIFY",
    status: "SIMULATED",
    mode: request.mode || "SIMULATED",
    escalation_type: request.escalation_type || "ADMIN_CONFIRMED",
    trigger_source: request.escalation_type || "ADMIN_CONFIRMED",
    recipient_phone: phone,
    destination_masked: maskedPhone,
    correlation_id: corrId,
    channels,
    timestamp: now,
    message: `Notification has been sent successfully to ${phone}. (SIMULATED)`,
  };

  const record: ResponseActivityRecord = {
    notification_id: notifId,
    event_id: eventId,
    responder_id: request.responder_id,
    responder_name: responderName,
    responder_type: responderType as any,
    action: request.action || "NOTIFY",
    status: "SIMULATED",
    mode: request.mode || "SIMULATED",
    escalation_type: request.escalation_type || "ADMIN_CONFIRMED",
    trigger_source: request.escalation_type || "ADMIN_CONFIRMED",
    recipient_phone: phone,
    destination_masked: maskedPhone,
    correlation_id: corrId,
    channels,
    timestamp: now,
    analyst_notes: request.analyst_notes,
  };

  localSessionActivity.unshift(record);
  return response;
}

/**
 * Triggers automatic or manual escalation for an event.
 */
export async function postEscalateEvent(
  eventId: string,
  request: NotificationRequest,
  responderName: string,
  responderType: string
): Promise<NotificationResponse> {
  return postNotifyResponder(eventId, request, responderName, responderType);
}

/**
 * Fetches historical response activity for an event.
 */
export async function fetchResponseActivity(
  eventId: string
): Promise<ResponseActivityRecord[]> {
  try {
    const url = buildApiUrl(`/events/${encodeURIComponent(eventId)}/response/activity`);
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.records) && data.records.length > 0) {
        return data.records as ResponseActivityRecord[];
      }
    }
  } catch {
    // Fallback
  }

  return localSessionActivity.filter((r) => r.event_id === eventId);
}
