import { withRetry, isRetryableHttpError } from "@/utils/retry";

export type HttpRequestOptions = {
  timeoutMs?: number;
  retries?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;
const BODY_SIZE_UPLOAD_THRESHOLD = 200_000;

function isUploadPayload(body: unknown): boolean {
  if (body === undefined) return false;
  try {
    return JSON.stringify(body).length >= BODY_SIZE_UPLOAD_THRESHOLD;
  } catch {
    return false;
  }
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

export async function fetchWithResilience(
  url: string,
  init: RequestInit,
  options: HttpRequestOptions = {}
): Promise<Response> {
  const upload = isUploadPayload(init.body);
  const timeoutMs =
    options.timeoutMs ?? (upload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const maxAttempts = options.retries ?? 3;

  return withRetry(
    async () => {
      const signal = timeoutSignal(timeoutMs);
      try {
        const response = await fetch(url, { ...init, signal });
        if (
          !response.ok &&
          (response.status === 408 ||
            response.status === 429 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504)
        ) {
          const text = await response.text();
          throw new Error(`${response.status}:${text || "Request failed"}`);
        }
        return response;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new TypeError("failed to fetch: timeout");
        }
        throw err;
      }
    },
    { maxAttempts }
  );
}

export function shouldRetryRequestError(err: unknown): boolean {
  return isRetryableHttpError(err);
}
