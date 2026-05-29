import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Briefcase,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportAPI, type ReportPeriodResponse } from "@/api/report";
import { Button } from "@/components/ui/Button";
import { STATUS_CONFIG } from "@/config/statusConfig";
import type { Job } from "@/types";
import {
  PageHeader,
  filterBarClass,
  filterGridClass,
  inputFieldClass,
  mobileCardListClass,
  selectFieldClass,
  surfaceCardClass,
  tableWrapperClass,
} from "@/components/layout/PageChrome";
import { DataCard } from "@/components/layout/DataCard";
import { addDays, formatDate, getMonday } from "@/utils/date";
import { downloadCsvFile } from "@/utils/csvExport";

type PeriodPreset = "week" | "month" | "quarter" | "year" | "custom";

const STATUS_CHART_COLORS: Record<string, string> = {
  in_attesa_programmazione: "#f59e0b",
  assegnato: "#3b82f6",
  in_corso: "#0ea5e9",
  da_completare: "#a855f7",
  completato: "#10b981",
  annullato: "#94a3b8",
  in_ritardo: "#ef4444",
};

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function resolvePeriodRange(
  preset: PeriodPreset,
  weekOffset: number,
  customFrom: string,
  customTo: string
): { from: string; to: string; label: string } {
  const now = new Date();

  if (preset === "custom" && customFrom && customTo) {
    return {
      from: customFrom,
      to: customTo,
      label: `${formatDate(customFrom)} – ${formatDate(customTo)}`,
    };
  }

  if (preset === "week") {
    const monday = addDays(getMonday(now), weekOffset * 7);
    const sunday = addDays(monday, 6);
    return {
      from: toIsoDate(monday),
      to: toIsoDate(sunday),
      label: `Settimana ${formatDate(monday)} – ${formatDate(sunday)}`,
    };
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (preset === "month") {
    start.setDate(1);
    return {
      from: toIsoDate(start),
      to: toIsoDate(end),
      label: `Mese corrente (fino a ${formatDate(end)})`,
    };
  }

  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    start.setMonth(q * 3, 1);
    return {
      from: toIsoDate(start),
      to: toIsoDate(end),
      label: `Trimestre in corso`,
    };
  }

  start.setMonth(0, 1);
  return {
    from: toIsoDate(start),
    to: toIsoDate(end),
    label: `Anno ${now.getFullYear()}`,
  };
}

function statusLabel(status: string) {
  const key = status as Job["status"];
  return STATUS_CONFIG[key]?.label ?? status.replace(/_/g, " ");
}

export default function ReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportPeriodResponse | null>(null);
  const [period, setPeriod] = useState<PeriodPreset>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(
    () => resolvePeriodRange(period, weekOffset, customFrom, customTo),
    [period, weekOffset, customFrom, customTo]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportAPI.period({ from: range.from, to: range.to });
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento report");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals ?? {
    jobs: 0,
    jobsCompleted: 0,
    completionRate: 0,
    orders: 0,
    expected: 0,
    collected: 0,
    residual: 0,
  };

  const statusChart = useMemo(() => {
    return (data?.byStatus ?? [])
      .filter((s) => s.count > 0)
      .map((s) => ({
        key: s.status,
        name: statusLabel(s.status),
        value: s.count,
        fill: STATUS_CHART_COLORS[s.status] ?? "#64748b",
      }));
  }, [data?.byStatus]);

  const workerChart = useMemo(() => {
    return (data?.byWorker ?? [])
      .filter((w) => w.jobs > 0)
      .slice(0, 12)
      .map((w) => ({
        name: w.name.length > 14 ? `${w.name.slice(0, 14)}…` : w.name,
        fullName: w.name,
        jobs: w.jobs,
        completed: w.completed,
      }));
  }, [data?.byWorker]);

  const dayChart = useMemo(() => {
    return (data?.byDay ?? []).map((d) => ({
      ...d,
      label: formatDate(d.date),
    }));
  }, [data?.byDay]);

  const exportOrdersCsv = () => {
    const rows = data?.orders ?? [];
    if (rows.length === 0) {
      toast.error("Nessuna commessa da esportare nel periodo");
      return;
    }
    downloadCsvFile(`report-commesse-${range.from}_${range.to}.csv`, [
      [
        "Cliente",
        "Commessa",
        "Interventi",
        "Completati",
        "Previsto EUR",
        "Incassato EUR",
        "Residuo EUR",
      ],
      ...rows.map((o) => [
        o.customerName ?? "",
        o.code,
        o.jobs,
        o.jobsCompleted,
        o.expected.toFixed(2),
        o.collected.toFixed(2),
        o.residual.toFixed(2),
      ]),
    ]);
    toast.success("CSV scaricato");
  };

  return (
    <main className="space-y-5">
      <PageHeader
        title="Report operativo"
        description={range.label}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {period === "week" ? (
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-9 rounded-xl p-0"
                  aria-label="Settimana precedente"
                  onClick={() => setWeekOffset((o) => o - 1)}
                >
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3 text-xs"
                  onClick={() => setWeekOffset(0)}
                >
                  Questa settimana
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-9 rounded-xl p-0"
                  aria-label="Settimana successiva"
                  disabled={weekOffset >= 0}
                  onClick={() => setWeekOffset((o) => o + 1)}
                >
                  <ChevronRight size={18} />
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Aggiorna
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={exportOrdersCsv}
              disabled={loading || !(data?.orders.length)}
            >
              <Download size={16} />
              CSV commesse
            </Button>
          </div>
        }
      />

      <div className={filterBarClass}>
        <div className={filterGridClass}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Periodo
            </span>
            <select
              className={selectFieldClass}
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as PeriodPreset);
                setWeekOffset(0);
              }}
            >
              <option value="week">Settimana</option>
              <option value="month">Mese corrente</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Anno</option>
              <option value="custom">Date personalizzate</option>
            </select>
          </label>
          {period === "custom" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dal
                </span>
                <input
                  type="date"
                  className={inputFieldClass}
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Al
                </span>
                <input
                  type="date"
                  className={inputFieldClass}
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
            </>
          ) : null}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarRange size={14} />
          Interventi con data programmata nel periodo · pagamenti collegati a quegli interventi
        </p>
      </div>

      <div className={`${surfaceCardClass} p-4`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Caricamento report…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi
              icon={<Briefcase className="text-sky-600" size={18} />}
              label="Interventi"
              value={String(totals.jobs)}
            />
            <Kpi
              icon={<CheckCircle2 className="text-emerald-600" size={18} />}
              label="Completati"
              value={`${totals.jobsCompleted} (${totals.completionRate}%)`}
            />
            <Kpi
              icon={<Users className="text-violet-600" size={18} />}
              label="Commesse attive"
              value={String(totals.orders)}
            />
            <Kpi
              icon={<Wallet className="text-blue-600" size={18} />}
              label="Previsto"
              value={formatCurrency(totals.expected)}
              tone="blue"
            />
            <Kpi
              icon={<Wallet className="text-emerald-600" size={18} />}
              label="Incassato"
              value={formatCurrency(totals.collected)}
              tone="green"
            />
            <Kpi
              icon={<Wallet className="text-red-600" size={18} />}
              label="Residuo"
              value={formatCurrency(totals.residual)}
              tone={totals.residual > 0 ? "red" : "green"}
            />
          </div>
        )}
      </div>

      {!loading && totals.jobs === 0 ? (
        <div className={`${surfaceCardClass} p-10 text-center text-slate-500`}>
          Nessun intervento programmato in questo periodo.
        </div>
      ) : null}

      {!loading && totals.jobs > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Andamento giornaliero">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dayChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "Incassato" ? formatCurrency(value) : value,
                      name,
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="jobs" name="Interventi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="completed"
                    name="Completati"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuzione stati">
              {statusChart.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-500">Nessun dato</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {statusChart.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" align="right" verticalAlign="middle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <ChartCard title="Carico per montatore (top 12)">
            {workerChart.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Nessun montatore assegnato nel periodo
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, workerChart.length * 36)}>
                <BarChart
                  data={workerChart}
                  layout="vertical"
                  margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullName ?? ""
                    }
                  />
                  <Legend />
                  <Bar dataKey="jobs" name="Assegnati" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  <Bar
                    dataKey="completed"
                    name="Completati"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <section className={`space-y-4 p-4 sm:p-5 ${surfaceCardClass}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Riepilogo commesse</h2>
              <p className="text-sm text-slate-500">
                {data?.orders.length ?? 0} commesse con attività nel periodo
              </p>
            </div>

            <div className={mobileCardListClass}>
              {(data?.orders ?? []).map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>

            <div className={tableWrapperClass}>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Commessa</th>
                    <th className="p-3 text-right">Interventi</th>
                    <th className="p-3 text-right">Completati</th>
                    <th className="p-3 text-right">Previsto</th>
                    <th className="p-3 text-right">Incassato</th>
                    <th className="p-3 text-right">Residuo</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.orders ?? []).map((o) => (
                    <tr key={o.id} className="border-t border-slate-100 hover:bg-orange-50/40">
                      <td className="p-3">
                        <Link
                          to={`/backoffice/orders/${o.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {o.customerName ?? "N/D"}
                        </Link>
                      </td>
                      <td className="p-3 font-mono text-slate-800">{o.code}</td>
                      <td className="p-3 text-right">{o.jobs}</td>
                      <td className="p-3 text-right">{o.jobsCompleted}</td>
                      <td className="p-3 text-right font-medium text-blue-700">
                        {formatCurrency(o.expected)}
                      </td>
                      <td className="p-3 text-right font-medium text-emerald-600">
                        {formatCurrency(o.collected)}
                      </td>
                      <td
                        className={`p-3 text-right font-semibold ${
                          o.residual > 0 ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        {formatCurrency(o.residual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "blue" | "green" | "red";
}) {
  const valueClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "green"
        ? "text-emerald-600"
        : tone === "red"
          ? "text-red-700"
          : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-slate-500">{icon}</div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-base font-bold leading-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`${surfaceCardClass} p-4`}>
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function OrderCard({
  order,
}: {
  order: ReportPeriodResponse["orders"][number];
}) {
  return (
    <DataCard
      title={order.customerName ?? "N/D"}
      subtitle={`Commessa ${order.code}`}
      rows={[
        { label: "Interventi", value: order.jobs },
        { label: "Completati", value: order.jobsCompleted },
        { label: "Previsto", value: formatCurrency(order.expected) },
        {
          label: "Incassato",
          value: formatCurrency(order.collected),
          valueClassName: "text-emerald-600",
        },
        {
          label: "Residuo",
          value: formatCurrency(order.residual),
          valueClassName:
            order.residual > 0 ? "font-bold text-red-700" : "text-emerald-700",
        },
      ]}
      footer={
        <Link
          to={`/backoffice/orders/${order.id}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          Apri commessa
        </Link>
      }
    />
  );
}
