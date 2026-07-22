// src/pages/backoffice/Home.tsx
import { Button } from "@/components/ui/Button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJobsListRefresh } from "@/hooks/useJobsListRefresh";
import {
  Loader2,
  RefreshCw,
  Calendar,
  Users,
  MapPin,
  Filter,
  ArrowDownUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { jobAPI } from "../../api/jobs";
import { jobOrderAPI } from "../../api/jobOrders";
import { customerAPI } from "../../api/customers";
import { workerAPI } from "../../api/workers";

import type { Job, JobOrder, Customer, Worker, JobTitle } from "../../types";
import {
  STATUS_CONFIG,
  getJobDisplayStatus,
  matchesJobStatusFilter,
} from "@/config/statusConfig";
import { JOB_TITLE_SELECT_OPTIONS } from "@/config/jobTitles";
import { formatDateTime, toTimestamp } from "@/utils/date";
import { jobMatchesListSearch } from "@/utils/listSearch";
import {
  PageHeader,
  filterBarClass,
  inputFieldClass,
  selectFieldClass,
  surfaceCardClass,
} from "@/components/layout/PageChrome";
import { ListSearchStatus } from "@/components/layout/ListSearchStatus";
import { MobileJobCard } from "@/components/dashboard/MobileJobCard";
import { STATUS_ACCENT } from "@/components/dashboard/statusAccent";

const JOB_BASE_PATH = "/backoffice/jobs";

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  // Filtri
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Job["status"] | "all">("all");
  const [titleFilter, setTitleFilter] = useState<JobTitle | "all">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const navigate = useNavigate();

  const loadAll = useCallback(async (isRefresh = false) => {
    if (!hasLoadedRef.current) setLoading(true);

    try {
      const cacheOpts = {
        cache: true as const,
        forceFresh: isRefresh,
        revalidate: !isRefresh && hasLoadedRef.current,
      };

      const [j, o, c, w] = await Promise.all([
        jobAPI.list({
          ...cacheOpts,
          onRevalidated: (fresh) => setJobs(fresh),
        }),
        jobOrderAPI.list(cacheOpts),
        customerAPI.list(cacheOpts),
        workerAPI.list({
          cache: true,
          revalidate: cacheOpts.revalidate,
        }),
      ]);
      setJobs(j);
      setOrders(o);
      setCustomers(c);
      setWorkers(w);
      hasLoadedRef.current = true;
    } catch (e: unknown) {
      console.error("Errore caricamento lavori:", e);
      const message =
        e instanceof Error ? e.message : "Errore durante il caricamento dei lavori ❌";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (status !== "all") {
      void loadAll(true);
    }
  }, [status, loadAll]);

  useJobsListRefresh(() => void loadAll(true), { intervalMs: 120_000 });

  const getOrder = useCallback(
    (job: Job) => orders.find((o) => o.id === job.jobOrderId),
    [orders]
  );
  const getCustomer = useCallback(
    (job: Job) => {
      const order = orders.find((o) => o.id === job.jobOrderId);
      return customers.find((c) => c.id === order?.customerId);
    },
    [orders, customers]
  );

  const getWorkersNames = (job: Job) => {
    if (job.team?.length) return job.team.map((t) => t.name).join(", ");
    if (job.assignedWorkers?.length) {
      return workers
        .filter((w) => job.assignedWorkers?.includes(w.id))
        .map((w) => w.name)
        .join(", ");
    }
    return "—";
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let res = jobs.map((j) => {
      const persisted = j.persistedStatus ?? j.status;
      const displayStatus = getJobDisplayStatus(persisted, j.plannedDate);
      return {
        ...j,
        persistedStatus: persisted,
        status: displayStatus,
        effectiveStatus: displayStatus,
      };
    });

    if (status !== "all") {
      res = res.filter((j) =>
        matchesJobStatusFilter(j.persistedStatus ?? j.status, j.effectiveStatus, status)
      );
    }

    if (titleFilter !== "all") {
      res = res.filter((j) => j.title === titleFilter);
    }

    if (ql) {
      res = res.filter((j) =>
        jobMatchesListSearch(j, getOrder(j), getCustomer(j), ql, workers)
      );
    }

    res.sort((a, b) => {
      const aTime = toTimestamp(a.plannedDate);
      const bTime = toTimestamp(b.plannedDate);
      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    return res;
  }, [jobs, status, titleFilter, q, sortOrder, getOrder, getCustomer, workers]);

  const jobsAfterStatus = useMemo(() => {
    if (status === "all") return jobs;
    return jobs.filter((j) => {
      const persisted = j.persistedStatus ?? j.status;
      const displayStatus = getJobDisplayStatus(persisted, j.plannedDate);
      return matchesJobStatusFilter(persisted, displayStatus, status);
    });
  }, [jobs, status]);

  const jobsBeforeSearch = useMemo(() => {
    if (titleFilter === "all") return jobsAfterStatus;
    return jobsAfterStatus.filter((j) => j.title === titleFilter);
  }, [jobsAfterStatus, titleFilter]);

  const searchActive = Boolean(q.trim());
  const filtersActive =
    searchActive || titleFilter !== "all" || status !== "all";

  const resetFilters = () => {
    setQ("");
    setTitleFilter("all");
    setStatus("all");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lavori"
        description="Elenco da database. Il filtro «Da completare» usa lo stato salvato al checkout o in «Modifica stato»."
      />

      <div className={`space-y-3 ${filterBarClass}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
        <input
          type="search"
          placeholder="Cerca cliente, commessa, montatore, città, indirizzo, telefono, note…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputFieldClass} min-w-0 flex-1`}
        />
        {filtersActive ? (
          <Button
            type="button"
            variant="outline"
            onClick={resetFilters}
            className="shrink-0 px-3 py-2.5 text-sm"
          >
            Azzera filtri
          </Button>
        ) : null}
        </div>

        <select
          value={titleFilter}
          onChange={(e) =>
            setTitleFilter(e.target.value as JobTitle | "all")
          }
          className={selectFieldClass}
          title="Filtra per tipologia intervento"
        >
          <option value="all">Tutte le tipologie</option>
          {JOB_TITLE_SELECT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Filtro stato */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Filter size={16} />
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Job["status"] | "all")}
            className={`${selectFieldClass} w-full pl-9`}
            title="Filtra per stato"
          >
            <option value="all">Tutti gli stati</option>
            {(
              [
                "in_attesa_programmazione",
                "assegnato",
                "in_corso",
                "in_ritardo",
                "da_completare",
                "completato",
                "annullato",
              ] as Job["status"][]
            ).map((key) => {
              const cfg = STATUS_CONFIG[key];
              return (
                <option key={key} value={key}>
                  {cfg?.icon} {cfg?.label ?? key}
                </option>
              );
            })}
          </select>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
          }
          className="flex items-center justify-center gap-2 px-3 py-2.5"
        >
          <ArrowDownUp size={16} />
          {sortOrder === "asc" ? "Data ↑" : "Data ↓"}
        </Button>

        <div className="flex sm:col-span-2 lg:col-span-1 md:justify-end">
          <Button
            type="button"
            variant="outline"
            className="inline-flex w-full items-center justify-center gap-2 px-3 py-2.5 md:w-auto"
            onClick={() => void loadAll(true)}
          >
            <RefreshCw size={16} /> Aggiorna
          </Button>
        </div>
        </div>
        <ListSearchStatus
          loading={loading && !hasLoadedRef.current}
          filteredCount={filtered.length}
          totalCount={
            searchActive
              ? jobsBeforeSearch.length
              : titleFilter !== "all"
                ? jobsAfterStatus.length
                : status !== "all"
                  ? jobs.length
                  : filtered.length
          }
          itemSingular="lavoro"
          itemPlural="lavori"
          isSearchActive={searchActive}
          isNarrowed={filtersActive}
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading && !hasLoadedRef.current && (
          <div
            className={`p-6 text-center text-slate-500 ${surfaceCardClass}`}
          >
            <Loader2 className="inline animate-spin" size={16} /> Caricamento…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div
            className={`p-6 text-center text-slate-500 ${surfaceCardClass}`}
          >
            Nessun lavoro trovato
          </div>
        )}
        {!loading &&
          filtered.map((job) => {
            const order = getOrder(job);
            const customer = getCustomer(job);
                        const meta = [
              {
                icon: <Calendar size={14} />,
                text: formatDateTime(job.plannedDate) ?? "—",
              },
              {
                icon: <Users size={14} />,
                text: getWorkersNames(job),
              },
            ];
            if (order?.location?.address) {
              meta.push({
                icon: <MapPin size={14} />,
                text: order.location.address,
              });
            }
            return (
              <MobileJobCard
                key={job.id}
                to={`${JOB_BASE_PATH}/${job.id}`}
                title={customer?.name ?? "—"}
                subtitle={`Commessa ${order?.code ?? "—"}`}
                status={job.effectiveStatus}
                accent={STATUS_ACCENT[job.effectiveStatus]}
                meta={meta}
              />
            );
          })}
      </div>

      {/* Desktop tabella */}
      <div className={`hidden overflow-auto md:block ${surfaceCardClass}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-left">
            <tr className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Commessa</th>
              <th className="px-3 py-2">Data/Ora</th>
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2">Montatori</th>
              <th className="px-3 py-2">Indirizzo</th>
            </tr>
          </thead>
          <tbody>
            {loading && !hasLoadedRef.current && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  <Loader2 className="animate-spin inline" size={16} />{" "}
                  Caricamento…
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((job) => {
                const order = getOrder(job);
                const customer = getCustomer(job);
                const cfg = STATUS_CONFIG[job.effectiveStatus];
                return (
                  <tr
                    key={job.id}
                    className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                    onClick={() => navigate(`${JOB_BASE_PATH}/${job.id}`)}
                  >
                    <td className="px-3 py-3">{customer?.name ?? "—"}</td>
                    <td className="px-3 py-3">{order?.code ?? "—"}</td>
                    <td className="px-3 py-3">
                      {formatDateTime(job.plannedDate) ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${cfg?.color}`}
                      >
                        {cfg?.icon} {cfg?.label ?? job.effectiveStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3">{getWorkersNames(job)}</td>
                    <td className="px-3 py-3">
                      <span className="block truncate max-w-[380px]">
                        {order?.location?.address ?? "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  Nessun lavoro trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
