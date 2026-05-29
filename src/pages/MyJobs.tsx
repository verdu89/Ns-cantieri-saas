// src/pages/MyJobs.tsx
import { Button } from "@/components/ui/Button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jobAPI } from "../api/jobs";
import { Calendar, Loader2, ArrowDownUp, User } from "lucide-react";
import { MobileJobCard } from "@/components/dashboard/MobileJobCard";
import { STATUS_ACCENT } from "@/components/dashboard/statusAccent";
import { useAuth } from "../context/AuthContext";
import type { Job } from "../types";
import {
  STATUS_CONFIG,
  getJobDisplayStatus,
  matchesJobStatusFilter,
} from "@/config/statusConfig";
import { jobTitleDisplay } from "@/config/jobTitles";
import { toTimestamp, formatDateTime, toLocalISODate } from "@/utils/date";
import {
  PageHeader,
  filterBarClass,
  inputFieldClass,
  selectFieldClass,
} from "@/components/layout/PageChrome";
import { useJobsListRefresh } from "@/hooks/useJobsListRefresh";

export default function MyJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [filterStatus, setFilterStatus] = useState<Job["status"] | "all">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const load = useCallback(
    async (isRefresh = false) => {
      if (!hasLoadedRef.current) setLoading(true);

      try {
        const listOpts = {
          cache: true,
          forceFresh: isRefresh,
          revalidate: !isRefresh && hasLoadedRef.current,
          onRevalidated: (all: Job[]) => {
            setJobs(all);
            hasLoadedRef.current = true;
          },
        };

        let all: Job[] = [];
        if (user?.role === "worker" && user.workerId) {
          all = await jobAPI.listAssigned(user.workerId, listOpts);
        } else {
          all = await jobAPI.list(listOpts);
        }

        setJobs(all);
        hasLoadedRef.current = true;
      } catch (e) {
        console.error("Errore caricamento lavori:", e);
        if (!hasLoadedRef.current) setJobs([]);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useJobsListRefresh(() => void load(true), { intervalMs: 90_000 });

  const filteredJobs = useMemo(() => {
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

    if (filterStatus !== "all") {
      res = res.filter((j) =>
        matchesJobStatusFilter(
          j.persistedStatus ?? j.status,
          j.effectiveStatus,
          filterStatus
        )
      );
    }

    if (dateFilter === "today") {
      const today = toLocalISODate(new Date());
      res = res.filter(
        (j) => j.plannedDate && toLocalISODate(new Date(j.plannedDate)) === today
      );
    } else if (dateFilter === "week") {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      res = res.filter((j) => {
        if (!j.plannedDate) return false;
        const t = toTimestamp(j.plannedDate);
        return t >= start.getTime() && t <= end.getTime();
      });
    }

    const ql = search.trim().toLowerCase();
    if (ql) {
      res = res.filter(
        (j) =>
          jobTitleDisplay(j.title).toLowerCase().includes(ql) ||
          j.customer?.name?.toLowerCase().includes(ql) ||
          j.id.toLowerCase().includes(ql)
      );
    }

    res.sort((a, b) => {
      const aTime = toTimestamp(a.plannedDate);
      const bTime = toTimestamp(b.plannedDate);
      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    return res;
  }, [jobs, filterStatus, search, dateFilter, sortOrder]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={user?.role === "worker" ? "I miei lavori" : "Tutti i lavori"}
        description="Elenco interventi assegnati, filtri e accesso al dettaglio."
      />

      <div
        className={`${filterBarClass} grid grid-cols-1 gap-3`}
      >
        <input
          type="search"
          placeholder="Cerca per titolo, cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputFieldClass}
        />
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as Job["status"] | "all")
          }
          className={selectFieldClass}
        >
          <option value="all">Tutti gli stati</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) =>
            setDateFilter(e.target.value as "all" | "today" | "week")
          }
          className={selectFieldClass}
        >
          <option value="all">Tutte le date</option>
          <option value="today">Oggi</option>
          <option value="week">Questa settimana</option>
        </select>
        <Button
          type="button"
          variant="ghost"
          className="gap-2"
          onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
        >
          <ArrowDownUp size={16} />
          Data {sortOrder === "asc" ? "↑" : "↓"}
        </Button>
      </div>

      {loading && !hasLoadedRef.current ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : filteredJobs.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">
          Nessun lavoro trovato
        </p>
      ) : (
        <ul className="space-y-3 md:max-w-none">
          {filteredJobs.map((job) => {
            const meta = [
              {
                icon: <Calendar size={14} />,
                text: formatDateTime(job.plannedDate) ?? "Data da definire",
              },
            ];
            if (job.customer?.name) {
              meta.push({
                icon: <User size={14} />,
                text: job.customer.name,
              });
            }
            return (
              <li key={job.id}>
                <MobileJobCard
                  to={`/jobs/${job.id}`}
                  title={jobTitleDisplay(job.title)}
                  subtitle={job.customer?.name}
                  status={job.effectiveStatus}
                  accent={STATUS_ACCENT[job.effectiveStatus]}
                  meta={meta}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
