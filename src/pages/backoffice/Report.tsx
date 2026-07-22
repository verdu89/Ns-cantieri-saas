import { useCallback, useEffect, useMemo, useState, Fragment, type ReactNode } from "react";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportAPI, type ReportMoneyCategory, type ReportPeriodResponse } from "@/api/report";
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
import {
  economicCollectedClass,
  economicExpectedClass,
  economicResidualClass,
} from "@/utils/payments";
import type { PaymentCategoryId } from "@/utils/paymentCategory";

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

function categoryBucket(
  cats: ReportMoneyCategory[] | undefined,
  id: PaymentCategoryId
) {
  return cats?.find((c) => c.id === id);
}

function MiniMoney({
  expected,
  collected,
  residual,
}: {
  expected: number;
  collected: number;
  residual: number;
}) {
  if (expected <= 0.009) return <span className="text-slate-400">—</span>;
  return (
    <div className="leading-tight">
      <div className={`text-xs tabular-nums ${economicExpectedClass()}`}>
        {formatCurrency(expected)}
      </div>
      <div className={`text-xs tabular-nums ${economicCollectedClass()}`}>
        {formatCurrency(collected)}
      </div>
      <div className={`text-xs font-semibold tabular-nums ${economicResidualClass(residual)}`}>
        {formatCurrency(residual)}
      </div>
    </div>
  );
}

function PaymentStatusChip({
  payment,
}: {
  payment: ReportPeriodResponse["orders"][number]["payments"][number];
}) {
  const tone = payment.settled
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : payment.collected > 0.009
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-rose-200 bg-rose-50 text-rose-800";
  const state = payment.settled
    ? "incassato"
    : payment.collected > 0.009
      ? "parziale"
      : "da incassare";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${tone}`}
      title={`${payment.label}: ${formatCurrency(payment.expected)} · ${state}`}
    >
      <span className="truncate">{payment.categoryLabel}</span>
      <span className="tabular-nums opacity-80">{formatCurrency(payment.residual)}</span>
      <span className="opacity-70">· {state}</span>
    </span>
  );
}

export default function ReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportPeriodResponse | null>(null);
  const [period, setPeriod] = useState<PeriodPreset>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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

  const byCategory = useMemo(
    () => (data?.byCategory ?? []).filter((c) => c.lineCount > 0 || c.expected > 0.009),
    [data?.byCategory]
  );

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
        "Acconto residuo EUR",
        "Consegna residuo EUR",
        "Fine montaggio residuo EUR",
        "Dettaglio pagamenti",
      ],
      ...rows.map((o) => {
        const acconto = categoryBucket(o.byCategory, "acconto");
        const consegna = categoryBucket(o.byCategory, "alla_consegna");
        const montaggio = categoryBucket(o.byCategory, "fine_montaggio");
        return [
          o.customerName ?? "",
          o.code,
          o.jobs,
          o.jobsCompleted,
          o.expected.toFixed(2),
          o.collected.toFixed(2),
          o.residual.toFixed(2),
          (acconto?.residual ?? 0).toFixed(2),
          (consegna?.residual ?? 0).toFixed(2),
          (montaggio?.residual ?? 0).toFixed(2),
          (o.payments ?? [])
            .map(
              (p) =>
                `${p.label} [${p.categoryLabel}] ${p.settled ? "incassato" : "da incassare"} ${p.residual.toFixed(2)}`
            )
            .join(" | "),
        ];
      }),
    ]);
    toast.success("CSV scaricato");
  };

  return (
    <main className="space-y-5">
      <PageHeader
        title="Report cantieri"
        description={`Report economico delle commesse in agenda · ${range.label}`}
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
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
              <span className="sm:hidden">CSV</span>
              <span className="hidden sm:inline">CSV commesse</span>
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

        {period === "week" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              aria-label="Settimana precedente"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft size={16} />
              Prec.
            </Button>
            <Button
              type="button"
              variant={weekOffset === 0 ? "primary" : "outline"}
              onClick={() => setWeekOffset(0)}
            >
              Questa settimana
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              aria-label="Settimana successiva"
              disabled={weekOffset >= 0}
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              Succ.
              <ChevronRight size={16} />
            </Button>
          </div>
        ) : null}

        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
          <CalendarRange size={14} className="mt-0.5 shrink-0" />
          <span>
            Solo le commesse con almeno un intervento in agenda nel periodo, con il loro piano
            pagamenti (previsto / incassato / residuo per tipo).
          </span>
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
              label="Commesse in agenda"
              value={String(totals.orders)}
            />
            <Kpi
              icon={<Wallet className="text-blue-600" size={18} />}
              label="Previsto"
              value={formatCurrency(totals.expected)}
              tone="expected"
            />
            <Kpi
              icon={<Wallet className="text-emerald-600" size={18} />}
              label="Incassato"
              value={formatCurrency(totals.collected)}
              tone="collected"
            />
            <Kpi
              icon={<Wallet className="text-red-600" size={18} />}
              label="Residuo"
              value={formatCurrency(totals.residual)}
              tone="residual"
              residual={totals.residual}
            />
          </div>
        )}
      </div>

      {!loading && byCategory.length > 0 ? (
        <div className={`${surfaceCardClass} space-y-3 p-4 md:p-5`}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pagamenti per tipo</h2>
            <p className="mt-1 text-sm text-slate-600">
              Piano pagamenti delle commesse in agenda nel periodo (acconto / consegna / fine
              montaggio).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {byCategory.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {cat.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {cat.lineCount} voc{cat.lineCount === 1 ? "e" : "i"}
                </p>
                <div className="mt-2 space-y-1 text-sm tabular-nums">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Previsto</span>
                    <span className={economicExpectedClass()}>
                      {formatCurrency(cat.expected)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Incassato</span>
                    <span className={economicCollectedClass()}>
                      {formatCurrency(cat.collected)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 font-semibold">
                    <span className="text-slate-600">Residuo</span>
                    <span className={economicResidualClass(cat.residual)}>
                      {formatCurrency(cat.residual)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && totals.jobs === 0 ? (
        <div className={`${surfaceCardClass} p-10 text-center text-slate-500`}>
          Nessuna commessa in agenda in questo periodo.
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
                    formatter={(value, name) => [
                      name === "Incassato"
                        ? formatCurrency(Number(value ?? 0))
                        : Number(value ?? 0),
                      String(name),
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
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {statusChart.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ fontSize: 12 }}
                    />
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
                    width={72}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) =>
                      v.length > 10 ? `${v.slice(0, 9)}…` : v
                    }
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
              <h2 className="text-lg font-semibold text-slate-900">Commesse in agenda</h2>
              <p className="text-sm text-slate-500">
                {data?.orders.length ?? 0} commesse · piano pagamenti e dettaglio per tipo
              </p>
            </div>

            <div className={mobileCardListClass}>
              {(data?.orders ?? []).map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>

            <div className={tableWrapperClass}>
              <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
                Nelle colonne Acconto / Consegna / Montaggio: previsto, incassato, residuo (dall’alto
                in basso). Espandi per le etichette originali.
              </p>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3 w-10" />
                    <th className="p-3">Cliente</th>
                    <th className="p-3 text-right">Int.</th>
                    <th className="p-3 text-right">Acconto</th>
                    <th className="p-3 text-right">Consegna</th>
                    <th className="p-3 text-right">Montaggio</th>
                    <th className="p-3 text-right">Previsto</th>
                    <th className="p-3 text-right">Incassato</th>
                    <th className="p-3 text-right">Residuo</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.orders ?? []).map((o) => {
                    const open = expandedOrderId === o.id;
                    const acconto = categoryBucket(o.byCategory, "acconto");
                    const consegna = categoryBucket(o.byCategory, "alla_consegna");
                    const montaggio = categoryBucket(o.byCategory, "fine_montaggio");
                    return (
                      <Fragment key={o.id}>
                        <tr
                          className="border-t border-slate-100 hover:bg-orange-50/40"
                        >
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOrderId((prev) => (prev === o.id ? null : o.id))
                              }
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                              aria-expanded={open}
                              aria-label={open ? "Chiudi dettaglio" : "Apri dettaglio pagamenti"}
                            >
                              <ChevronDown
                                size={16}
                                className={`transition-transform ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                          </td>
                          <td className="p-3">
                            <Link
                              to={`/backoffice/orders/${o.id}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {o.customerName ?? "N/D"}
                            </Link>
                            <div className="font-mono text-xs text-slate-500">{o.code}</div>
                          </td>
                          <td className="p-3 text-right text-slate-600">
                            {o.jobsCompleted}/{o.jobs}
                          </td>
                          <td className="p-3 text-right">
                            {acconto ? <MiniMoney {...acconto} /> : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="p-3 text-right">
                            {consegna ? (
                              <MiniMoney {...consegna} />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {montaggio ? (
                              <MiniMoney {...montaggio} />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className={`p-3 text-right font-medium ${economicExpectedClass()}`}>
                            {formatCurrency(o.expected)}
                          </td>
                          <td className={`p-3 text-right font-medium ${economicCollectedClass()}`}>
                            {formatCurrency(o.collected)}
                          </td>
                          <td
                            className={`p-3 text-right font-semibold ${economicResidualClass(o.residual)}`}
                          >
                            {formatCurrency(o.residual)}
                          </td>
                        </tr>
                        {open ? (
                          <tr className="border-t border-slate-50 bg-slate-50/80">
                            <td colSpan={9} className="px-4 py-3">
                              {(o.payments ?? []).length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  Nessuna voce pagamento sul piano / interventi.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Dettaglio voci
                                  </p>
                                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                                    {(o.payments ?? []).map((p, idx) => (
                                      <li
                                        key={`${p.label}-${idx}`}
                                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-medium text-slate-800">{p.label}</div>
                                          <div className="text-xs text-slate-500">
                                            {p.categoryLabel}
                                            {p.settled
                                              ? " · incassato"
                                              : p.collected > 0.009
                                                ? " · parziale"
                                                : " · da incassare"}
                                          </div>
                                        </div>
                                        <div className="text-right text-xs tabular-nums">
                                          <div className={economicExpectedClass()}>
                                            prev. {formatCurrency(p.expected)}
                                          </div>
                                          <div className={economicCollectedClass()}>
                                            inc. {formatCurrency(p.collected)}
                                          </div>
                                          <div
                                            className={`font-semibold ${economicResidualClass(p.residual)}`}
                                          >
                                            res. {formatCurrency(p.residual)}
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
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
  residual = 0,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "expected" | "collected" | "residual";
  residual?: number;
}) {
  const valueClass =
    tone === "expected"
      ? economicExpectedClass()
      : tone === "collected"
        ? economicCollectedClass()
        : tone === "residual"
          ? economicResidualClass(residual)
          : "text-slate-900";
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-slate-500">{icon}</div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 break-words text-sm font-bold leading-tight tabular-nums sm:text-base ${valueClass}`}>
        {value}
      </p>
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
    <div className={`${surfaceCardClass} min-w-0 p-3 sm:p-4`}>
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </div>
  );
}

function OrderCard({
  order,
}: {
  order: ReportPeriodResponse["orders"][number];
}) {
  const payments = order.payments ?? [];
  return (
    <DataCard
      title={order.customerName ?? "N/D"}
      subtitle={`Commessa ${order.code}`}
      rows={[
        { label: "Interventi", value: `${order.jobsCompleted}/${order.jobs}` },
        { label: "Previsto", value: formatCurrency(order.expected), valueClassName: economicExpectedClass() },
        {
          label: "Incassato",
          value: formatCurrency(order.collected),
          valueClassName: economicCollectedClass(),
        },
        {
          label: "Residuo",
          value: formatCurrency(order.residual),
          valueClassName: economicResidualClass(order.residual),
        },
      ]}
      footer={
        <div className="space-y-3">
          {payments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {payments.map((p, idx) => (
                <PaymentStatusChip key={`${p.label}-${idx}`} payment={p} />
              ))}
            </div>
          ) : null}
          <Link
            to={`/backoffice/orders/${order.id}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
          >
            Apri commessa
          </Link>
        </div>
      }
    />
  );
}
