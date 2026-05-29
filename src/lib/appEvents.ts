/** Evento globale: liste lavori/agenda da aggiornare (checkout, modifica, ecc.). */
export const JOBS_UPDATED_EVENT = "jobs:updated";

export function emitJobsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(JOBS_UPDATED_EVENT));
}

export const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

export function emitAuthSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}
