/** Scope cache in-memory per tenant (evita liste di un altro tenant dopo cambio login). */
export function tenantCacheScope(): string {
  try {
    const raw = localStorage.getItem("auth_user");
    if (!raw) return "anon";
    const u = JSON.parse(raw) as { tenantId?: string | null };
    const id = u.tenantId?.trim();
    return id || "no-tenant";
  } catch {
    return "anon";
  }
}
