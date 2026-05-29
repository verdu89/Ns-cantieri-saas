import { emitAuthSessionExpired } from "@/lib/appEvents";
import { fetchWithResilience, type HttpRequestOptions } from "@/utils/resilientRequest";

const defaultBaseUrl = "http://localhost:4000/api";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || defaultBaseUrl;

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RefreshResponse = {
  token: string;
  user?: unknown;
};

let refreshInFlight: Promise<boolean> | null = null;

/** Non mostrare "sessione scaduta" su bootstrap auth (token assente o già invalido). */
function shouldEmitSessionExpired(path: string): boolean {
  if (path.startsWith("/auth/login")) return false;
  if (path.startsWith("/auth/refresh")) return false;
  if (path.startsWith("/auth/me")) return false;
  return true;
}

/** Rinnova il JWT (anche se scaduto da poco) senza rifare il login. */
export async function tryRefreshSession(): Promise<boolean> {
  const token = localStorage.getItem("auth_token");
  if (!token) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetchWithResilience(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await response.text();
        if (!response.ok) return false;
        const data = JSON.parse(text) as RefreshResponse;
        if (!data.token) return false;
        localStorage.setItem("auth_token", data.token);
        if (data.user) {
          localStorage.setItem("auth_user", JSON.stringify(data.user));
        }
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

async function request<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  options?: HttpRequestOptions,
  retried = false
): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetchWithResilience(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    options
  );

  const text = await response.text();
  if (!response.ok) {
    const isAuthRoute = path.startsWith("/auth/");
    if (response.status === 401 && !isAuthRoute && !retried) {
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        return request<T>(path, method, body, options, true);
      }
    }
    if (response.status === 401 && shouldEmitSessionExpired(path)) {
      emitAuthSessionExpired();
    }
    throw new Error(`${response.status}:${text || "Request failed"}`);
  }
  if (response.status === 204 || text.length === 0) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

export const httpClient = {
  get: <T>(path: string, options?: HttpRequestOptions) =>
    request<T>(path, "GET", undefined, options),
  post: <T>(path: string, body: unknown, options?: HttpRequestOptions) =>
    request<T>(path, "POST", body, options),
  put: <T>(path: string, body: unknown, options?: HttpRequestOptions) =>
    request<T>(path, "PUT", body, options),
  patch: <T>(path: string, body: unknown, options?: HttpRequestOptions) =>
    request<T>(path, "PATCH", body, options),
  delete: <T = void>(path: string, body?: unknown, options?: HttpRequestOptions) =>
    request<T>(path, "DELETE", body, options),
};

export type { HttpRequestOptions };
