/** Estrae message (e opzionalmente hint) da Error "status:json" di httpClient. */
export function parseHttpErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const raw = err.message.includes(":")
    ? err.message.slice(err.message.indexOf(":") + 1).trim()
    : err.message;
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string; hint?: string };
    const parts = [parsed.message, parsed.hint].filter(Boolean);
    return parts.length ? parts.join(" — ") : fallback;
  } catch {
    return raw || fallback;
  }
}
