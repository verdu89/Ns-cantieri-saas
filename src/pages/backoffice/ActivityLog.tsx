import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  activityLogAPI,
  type ActivityLogEntry,
} from "@/api/activityLogAPI";
import { saasAdminAPI, type TenantListItem } from "@/api/saasAdmin";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/utils/date";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import {
  PageHeader,
  inputFieldClass,
  selectFieldClass,
  filterGridClass,
  mobileCardListClass,
} from "@/components/layout/PageChrome";
import { DataCard } from "@/components/layout/DataCard";

const PAGE_SIZE = 40;

function describeActivityLogError(e: unknown): string {
  if (!(e instanceof Error) || !e.message.includes(":")) {
    return "Impossibile caricare il registro attività.";
  }
  const colon = e.message.indexOf(":");
  const status = e.message.slice(0, colon).trim();
  const bodyRaw = e.message.slice(colon + 1).trim();
  try {
    const j = JSON.parse(bodyRaw) as {
      message?: string;
      hint?: string;
      code?: string;
    };
    const parts = [j.message, j.hint].filter(Boolean);
    if (parts.length) return parts.join(" ");
    return `${status}: ${bodyRaw}`;
  } catch {
    return bodyRaw ? `${status}: ${bodyRaw}` : `Errore ${status}`;
  }
}

function ContextBadges({ row }: { row: ActivityLogEntry }) {
  const ctx = row.businessContext;
  if (!ctx && !row.contextLabel) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  if (ctx) {
    return (
      <div className="space-y-1 text-xs leading-snug">
        {ctx.orderCode && (
          <div>
            <span className="font-semibold text-slate-600">Commessa:</span>{" "}
            <span className="text-slate-800">{ctx.orderCode}</span>
          </div>
        )}
        {ctx.customerName && (
          <div>
            <span className="font-semibold text-slate-600">Cliente:</span>{" "}
            <span className="text-slate-800">{ctx.customerName}</span>
          </div>
        )}
        {ctx.jobTitle && (
          <div>
            <span className="font-semibold text-slate-600">Intervento:</span>{" "}
            <span className="text-slate-800">{ctx.jobTitle}</span>
            {ctx.jobStatus && (
              <span className="ml-1 text-slate-500">({ctx.jobStatus})</span>
            )}
          </div>
        )}
      </div>
    );
  }
  return <p className="text-xs leading-snug text-slate-700">{row.contextLabel}</p>;
}

function formatPayload(payload: unknown): string {
  if (payload == null) return "—";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function ActivityLogPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);

  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tenantScope, setTenantScope] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const platformAdmin = Boolean(user?.isPlatformAdmin);

  const clearScopeLabel = (() => {
    if (!platformAdmin) {
      return "il tuo account";
    }
    if (tenantScope) {
      const t = tenants.find((x) => x.id === tenantScope);
      return t ? `${t.displayName} (${t.slug})` : "il tenant selezionato";
    }
    return "tutti i tenant";
  })();

  useEffect(() => {
    if (!platformAdmin) return;
    saasAdminAPI
      .listTenants()
      .then(setTenants)
      .catch(() => {
        /* elenco tenant opzionale per filtro */
      });
  }, [platformAdmin]);

  async function load(pageSkip: number) {
    setLoading(true);
    try {
      const res = await activityLogAPI.list({
        q: q.trim() || undefined,
        entityType: entityType.trim() || undefined,
        entityId: entityId.trim() || undefined,
        from: from ? `${from}T00:00:00.000Z` : undefined,
        to: to ? `${to}T23:59:59.999Z` : undefined,
        tenantScope: platformAdmin ? tenantScope.trim() || undefined : undefined,
        skip: pageSkip,
        take: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
      setSkip(res.skip);
      setExpandedId(null);
    } catch (e) {
      console.error(e);
      toast.error(describeActivityLogError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo mount
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void load(0);
  }

  async function confirmClearLog() {
    setClearing(true);
    try {
      const res = await activityLogAPI.clear(
        platformAdmin && tenantScope ? { tenantScope } : undefined
      );
      toast.success(
        res.deleted > 0
          ? `Eliminate ${res.deleted} attività. Il registro è vuoto.`
          : "Nessuna attività da eliminare."
      );
      await load(0);
    } catch (e) {
      console.error(e);
      toast.error(describeActivityLogError(e));
    } finally {
      setClearing(false);
    }
  }

  const pageIndex = Math.floor(skip / PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Registro attività"
        description={
          platformAdmin
            ? "Cronologia operazioni di tutti i tenant: chi ha fatto cosa, in linguaggio chiaro."
            : "Chi ha fatto cosa e quando nel tuo account (modifiche, accessi, documenti)."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className={filterGridClass}>
              <input
                type="search"
                placeholder="Cerca nome, email, riepilogo…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={inputFieldClass}
              />
              <input
                type="text"
                placeholder="Tipo (es. Job, Customer)"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className={inputFieldClass}
              />
              <input
                type="text"
                placeholder="ID record (opzionale)"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className={inputFieldClass}
              />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={inputFieldClass}
                aria-label="Data da"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={inputFieldClass}
                aria-label="Data a"
              />
              {platformAdmin && (
                <select
                  className={selectFieldClass + " w-full"}
                  value={tenantScope}
                  onChange={(e) => setTenantScope(e.target.value)}
                  aria-label="Filtra per tenant"
                >
                  <option value="">Tutti i tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName} ({t.slug})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Button type="submit" variant="primary" className="font-semibold">
              Applica filtri
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Eventi ({total})</CardTitle>
          <div className="flex w-full flex-wrap items-center gap-2 text-sm sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={loading || clearing || total === 0}
              onClick={() => setClearOpen(true)}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Svuota registro
            </Button>
            <button
              type="button"
              disabled={loading || skip <= 0}
              onClick={() => void load(Math.max(0, skip - PAGE_SIZE))}
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600"
            >
              <ChevronLeft size={18} /> Prec.
            </button>
            <span>
              Pag. {pageIndex + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={loading || skip + PAGE_SIZE >= total}
              onClick={() => void load(skip + PAGE_SIZE)}
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600"
            >
              Succ. <ChevronRight size={18} />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Caricamento…</p>
          ) : items.length === 0 ? (
            <p className="text-gray-500">Nessun evento trovato.</p>
          ) : (
            <>
            <div className={mobileCardListClass}>
              {items.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <DataCard
                    key={row.id}
                    title={row.summary}
                    subtitle={formatDateTime(new Date(row.createdAt))}
                    badge={
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {row.actionLabel ?? row.action}
                      </span>
                    }
                    rows={[
                      {
                        label: "Chi",
                        value: row.actorName ?? "Sistema",
                      },
                      ...(platformAdmin
                        ? [
                            {
                              label: "Tenant",
                              value: row.tenantDisplayName ?? "—",
                            },
                          ]
                        : []),
                    ]}
                  >
                    <div className="mt-2">
                      <ContextBadges row={row} />
                    </div>
                    <button
                      type="button"
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                    >
                      {expanded ? (
                        <>
                          <ChevronUp size={14} /> Nascondi dettaglio
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> Dettaglio tecnico
                        </>
                      )}
                    </button>
                    {expanded && (
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                        {formatPayload(row.payload)}
                      </pre>
                    )}
                  </DataCard>
                );
              })}
            </div>

            <div className="table-wrapper hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="w-8 py-2" aria-label="Dettaglio" />
                  <th className="whitespace-nowrap py-2 pr-3">Quando</th>
                  {platformAdmin && <th className="whitespace-nowrap py-2 pr-3">Tenant</th>}
                  <th className="whitespace-nowrap py-2 pr-3">Chi</th>
                  <th className="whitespace-nowrap py-2 pr-3">Tipo</th>
                  <th className="min-w-[10rem] py-2 pr-3">Contesto</th>
                  <th className="py-2 pr-3">Cosa è successo</th>
                  <th className="hidden whitespace-nowrap py-2 pr-3 lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const expanded = expandedId === row.id;
                  const colSpan = platformAdmin ? 8 : 7;
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-gray-100 align-top dark:border-gray-800">
                        <td className="py-2">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-500 hover:bg-slate-100"
                            onClick={() => setExpandedId(expanded ? null : row.id)}
                            aria-expanded={expanded}
                            title="Dettaglio tecnico"
                          >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-gray-600 dark:text-gray-400">
                          {formatDateTime(new Date(row.createdAt))}
                        </td>
                        {platformAdmin && (
                          <td className="py-2 pr-3">
                            <div className="font-medium text-slate-800">
                              {row.tenantDisplayName ?? "—"}
                            </div>
                            {row.tenantSlug && (
                              <div className="text-xs text-gray-500">{row.tenantSlug}</div>
                            )}
                          </td>
                        )}
                        <td className="py-2 pr-3">
                          <div className="font-medium">{row.actorName ?? "Sistema"}</div>
                          <div className="text-xs text-gray-500">{row.actorEmail ?? ""}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {row.actionLabel ?? row.action}
                          </span>
                        </td>
                        <td className="max-w-xs py-2 pr-3">
                          <ContextBadges row={row} />
                        </td>
                        <td className="max-w-lg py-2 pr-3 leading-snug">{row.summary}</td>
                        <td className="hidden py-2 pr-3 text-xs lg:table-cell">{row.ip ?? "—"}</td>
                      </tr>
                      {expanded && (
                        <tr key={`${row.id}-detail`} className="bg-slate-50/80 dark:bg-slate-900/40">
                          <td colSpan={colSpan} className="px-3 pb-3 pt-0">
                            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950">
                              {row.requestPath && (
                                <p className="mb-2 text-slate-600">
                                  <span className="font-semibold">Richiesta:</span>{" "}
                                  {row.requestMethod} {row.requestPath}
                                </p>
                              )}
                              <p className="mb-1 font-semibold text-slate-700">Dettaglio tecnico</p>
                              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-slate-600">
                                {formatPayload(row.payload)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={clearOpen}
        setOpen={setClearOpen}
        title="Svuota registro attività"
        description={
          <>
            <p>
              Stai per eliminare <strong>tutte</strong> le attività registrate per{" "}
              <strong>{clearScopeLabel}</strong> (non solo quelle visibili in tabella con i
              filtri attuali).
            </p>
            <p className="mt-2">
              L&apos;operazione è irreversibile. Interventi, commesse e pagamenti non vengono
              toccati: si azzera solo la cronologia audit.
            </p>
            {platformAdmin && !tenantScope && (
              <p className="mt-2 font-medium text-red-700">
                Attenzione: stai per svuotare il registro di tutti i tenant.
              </p>
            )}
          </>
        }
        confirmText={clearing ? "Eliminazione…" : "Elimina tutto"}
        onConfirm={confirmClearLog}
      />
    </div>
  );
}
