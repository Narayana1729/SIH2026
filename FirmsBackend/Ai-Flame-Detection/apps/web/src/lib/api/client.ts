/**
 * Production-ready typed HTTP API Client for SIH26162
 */

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly data: unknown;
  public readonly isNetworkError: boolean;

  constructor({
    message,
    status = 500,
    statusText = "Internal Error",
    data = null,
    isNetworkError = false,
  }: {
    message: string;
    status?: number;
    statusText?: string;
    data?: unknown;
    isNetworkError?: boolean;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

export function getApiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");
  }
  // In the browser, use empty string to leverage Next.js proxy rewrites
  if (typeof window !== "undefined") {
    return "";
  }
  // Server-side default to internal backend
  return process.env?.BACKEND_INTERNAL_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8000";
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs = 12000, params, signal: customSignal, ...fetchInit } = options;
  const baseUrl = getApiBaseUrl();

  // 1. Build URL with query parameters and safe base fallback
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const base = baseUrl || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8000");
  const url = new URL(cleanEndpoint, base);

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        url.searchParams.append(key, String(val));
      }
    });
  }

  // 2. Set up timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (customSignal) {
    customSignal.addEventListener("abort", () => controller.abort());
  }

  // 3. Prepare headers with authentication injection
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(fetchInit.headers as Record<string, string>),
  };

  if (typeof window !== "undefined") {
    try {
      const storedToken = localStorage.getItem("pyrosat_auth_token");
      if (storedToken && !headers["Authorization"] && !headers["X-API-Key"]) {
        if (storedToken.startsWith("ey") || storedToken.includes(".")) {
          headers["Authorization"] = `Bearer ${storedToken}`;
        } else {
          headers["X-API-Key"] = storedToken;
        }
      }
    } catch {
      // ignore localStorage exception
    }
  }

  try {
    const response = await fetch(url.toString(), {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 4. Handle non-2xx HTTP responses
    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }

      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      if (typeof errorBody === "object" && errorBody !== null) {
        if ("detail" in errorBody) {
          const detail = (errorBody as any).detail;
          if (typeof detail === "string") {
            errorMessage = detail;
          } else if (Array.isArray(detail)) {
            errorMessage = detail
              .map((d: any) => (typeof d === "object" && d.msg ? d.msg : JSON.stringify(d)))
              .join("; ");
          }
        } else if ("message" in errorBody && typeof (errorBody as any).message === "string") {
          errorMessage = (errorBody as any).message;
        }
      }

      throw new ApiClientError({
        message: errorMessage,
        status: response.status,
        statusText: response.statusText,
        data: errorBody,
      });
    }

    // 5. Parse successful JSON response
    const json = (await response.json()) as T;
    return json;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError({
        message: `API request to ${cleanEndpoint} timed out after ${timeoutMs}ms`,
        status: 408,
        statusText: "Request Timeout",
        isNetworkError: true,
      });
    }

    throw new ApiClientError({
      message: error instanceof Error ? error.message : "Network request failed",
      status: 0,
      statusText: "Network Error",
      isNetworkError: true,
      data: error,
    });
  }
}
