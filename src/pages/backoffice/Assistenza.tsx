import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  RefreshCw,
  PhoneCall,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

import { assistenzaAPI, type AssistenzaSummary } from "@/api/assistenza";
import { workerAPI } from "@/api/workers";
import type { Job, Worker } from "@/types";
import { getJobDisplayStatus } from "@/config/statusConfig";
import type { AssistenzaListFilter } from "@/config/assistenzaConfig";
import { formatDateTime } from "@/utils/date";
import {
  PageHeader,
  filterBarClass,
  inputFieldClass,
  mobileCardListClass,
  selectFieldClass,
  surfaceCardClass,
  tableWrapperClass,
} from "@/components/layout/PageChrome";
import { ListSearchStatus } from "@/components/layout/ListSearchStatus";
import { Button } from "@/components/ui/Button";
import { AssistenzaBadges } from "@/components/assistenza/AssistenzaBadges";
import { RegisterFollowUpModal } from "@/components/assistenza/RegisterFollowUpModal";
import { useJobsListRefresh } from "@/hooks/useJobsListRefresh";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

const JOB_BASE = "/backoffice/jobs";
const PAGE_SIZE = 50;

function KpiCard({
  label,
  value,
  active,
  onClick,
  accent,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[72px] rounded-xl border p-4 text-left transition-shadow hover:shadow-md active:scale-[0.99] ${
        active ? "border-brand ring-2 ring-brand/30" : "border-slate-200"
      } ${accent ?? "bg-white"}`}
    >
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-600">{label}</div>
    </button>
  );
}

export default function Assistenza() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<AssistenzaSummary | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalUnfiltered, setTotalUnfiltered] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const hasLoadedRef = useRef(false);

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 400);
  const [listFilter, setListFilter] = useState<AssistenzaListFilter>("open");
  const [followUpJob, setFollowUpJob] = useState<Job | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await assistenzaAPI.listPaginated(
        listFilter,
        debouncedQ,
        page,
        PAGE_SIZE
      );
      const enriched = result.items.map((j) => {
        const persisted = j.persistedStatus ?? j.status;
        return {
          ...j,
          persistedStatus: persisted,
          status: getJobDisplayStatus(persisted, j.plannedDate),
        };
      });
      setJobs(enriched);
      setTotal(result.total);
      if (!debouncedQ) setTotalUnfiltered(result.total);
      setTotalPages(result.totalPages);
      hasLoadedRef.current = true;
    } catch (e) {
      console.error(e);
      toast.error("Errore caricamento lista assistenza");
    } finally {
      setLoading(false);
    }
  }, [listFilter, debouncedQ, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, listFilter]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await assistenzaAPI.summary();
      setSummary(s);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void workerAPI.list({ cache: true }).then(setWorkers);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useJobsListRefresh(() => {
    void loadList();
    void loadSummary();
  }, { intervalMs: 120_000 });

  const workerNames = useCallback(
    (job: Job) => {
      if (!job.assignedWorkers?.length) return "—";
      return workers
        .filter((w) => job.assignedWorkers.includes(w.id))
        .map((w) => w.name)
        .join(", ");
    },
    [workers]
  );

  const refreshAll = () => {
    void loadList();
    void loadSummary();
  };

  const openJobDetail = useCallback(
    (jobId: string) => {
      navigate(`${JOB_BASE}/${jobId}`);
    },
    [navigate]
  );

  const paginationLabel = useMemo(() => {
    if (total === 0) return "Nessun risultato";
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    return `${from}–${to} di ${total}`;
  }, [page, total]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assistenza post-vendita"
        description="Interventi tecnici in ufficio. Cerca cliente, telefono o commessa nel campo sotto; clic sulla riga per il dettaglio."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/backoffice/newjob?title=assistenza"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <Plus size={16} /> Nuovo intervento
            </Link>
            <Button type="button" variant="outline" onClick={refreshAll}>
              <RefreshCw size={16} /> Aggiorna
            </Button>
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Aperti"
            value={summary.totalOpen}
            active={listFilter === "open"}
            onClick={() => {
              setListFilter("open");
              setPage(1);
            }}
          />
          <KpiCard
            label="Urgenti"
            value={summary.urgent}
            active={listFilter === "urgent"}
            onClick={() => {
              setListFilter("urgent");
              setPage(1);
            }}
            accent="bg-red-50"
          />
          <KpiCard
            label="Sollecitati"
            value={summary.sollecitati}
            active={listFilter === "sollecitati"}
            onClick={() => {
              setListFilter("sollecitati");
              setPage(1);
            }}
            accent="bg-violet-50"
          />
          <KpiCard
            label="Da programmare"
            value={summary.byStatus.in_attesa_programmazione}
            active={listFilter === "in_attesa_programmazione"}
            onClick={() => {
              setListFilter("in_attesa_programmazione");
              setPage(1);
            }}
          />
          <KpiCard
            label="Assegnati"
            value={summary.byStatus.assegnato}
            active={listFilter === "assegnato"}
            onClick={() => {
              setListFilter("assegnato");
              setPage(1);
            }}
          />
          <KpiCard
            label="Da completare"
            value={summary.byStatus.da_completare}
            active={listFilter === "da_completare"}
            onClick={() => {
              setListFilter("da_completare");
              setPage(1);
            }}
          />
        </div>
      )}

      <div className={`space-y-3 ${filterBarClass}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Cerca cliente, telefono, città, indirizzo, commessa, note…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`${inputFieldClass} min-w-0 flex-1`}
              aria-label="Cerca nella lista assistenza"
            />
            {q.trim() ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setQ("")}
                className="shrink-0 px-3 py-2.5 text-sm"
              >
                Azzera
              </Button>
            ) : null}
          </div>
          <select
            value={listFilter}
            onChange={(e) => {
              setListFilter(e.target.value as AssistenzaListFilter);
              setPage(1);
            }}
            className={selectFieldClass}
          >
            <option value="open">Solo aperti</option>
            <option value="all">Tutti (anche chiusi)</option>
            <option value="urgent">Urgenti</option>
            <option value="sollecitati">Sollecitati</option>
            <option value="in_attesa_programmazione">Da programmare</option>
            <option value="assegnato">Assegnati</option>
            <option value="in_corso">In corso</option>
            <option value="da_completare">Da completare</option>
          </select>
        </div>
        <ListSearchStatus
          loading={loading}
          filteredCount={total}
          totalCount={totalUnfiltered || total}
          itemSingular="intervento"
          itemPlural="interventi"
          isSearchActive={Boolean(debouncedQ)}
          isNarrowed={Boolean(debouncedQ)}
        />
        {total > 0 ? (
          <p className="text-xs text-slate-500">{paginationLabel}</p>
        ) : null}
      </div>

      <div className={mobileCardListClass}>
        {loading && !hasLoadedRef.current && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            <Loader2 className="inline animate-spin" size={18} /> Caricamento…
          </p>
        )}
        {!loading && jobs.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Nessun intervento assistenza in questo filtro.
          </p>
        )}
        {jobs.map((job) => (
          <div
            key={job.id}
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5"
          >
            <button
              type="button"
              className="w-full p-3.5 text-left active:bg-orange-50/40"
              onClick={() => openJobDetail(job.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 line-clamp-2">
                    {job.customer?.name ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Commessa {job.orderCode ?? "—"}
                  </p>
                </div>
                <StatusBadge status={job.status} compact className="shrink-0" />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {job.plannedDate ? formatDateTime(job.plannedDate) : "Data da programmare"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AssistenzaBadges job={job} />
              </div>
              <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                Tecnici: {workerNames(job)}
              </p>
            </button>
            <div className="flex justify-end border-t border-slate-100 px-3 py-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 gap-2 px-3"
                onClick={() => setFollowUpJob(job)}
              >
                <PhoneCall size={16} />
                Sollecito
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className={`${tableWrapperClass} ${surfaceCardClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Commessa</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Priorità</th>
                <th className="px-3 py-2">Tecnici</th>
                <th className="px-3 py-2 text-right w-14">Sollecito</th>
              </tr>
            </thead>
            <tbody>
              {loading && !hasLoadedRef.current && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="inline animate-spin" size={18} /> Caricamento…
                  </td>
                </tr>
              )}
              {!loading && jobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nessun intervento assistenza in questo filtro.
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-slate-100 cursor-pointer transition-colors hover:bg-orange-50/60"
                  onClick={() => openJobDetail(job.id)}
                >
                  <td className="px-3 py-2 font-medium">
                    {job.customer?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">{job.orderCode ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {job.plannedDate ? formatDateTime(job.plannedDate) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2">
                    <AssistenzaBadges job={job} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{workerNames(job)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="px-2.5 py-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFollowUpJob(job);
                        }}
                        title="Registra sollecito telefonico"
                      >
                        <PhoneCall size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{paginationLabel}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="px-2.5 py-1.5"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <span>
            Pagina {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            className="px-2.5 py-1.5"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {followUpJob && (
        <RegisterFollowUpModal
          job={followUpJob}
          open={Boolean(followUpJob)}
          onClose={() => setFollowUpJob(null)}
          onSaved={(patch) => {
            setJobs((prev) =>
              prev.map((j) => (j.id === followUpJob.id ? { ...j, ...patch } : j))
            );
            void loadSummary();
            setFollowUpJob(null);
          }}
        />
      )}
    </div>
  );
}
