import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { saasAdminAPI, type TenantBackupItem, type TenantListItem, type DatabaseDumpItem } from "@/api/saasAdmin";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  PageHeader,
  inputFieldClass,
  modalBackdropClass,
  modalPanelClass,
  mobileCardListClass,
  tableWrapperClass,
} from "@/components/layout/PageChrome";
import { DataCard } from "@/components/layout/DataCard";
import { formatDateTime } from "@/utils/date";
import { Database, RefreshCw, AlertTriangle, CalendarClock, Building2, Hash, Trash2, Download, Server } from "lucide-react";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function dumpKindLabelIt(kind: string) {
  if (kind === "daily") return "Giornaliero";
  if (kind === "weekly") return "Settimanale";
  if (kind === "monthly") return "Mensile";
  if (kind === "manual") return "Manuale";
  return kind;
}

function dumpTriggerLabelIt(trigger: string) {
  return trigger === "scheduled" ? "Pianificato" : "Manuale";
}

function parseApiError(e: unknown): string {
  if (!(e instanceof Error)) return "Operazione non riuscita.";
  const raw = e.message;
  if (raw.includes("Failed to fetch")) {
    return "Impossibile contattare il server. Controlla la rete e che il backend sia avviato (URL API).";
  }
  if (!raw.includes(":")) {
    return raw || "Operazione non riuscita.";
  }
  const colon = raw.indexOf(":");
  const status = raw.slice(0, colon).trim();
  const bodyRaw = raw.slice(colon + 1).trim();
  if (status === "403") {
    return "Non autorizzato: serve account Super Admin piattaforma (admin senza tenant).";
  }
  if (status === "401") {
    return "Sessione non valida: effettua di nuovo il login.";
  }
  if (status === "405" || status === "404") {
    return "Il server non espone questa operazione: aggiorna e riavvia il backend all’ultima versione.";
  }
  try {
    const j = JSON.parse(bodyRaw) as { message?: string };
    if (j.message) return j.message;
  } catch {
    /* ignore */
  }
  return bodyRaw || raw;
}

export default function TenantBackupsPage() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [filterTenantId, setFilterTenantId] = useState("");
  const [backupTargetTenantId, setBackupTargetTenantId] = useState("");
  const [backups, setBackups] = useState<TenantBackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [restoreRow, setRestoreRow] = useState<TenantBackupItem | null>(null);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [dbDumps, setDbDumps] = useState<DatabaseDumpItem[]>([]);
  const [loadingDbDumps, setLoadingDbDumps] = useState(true);
  const [runningDbDump, setRunningDbDump] = useState(false);
  const [deletingDumpId, setDeletingDumpId] = useState<string | null>(null);
  const [downloadingDumpId, setDownloadingDumpId] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo<"tenant" | "db">(() => {
    const raw = searchParams.get("tab");
    return raw === "db" ? "db" : "tenant";
  }, [searchParams]);

  function setActiveTab(tab: "tenant" | "db") {
    const next = new URLSearchParams(searchParams);
    if (tab === "tenant") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    setSearchParams(next, { replace: true });
  }

  const loadTenants = useCallback(async () => {
    try {
      const list = await saasAdminAPI.listTenants();
      setTenants(list);
    } catch (e) {
      console.error(e);
      toast.error(parseApiError(e));
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const list = await saasAdminAPI.listTenantBackups({
        tenantId: filterTenantId || undefined,
        take: 200,
      });
      setBackups(list);
    } catch (e) {
      console.error(e);
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [filterTenantId]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const loadDatabaseDumps = useCallback(async () => {
    setLoadingDbDumps(true);
    try {
      const list = await saasAdminAPI.listDatabaseDumps({ take: 200 });
      setDbDumps(list);
    } catch (e) {
      console.error(e);
      toast.error(parseApiError(e));
    } finally {
      setLoadingDbDumps(false);
    }
  }, []);

  useEffect(() => {
    void loadDatabaseDumps();
  }, [loadDatabaseDumps]);

  async function handleRunBackupSingle() {
    const tid = backupTargetTenantId.trim();
    if (!tid) {
      toast.error("Seleziona un tenant per il backup manuale.");
      return;
    }
    setRunningBackup(true);
    try {
      const res = await saasAdminAPI.runTenantBackup({ tenantId: tid });
      if ("message" in res) {
        toast.success(res.message);
      } else {
        toast.success("Backup completato.");
      }
      await loadBackups();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setRunningBackup(false);
    }
  }

  async function handleRunBackupAll() {
    if (
      !window.confirm(
        "Avviare il backup per tutti i tenant non archiviati? L'operazione gira in background."
      )
    ) {
      return;
    }
    setRunningBackup(true);
    try {
      const res = await saasAdminAPI.runTenantBackup({});
      if ("message" in res) {
        toast.success(res.message);
      } else {
        toast.success("Backup completato.");
      }
      setTimeout(() => void loadBackups(), 3000);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setRunningBackup(false);
    }
  }

  async function handleRestore() {
    if (!restoreRow) return;
    const slug = confirmSlug.trim();
    if (slug.length < 3) {
      toast.error("Inserisci lo slug del tenant per confermare.");
      return;
    }
    setRestoring(true);
    try {
      await saasAdminAPI.restoreTenantBackup(restoreRow.id, slug);
      toast.success("Ripristino completato.");
      setRestoreRow(null);
      setConfirmSlug("");
      await loadBackups();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setRestoring(false);
    }
  }

  async function handleDownloadBackup(b: TenantBackupItem) {
    if (b.status !== "completed") return;
    setDownloadingId(b.id);
    try {
      const { blob, fileName } = await saasAdminAPI.downloadTenantBackup(b.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Backup scaricato.");
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDeleteBackup(b: TenantBackupItem) {
    if (
      !window.confirm(
        `Eliminare definitivamente questo backup (${b.tenantDisplayName ?? b.tenantSlug}, ${formatDateTime(b.startedAt)})? Il file sul server verrà rimosso se presente.`
      )
    ) {
      return;
    }
    setDeletingId(b.id);
    try {
      await saasAdminAPI.deleteTenantBackup(b.id);
      toast.success("Backup eliminato.");
      await loadBackups();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRunDatabaseDump() {
    setRunningDbDump(true);
    try {
      await saasAdminAPI.runDatabaseDump({ kind: "manual" });
      toast.success("Dump PostgreSQL completato.");
      await loadDatabaseDumps();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setRunningDbDump(false);
    }
  }

  async function handleDownloadDatabaseDump(d: DatabaseDumpItem) {
    if (d.status !== "completed") return;
    setDownloadingDumpId(d.id);
    try {
      const { blob, fileName } = await saasAdminAPI.downloadDatabaseDump(d.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Dump scaricato.");
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDownloadingDumpId(null);
    }
  }

  async function handleDeleteDatabaseDump(d: DatabaseDumpItem) {
    if (
      !window.confirm(
        `Eliminare questo dump PostgreSQL (${dumpKindLabelIt(d.kind)}, ${formatDateTime(d.startedAt)})? Il file sul server verrà rimosso.`
      )
    ) {
      return;
    }
    setDeletingDumpId(d.id);
    try {
      await saasAdminAPI.deleteDatabaseDump(d.id);
      toast.success("Dump eliminato.");
      await loadDatabaseDumps();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setDeletingDumpId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Backup"
        description={
          activeTab === "tenant"
            ? "Snapshot logici per singolo tenant (JSON). Pianificati il venerdì alle 19:00 se ENABLE_TENANT_BACKUP_CRON è attivo (fuso Europe/Rome). Massimo TENANT_BACKUP_MAX_PER_TENANT righe per tenant (default 5). Il ripristino è disponibile da qui."
            : "Dump completi PostgreSQL (pg_dump -Fc). Pianificati giornalmente alle 03:00, settimanalmente la domenica alle 03:30 e mensilmente il 1° alle 04:00 se ENABLE_DB_DUMP_CRON è attivo. Richiede pg_dump nel PATH del server. Il ripristino va eseguito con pg_restore su Postgres in manutenzione."
        }
      />

      <div
        role="tablist"
        aria-label="Tipi di backup"
        className="inline-flex w-full max-w-md rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "tenant"}
          onClick={() => setActiveTab("tenant")}
          className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
            activeTab === "tenant"
              ? "bg-[var(--ns-brand)] text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Database size={16} />
            Snapshot tenant
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "db"}
          onClick={() => setActiveTab("db")}
          className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
            activeTab === "db"
              ? "bg-[var(--ns-brand)] text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Server size={16} />
            Dump PostgreSQL
          </span>
        </button>
      </div>

      {activeTab === "tenant" && (
      <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database size={20} className="text-[var(--ns-brand)]" />
            Operazioni
          </CardTitle>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadBackups()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Aggiorna elenco
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-0 w-full flex-1 md:min-w-[200px]">
            <label className="mb-1 block text-sm font-medium text-slate-600">Filtra elenco backup</label>
            <select
              className={inputFieldClass}
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
            >
              <option value="">Tutti i tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 w-full flex-1 md:min-w-[200px]">
            <label className="mb-1 block text-sm font-medium text-slate-600">Backup manuale (un tenant)</label>
            <select
              className={inputFieldClass}
              value={backupTargetTenantId}
              onChange={(e) => setBackupTargetTenantId(e.target.value)}
            >
              <option value="">— Seleziona —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={runningBackup}
              onClick={() => void handleRunBackupSingle()}
            >
              Esegui backup
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={runningBackup}
              onClick={() => void handleRunBackupAll()}
            >
              Backup tutti
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Storico backup</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && backups.length === 0 ? (
            <p className="text-sm text-slate-500">Caricamento…</p>
          ) : backups.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun backup registrato.</p>
          ) : (
            <>
            <div className={mobileCardListClass}>
              {backups.map((b) => (
                <DataCard
                  key={b.id}
                  title={b.tenantDisplayName ?? b.tenantSlug ?? "—"}
                  subtitle={formatDateTime(b.startedAt)}
                  badge={
                    <span
                      className={
                        b.status === "completed"
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                          : b.status === "failed"
                            ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800"
                            : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
                      }
                    >
                      {b.status}
                    </span>
                  }
                  rows={[
                    {
                      label: "Origine",
                      value: b.trigger === "scheduled" ? "Pianificato" : "Manuale",
                    },
                    {
                      label: "Dimensione",
                      value:
                        b.status === "completed" ? formatBytes(b.sizeBytes) : "—",
                    },
                    ...(b.errorMessage
                      ? [
                          {
                            label: "Errore",
                            value: b.errorMessage,
                            valueClassName: "text-red-600 text-xs",
                          },
                        ]
                      : []),
                  ]}
                  footer={
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center sm:flex-1"
                        disabled={b.status !== "completed" || downloadingId === b.id}
                        onClick={() => void handleDownloadBackup(b)}
                      >
                        <Download size={16} className="mr-1.5 shrink-0" />
                        {downloadingId === b.id ? "Scaricamento…" : "Scarica"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-center sm:flex-1"
                        disabled={b.status === "running" || deletingId === b.id}
                        onClick={() => void handleDeleteBackup(b)}
                      >
                        <Trash2 size={16} className="mr-1.5 shrink-0" />
                        Elimina
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full text-red-700 ring-red-200 hover:bg-red-50 sm:flex-1"
                        disabled={b.status !== "completed"}
                        onClick={() => {
                          setRestoreRow(b);
                          setConfirmSlug("");
                        }}
                      >
                        Ripristina
                      </Button>
                    </div>
                  }
                />
              ))}
            </div>
            <div className={tableWrapperClass}>
            <table className="w-full min-w-0 border-collapse text-left text-sm md:min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Tenant</th>
                  <th className="py-2 pr-3">Avviato</th>
                  <th className="py-2 pr-3">Stato</th>
                  <th className="py-2 pr-3">Origine</th>
                  <th className="py-2 pr-3">Dimensione</th>
                  <th className="py-2 pr-3">Errore</th>
                  <th className="py-2 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-800">{b.tenantDisplayName ?? b.tenantSlug}</div>
                      <div className="text-xs text-slate-500">{b.tenantSlug}</div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{formatDateTime(b.startedAt)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          b.status === "completed"
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                            : b.status === "failed"
                              ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800"
                              : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
                        }
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {b.trigger === "scheduled" ? "Pianificato" : "Manuale"}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {b.status === "completed" ? formatBytes(b.sizeBytes) : "—"}
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-3 text-xs text-red-600" title={b.errorMessage ?? ""}>
                      {b.errorMessage ?? "—"}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          aria-label="Scarica backup"
                          className="text-slate-700"
                          disabled={b.status !== "completed" || downloadingId === b.id}
                          onClick={() => void handleDownloadBackup(b)}
                          title={
                            b.status === "completed"
                              ? "Scarica il file .json.gz sul computer"
                              : "Disponibile solo per backup completati"
                          }
                        >
                          <Download
                            size={16}
                            className={downloadingId === b.id ? "animate-pulse" : ""}
                            aria-hidden
                          />
                          <span className="hidden sm:inline sm:ml-1.5">
                            {downloadingId === b.id ? "Scaricamento…" : "Scarica"}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label="Elimina backup"
                          className="text-slate-700 hover:bg-slate-100"
                          disabled={b.status === "running" || deletingId === b.id}
                          onClick={() => void handleDeleteBackup(b)}
                          title={
                            b.status === "running"
                              ? "Attendi il completamento del backup"
                              : "Elimina backup e file"
                          }
                        >
                          <Trash2 size={16} className={deletingId === b.id ? "opacity-50" : ""} aria-hidden />
                          <span className="hidden sm:inline sm:ml-1.5">Elimina</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-red-700 ring-red-200 hover:bg-red-50"
                          disabled={b.status !== "completed"}
                          onClick={() => {
                            setRestoreRow(b);
                            setConfirmSlug("");
                          }}
                        >
                          Ripristina
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      </>
      )}

      {activeTab === "db" && (
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server size={20} className="text-[var(--ns-brand)]" />
            Dump PostgreSQL (pg_dump)
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadDatabaseDumps()}
              disabled={loadingDbDumps}
              className="gap-2"
            >
              <RefreshCw size={16} className={loadingDbDumps ? "animate-spin" : ""} />
              Aggiorna
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={runningDbDump}
              onClick={() => void handleRunDatabaseDump()}
              className="gap-2"
            >
              <Database size={16} />
              {runningDbDump ? "Dump in corso…" : "Avvia dump manuale"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingDbDumps && dbDumps.length === 0 ? (
            <p className="text-sm text-slate-500">Caricamento dump…</p>
          ) : dbDumps.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nessun dump registrato. Abilita <span className="font-mono text-xs">ENABLE_DB_DUMP_CRON</span> sul
              server per i dump pianificati, oppure usa &quot;Avvia dump manuale&quot;.
            </p>
          ) : (
            <>
              <div className={`${mobileCardListClass} md:hidden`}>
                {dbDumps.map((d) => (
                  <DataCard
                    key={d.id}
                    title={dumpKindLabelIt(d.kind)}
                    subtitle={formatDateTime(d.startedAt)}
                    badge={
                      <span
                        className={
                          d.status === "completed"
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                            : d.status === "failed"
                              ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800"
                              : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
                        }
                      >
                        {d.status}
                      </span>
                    }
                    rows={[
                      {
                        label: "Origine",
                        value: dumpTriggerLabelIt(d.trigger),
                      },
                      {
                        label: "Dimensione",
                        value: d.status === "completed" ? formatBytes(d.sizeBytes) : "—",
                      },
                      ...(d.errorMessage
                        ? [
                            {
                              label: "Errore",
                              value: d.errorMessage,
                              valueClassName: "text-red-600 text-xs",
                            },
                          ]
                        : []),
                    ]}
                    footer={
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center sm:flex-1"
                          disabled={d.status !== "completed" || downloadingDumpId === d.id}
                          onClick={() => void handleDownloadDatabaseDump(d)}
                        >
                          <Download size={16} className="mr-1.5 shrink-0" />
                          {downloadingDumpId === d.id ? "Scaricamento…" : "Scarica"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-center sm:flex-1"
                          disabled={d.status === "running" || deletingDumpId === d.id}
                          onClick={() => void handleDeleteDatabaseDump(d)}
                        >
                          <Trash2 size={16} className="mr-1.5 shrink-0" />
                          Elimina
                        </Button>
                      </div>
                    }
                  />
                ))}
              </div>
              <div className={tableWrapperClass}>
                <table className="w-full min-w-0 border-collapse text-left text-sm md:min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Avviato</th>
                      <th className="py-2 pr-3">Stato</th>
                      <th className="py-2 pr-3">Origine</th>
                      <th className="py-2 pr-3">Dimensione</th>
                      <th className="py-2 pr-3">SHA-256</th>
                      <th className="py-2 pr-3">Errore</th>
                      <th className="py-2 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbDumps.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-800">{dumpKindLabelIt(d.kind)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{formatDateTime(d.startedAt)}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              d.status === "completed"
                                ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                                : d.status === "failed"
                                  ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800"
                                  : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
                            }
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{dumpTriggerLabelIt(d.trigger)}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {d.status === "completed" ? formatBytes(d.sizeBytes) : "—"}
                        </td>
                        <td
                          className="max-w-[120px] truncate py-2 pr-3 font-mono text-xs text-slate-500"
                          title={d.sha256 ?? ""}
                        >
                          {d.sha256 ? `${d.sha256.slice(0, 8)}…` : "—"}
                        </td>
                        <td className="max-w-[180px] truncate py-2 pr-3 text-xs text-red-600" title={d.errorMessage ?? ""}>
                          {d.errorMessage ?? "—"}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              aria-label="Scarica dump"
                              className="text-slate-700"
                              disabled={d.status !== "completed" || downloadingDumpId === d.id}
                              onClick={() => void handleDownloadDatabaseDump(d)}
                              title={
                                d.status === "completed"
                                  ? "Scarica l'archivio pg_dump (.dump)"
                                  : "Disponibile solo per dump completati"
                              }
                            >
                              <Download
                                size={16}
                                className={downloadingDumpId === d.id ? "animate-pulse" : ""}
                                aria-hidden
                              />
                              <span className="hidden sm:inline sm:ml-1.5">
                                {downloadingDumpId === d.id ? "Scaricamento…" : "Scarica"}
                              </span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              aria-label="Elimina dump"
                              className="text-slate-700 hover:bg-slate-100"
                              disabled={d.status === "running" || deletingDumpId === d.id}
                              onClick={() => void handleDeleteDatabaseDump(d)}
                              title={
                                d.status === "running"
                                  ? "Attendi il completamento del dump"
                                  : "Elimina dump e file"
                              }
                            >
                              <Trash2 size={16} className={deletingDumpId === d.id ? "opacity-50" : ""} aria-hidden />
                              <span className="hidden sm:inline sm:ml-1.5">Elimina</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      )}

      {restoreRow && (
        <div
          className={modalBackdropClass}
          role="presentation"
          onClick={() => !restoring && setRestoreRow(null)}
        >
          <div
            className={`${modalPanelClass} max-h-[min(90vh,720px)] w-full max-w-xl overflow-hidden shadow-2xl`}
            role="dialog"
            aria-modal
            aria-labelledby="restore-backup-title"
            aria-describedby="restore-backup-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
              <div className="flex min-w-0 gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 ring-1 ring-red-200/80"
                  aria-hidden
                >
                  <AlertTriangle className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2
                    id="restore-backup-title"
                    className="text-lg font-semibold tracking-tight text-slate-900"
                  >
                    Ripristino da backup
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    Operazione irreversibile sui dati operativi del tenant
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={restoring}
                onClick={() => setRestoreRow(null)}
                className="shrink-0 rounded-xl text-slate-600 hover:bg-slate-100"
              >
                Chiudi
              </Button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              <div
                id="restore-backup-desc"
                className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/40 px-4 py-3.5 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-900/5"
              >
                <p className="font-semibold text-amber-950">Cosa succede se confermi</p>
                <p className="mt-1.5 text-amber-900/95">
                  Tutti i dati operativi attuali del tenant (clienti, commesse, interventi, pagamenti,
                  documenti, utenti tenant, log collegati, ecc.) verranno{" "}
                  <span className="font-semibold">sostituiti</span> con lo snapshot salvato in questo
                  backup. Il record tenant (slug, fatturazione piattaforma) non viene eliminato.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 ring-1 ring-slate-900/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Backup selezionato
                </p>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Tenant</dt>
                      <dd className="font-medium text-slate-900">
                        {restoreRow.tenantDisplayName ?? restoreRow.tenantSlug}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Hash className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Slug (serve per confermare)</dt>
                      <dd>
                        <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
                          {restoreRow.tenantSlug}
                        </span>
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Data/ora backup</dt>
                      <dd className="font-medium text-slate-800">{formatDateTime(restoreRow.startedAt)}</dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="space-y-2">
                <label htmlFor="restore-confirm-slug" className="text-sm font-medium text-slate-800">
                  Conferma digitando lo slug esatto
                </label>
                <input
                  id="restore-confirm-slug"
                  className={inputFieldClass}
                  placeholder={restoreRow.tenantSlug}
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={restoring}
                />
                <p className="text-xs text-slate-500">
                  Deve coincidere carattere per carattere con{" "}
                  <span className="font-mono font-medium text-slate-700">{restoreRow.tenantSlug}</span>.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200/90 bg-slate-50/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                type="button"
                variant="outline"
                disabled={restoring}
                onClick={() => setRestoreRow(null)}
                className="w-full font-medium sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={restoring || confirmSlug.trim() !== restoreRow.tenantSlug}
                onClick={() => void handleRestore()}
                className="w-full font-semibold shadow-sm sm:w-auto"
              >
                {restoring ? "Ripristino in corso…" : "Conferma ripristino"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
