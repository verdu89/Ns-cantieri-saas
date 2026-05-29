// src/pages/JobAgenda.tsx
import { Button } from "@/components/ui/Button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  User as UserIcon,
  Users,
} from "lucide-react";
import { KpiSummaryStrip } from "@/components/dashboard/KpiSummaryStrip";
import { MobileJobCard } from "@/components/dashboard/MobileJobCard";
import { STATUS_ACCENT } from "@/components/dashboard/statusAccent";
import { Link } from "react-router-dom";
import { jobAPI } from "@/api/jobs";
import {
  attachTeamToJobs,
  resolveWorkersForJobs,
} from "@/lib/resolveJobTeam";
import { useJobsListRefresh } from "@/hooks/useJobsListRefresh";
import type { Job, User } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { STATUS_CONFIG, getJobDisplayStatus } from "@/config/statusConfig";
import { jobTitleLabel } from "@/config/jobTitles";
import { toast } from "react-hot-toast";
import {
  addDays,
  getMonday,
  stripTime,
  toLocalISODate,
  formatWeekRange,
  formatTime,
} from "@/utils/date";

const STATUSES = Object.keys(STATUS_CONFIG) as Job["status"][];

function weekDescriptor(weekStart: Date): string {
  const thisMonday = getMonday(new Date());
  const diffDays = Math.round(
    (stripTime(weekStart).getTime() - stripTime(thisMonday).getTime()) /
      86400000
  );
  const w = Math.round(diffDays / 7);
  if (w === 0) return "Settimana corrente";
  if (w === 1) return "Prossima settimana";
  if (w === -1) return "Settimana precedente";
  if (w > 1) return `Tra ${w} settimane`;
  if (w < -1) return `${-w} settimane fa`;
  return "";
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/* ========= Agenda ========= */
export default function Agenda() {
  const { user } = useAuth() as { user: User | null };

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const days = useMemo(() => {
    const monFri = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
    const saturday = addDays(weekStart, 5);
    const sunday = addDays(weekStart, 6);

    const jobOnDay = (j: Job, day: Date) => {
      if (!j.plannedDate || j.status === "annullato") return false;
      return toLocalISODate(new Date(j.plannedDate)) === toLocalISODate(day);
    };

    const showSat = jobs.some((j) => jobOnDay(j, saturday));
    const showSun = jobs.some((j) => jobOnDay(j, sunday));
    const extra: Date[] = [];
    if (showSat) extra.push(saturday);
    if (showSun) extra.push(sunday);
    return [...monFri, ...extra];
  }, [weekStart, jobs]);

  const applyJobsData = useCallback(
    async (raw: Job[]) => {
      const workersById = await resolveWorkersForJobs(raw, user);
      const jobsWithTeam = attachTeamToJobs(raw, workersById);
      const syncedJobs = jobsWithTeam.map((job) => {
        const persisted = job.persistedStatus ?? job.status;
        const display = getJobDisplayStatus(persisted, job.plannedDate);
        return { ...job, persistedStatus: persisted, status: display };
      });
      setJobs(syncedJobs as Job[]);
      hasLoadedRef.current = true;
    },
    [user]
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else if (!hasLoadedRef.current) setLoading(true);

      try {
        const listOpts = {
          cache: true,
          forceFresh: isRefresh,
          revalidate: !isRefresh && hasLoadedRef.current,
          onRevalidated: (j: Job[]) => void applyJobsData(j),
        };

        const j =
          user?.role === "worker" && user.workerId
            ? await jobAPI.listAssigned(String(user.workerId), listOpts)
            : await jobAPI.list(listOpts);

        await applyJobsData(j);
      } catch (err) {
        console.error("Errore caricando lavori:", err);
        toast.error("Errore durante il caricamento dei lavori.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, applyJobsData]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useJobsListRefresh(() => void load(true), { intervalMs: 90_000 });

  const jobsByDay = useMemo(() => {
    const m = new Map<string, Job[]>();
    const keys = new Set<string>();
    for (const d of days) {
      const k = toLocalISODate(d);
      keys.add(k);
      m.set(k, []);
    }
    jobs.forEach((j) => {
      if (!j.plannedDate || j.status === "annullato") return;
      const key = toLocalISODate(new Date(j.plannedDate));
      if (!keys.has(key)) return;
      m.get(key)!.push(j);
    });
    for (const d of days) {
      m.get(toLocalISODate(d))!.sort((a, b) =>
        (a.plannedDate || "").localeCompare(b.plannedDate || "")
      );
    }
    return m;
  }, [jobs, days]);

  const kpi = useMemo(() => {
    const counts: Record<Job["status"], number> = {} as Record<
      Job["status"],
      number
    >;
    STATUSES.forEach((s) => (counts[s] = 0));
    for (const [, arr] of jobsByDay) {
      arr.forEach((j) => {
        const persisted = j.persistedStatus ?? j.status;
        const effective = getJobDisplayStatus(persisted, j.plannedDate);
        counts[effective] = (counts[effective] ?? 0) + 1;
      });
    }
    return counts;
  }, [jobsByDay]);

  const weekJobTotal = useMemo(
    () => STATUSES.reduce((acc, s) => acc + (kpi[s] ?? 0), 0),
    [kpi]
  );

  const weekHint = weekDescriptor(weekStart);
  const lastDay = days[days.length - 1];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toolbar settimana */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Agenda
            </h1>
            <p className="mt-0.5 text-sm font-medium text-slate-700">
              {formatWeekRange(weekStart, lastDay)}
            </p>
            {weekHint ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                {weekHint}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-xl p-0 text-slate-700 hover:bg-slate-100"
                onClick={() => setWeekStart((d) => addDays(d, -7))}
                aria-label="Settimana precedente"
              >
                <ChevronLeft size={20} />
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-xl px-4 text-sm font-medium text-slate-800 hover:bg-slate-100"
                onClick={() => setWeekStart(getMonday(new Date()))}
              >
                Oggi
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-xl p-0 text-slate-700 hover:bg-slate-100"
                onClick={() => setWeekStart((d) => addDays(d, 7))}
                aria-label="Settimana successiva"
              >
                <ChevronRight size={20} />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 text-sm font-medium"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {refreshing ? "Aggiornamento…" : "Aggiorna"}
            </Button>
          </div>
        </div>
      </div>

      {loading && !hasLoadedRef.current ? (
        <AgendaSkeleton columnCount={days.length} />
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <CalendarDays
            className="mb-3 text-slate-300"
            size={48}
            strokeWidth={1.25}
          />
          <p className="text-base font-medium text-slate-700">
            Nessun lavoro in agenda
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Non risultano interventi pianificati. Quando verranno creati,
            compariranno qui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:gap-6">
          <KpiSummaryStrip
            total={weekJobTotal}
            counts={kpi}
            statuses={STATUSES}
            className="order-1 md:order-3"
          />

          <div className="order-2 block space-y-3 md:hidden">
            {days.map((d) => (
              <DayCard
                key={d.toISOString()}
                d={d}
                list={jobsByDay.get(toLocalISODate(d)) ?? []}
                isToday={toLocalISODate(d) === toLocalISODate(new Date())}
                isWeekend={d.getDay() === 0 || d.getDay() === 6}
                userRole={user?.role}
                compact
              />
            ))}
          </div>
          <div
            className="order-2 hidden gap-4 md:grid"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            {days.map((d) => (
              <DayCard
                key={d.toISOString()}
                d={d}
                list={jobsByDay.get(toLocalISODate(d)) ?? []}
                isToday={toLocalISODate(d) === toLocalISODate(new Date())}
                isWeekend={d.getDay() === 0 || d.getDay() === 6}
                userRole={user?.role}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ========= Skeleton ========= */
function AgendaSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <>
      <div
        className="hidden md:grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: columnCount }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="h-14 animate-pulse bg-slate-100" />
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
    </>
  );
}

/* ========= DayCard ========= */
function DayCard({
  d,
  list,
  isToday,
  isWeekend,
  userRole,
  compact = false,
}: {
  d: Date;
  list: Job[];
  isToday: boolean;
  isWeekend?: boolean;
  userRole?: string;
  compact?: boolean;
}) {
  const dayNum = d.getDate();
  const weekdayShort = d
    .toLocaleDateString("it-IT", { weekday: "short" })
    .replace(/\.$/, "");

  return (
    <div
      className={`flex flex-col overflow-hidden border bg-white shadow-sm ring-1 ring-slate-900/5 ${
        compact ? "min-h-0 rounded-2xl" : "min-h-[280px] rounded-xl"
      } ${
        isToday ? "border-brand/50 ring-2 ring-brand/25" : "border-slate-200/90"
      } ${isWeekend ? "border-amber-200/90" : ""}`}
    >
      <div
        className={`flex items-start justify-between gap-2 border-b ${
          compact ? "px-3 py-2.5" : "px-3 py-3"
        } ${
          isWeekend
            ? "border-amber-100/80 bg-amber-50/80"
            : "border-slate-100 bg-slate-50/80"
        }`}
      >
        <div className={`flex min-w-0 items-start ${compact ? "gap-2.5" : "gap-3"}`}>
          <div
            className={`flex shrink-0 flex-col items-center justify-center rounded-lg text-center ${
              compact ? "h-10 w-10" : "h-12 w-12"
            } ${
              isToday
                ? "bg-brand text-white shadow-sm"
                : "bg-white text-slate-800 ring-1 ring-slate-200/80"
            }`}
          >
            <span
              className={`font-bold leading-none tabular-nums ${
                compact ? "text-base" : "text-lg"
              }`}
            >
              {dayNum}
            </span>
            <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide opacity-90">
              {weekdayShort}
            </span>
          </div>
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold capitalize text-slate-800">
                {d.toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "short",
                })}
              </span>
              {isToday && (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                  Oggi
                </span>
              )}
              {isWeekend && !isToday && (
                <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-medium text-amber-900/80">
                  Weekend
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {list.length}{" "}
              {list.length === 1 ? "intervento" : "interventi"}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`flex flex-col gap-2.5 bg-slate-50/40 ${
          compact ? "p-2.5" : "flex-1 p-2 sm:p-3"
        }`}
      >
        {list.length === 0 && (
          <div
            className={`flex items-center justify-center rounded-xl border border-dashed border-slate-200/80 text-center text-xs text-slate-400 ${
              compact ? "py-6" : "flex-1 py-8"
            }`}
          >
            Nessun lavoro
          </div>
        )}
        {list.map((j) => {
          const linkTo =
            userRole === "admin" || userRole === "backoffice"
              ? `/backoffice/jobs/${encodeURIComponent(j.id)}`
              : `/jobs/${encodeURIComponent(j.id)}`;

          const effective = getJobDisplayStatus(
            j.persistedStatus ?? j.status,
            j.plannedDate
          );
          const cfg = STATUS_CONFIG[effective];
          const accent = STATUS_ACCENT[effective] ?? "border-l-slate-400";

          const team = j.team ?? [];
          const maxAv = 3;
          const extra = team.length > maxAv ? team.length - maxAv : 0;

          if (compact) {
            const meta = [
              {
                icon: <Clock size={14} />,
                text: formatTime(j.plannedDate),
              },
            ];
            if (j.customer?.name) {
              meta.push({
                icon: <UserIcon size={14} />,
                text: j.customer.name,
              });
            }
            if (team.length > 0) {
              meta.push({
                icon: <Users size={14} />,
                text:
                  team
                    .map((m) => m.name)
                    .filter(Boolean)
                    .join(", ") + (extra > 0 ? ` +${extra}` : ""),
              });
            }
            return (
              <MobileJobCard
                key={j.id}
                to={linkTo}
                title={jobTitleLabel(j.title)}
                status={effective}
                accent={accent}
                meta={meta}
              />
            );
          }

          return (
            <Link
              key={j.id}
              to={linkTo}
              className={`group block rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-3 ${accent} border-l-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-900 group-hover:text-brand"
                  title={jobTitleLabel(j.title)}
                >
                  {jobTitleLabel(j.title)}
                </p>
                <span
                  className={`max-w-[42%] shrink-0 truncate text-[10px] px-2 py-0.5 font-medium rounded-full border ${cfg?.color}`}
                >
                  {cfg?.label ?? effective}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold tabular-nums text-slate-800">
                  {formatTime(j.plannedDate)}
                </span>
                {j.customer?.name ? (
                  <span className="inline-flex min-w-0 items-center gap-1 text-slate-600">
                    <UserIcon size={12} className="shrink-0 opacity-60" />
                    <span className="truncate">{j.customer.name}</span>
                  </span>
                ) : null}
              </div>
              {team.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {team.slice(0, maxAv).map((m) => (
                    <span
                      key={m.id}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-700"
                      title={m.name}
                    >
                      {initials(m.name || "?")}
                    </span>
                  ))}
                  {extra > 0 ? (
                    <span className="text-[10px] font-semibold text-slate-500">
                      +{extra}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
