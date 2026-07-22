import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  economicsAPI,
  type EconomicCategoryTotal,
  type EconomicDebtor,
  type EconomicJobOrderRow,
  type EconomicOverviewResponse,
  type EconomicPaymentLine,
} from "@/api/economics";
import { Button } from "@/components/ui/Button";
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
import { DataCard } from "@/components/layout/DataCard";
import {
  economicCollectedClass,
  economicExpectedClass,
  economicResidualClass,
} from "@/utils/payments";
import { formatDeliveryWeek } from "@/utils/officeElenco";
import {
  PAYMENT_CATEGORY_LABELS,
  type PaymentCategoryId,
} from "@/utils/paymentCategory";

type PeriodPreset = "all" | "today" | "week" | "month" | "quarter" | "year" | "custom";
type SettlementFilter = "all" | "open" | "settled";
type DateAxis = "delivery" | "createdAt";
type VisibilityFilter = "all" | "field" | "office";
type CategoryFilter = "all" | PaymentCategoryId;
type SortKey =
  | "createdAt"
  | "referenceDate"
  | "code"
  | "customer"
  | "expected"
  | "collected"
  | "residual";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT");
}

function formatCurrency(value: number) {
  return value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function formatPct(value: number) {
  return `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function periodToRange(
  period: PeriodPreset,
  filterYear: number | "all",
  weekOffset: number
): { from?: string; to?: string; year?: number } {
  const now = new Date();
  if (period === "all") {
    return filterYear === "all" ? {} : { year: filterYear };
  }
  if (period === "year") {
    const y = filterYear === "all" ? now.getFullYear() : filterYear;
    return { year: y };
  }
  if (period === "custom") return filterYear === "all" ? {} : { year: filterYear };

  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }
  if (period === "week") {
    const monday = addDays(getMonday(now), weekOffset * 7);
    const sunday = addDays(monday, 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: toIsoDate(monday), to: toIsoDate(sunday) };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return { from: toIsoDate(start), to: toIsoDate(monthEnd) };
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
    qEnd.setHours(23, 59, 59, 999);
    return { from: toIsoDate(start), to: toIsoDate(qEnd) };
  }
  return {};
}

function weekLabel(weekOffset: number) {
  const monday = addDays(getMonday(new Date()), weekOffset * 7);
  const sunday = addDays(monday, 6);
  if (weekOffset === 0) {
    return `Questa settimana (${formatDate(monday.toISOString())} – ${formatDate(sunday.toISOString())})`;
  }
  if (weekOffset === -1) {
    return `Settimana scorsa (${formatDate(monday.toISOString())} – ${formatDate(sunday.toISOString())})`;
  }
  if (weekOffset === 1) {
    return `Prossima settimana (${formatDate(monday.toISOString())} – ${formatDate(sunday.toISOString())})`;
  }
  const prefix =
    weekOffset < 0 ? `${Math.abs(weekOffset)} sett. fa` : `tra ${weekOffset} sett.`;
  return `${prefix} (${formatDate(monday.toISOString())} – ${formatDate(sunday.toISOString())})`;
}

function deliveryWeekLabel(row: EconomicJobOrderRow) {
  if (row.deliveryWeekYear != null && row.deliveryWeekNum != null) {
    return formatDeliveryWeek(row.deliveryWeekYear, row.deliveryWeekNum);
  }
  if (row.expectedDeliveryDate) return formatDate(row.expectedDeliveryDate);
  return "—";
}

function categoryBucket(
  row: EconomicJobOrderRow,
  id: PaymentCategoryId
): EconomicCategoryTotal | undefined {
  return row.byCategory?.find((c) => c.id === id);
}

export default function EconomicDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EconomicOverviewResponse | null>(null);
  const [baselineOrderCount, setBaselineOrderCount] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedDebtors, setExpandedDebtors] = useState<Set<string>>(new Set());
  const [showLabelDetail, setShowLabelDetail] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<"overview" | "insoluti">("overview");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dateAxis, setDateAxis] = useState<DateAxis>("delivery");
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [settlement, setSettlement] = useState<SettlementFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [sort, setSort] = useState<SortKey>("referenceDate");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const showInsoluti = () => {
    setViewMode("insoluti");
    setSettlement("open");
    setPeriod("all");
    setWeekOffset(0);
    setFilterYear("all");
    setDateFrom("");
    setDateTo("");
    setCategory("all");
    setSort("residual");
    setOrder("desc");
    setPage(1);
  };

  const showOverview = () => {
    setViewMode("overview");
    setSettlement("all");
    setSort("referenceDate");
    setOrder("asc");
    setPage(1);
  };

  const setPeriodPreset = (next: PeriodPreset) => {
    setPeriod(next);
    setWeekOffset(0);
    if (next !== "year" && next !== "custom" && next !== "all") {
      setFilterYear("all");
    }
    if (next === "year" && filterYear === "all") {
      setFilterYear(new Date().getFullYear());
    }
    if (next !== "custom") {
      setDateFrom("");
      setDateTo("");
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    period,
    weekOffset,
    dateAxis,
    filterYear,
    dateFrom,
    dateTo,
    settlement,
    category,
    visibility,
    sort,
    order,
  ]);

  useEffect(() => {
    if (period !== "week") setWeekOffset(0);
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range =
        period === "custom"
          ? {
              from: dateFrom || undefined,
              to: dateTo || undefined,
              ...(filterYear !== "all" ? { year: filterYear } : {}),
            }
          : periodToRange(period, filterYear, weekOffset);

      const res = await economicsAPI.jobOrdersOverview({
        q: debouncedSearch || undefined,
        settlement,
        dateAxis,
        category,
        visibility,
        sort,
        order,
        page,
        pageSize,
        ...range,
      });
      setData(res);
      if (!debouncedSearch && category === "all" && visibility === "all") {
        setBaselineOrderCount(res.totals?.orderCount ?? res.rows?.length ?? 0);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento dati economici");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    period,
    weekOffset,
    dateAxis,
    filterYear,
    dateFrom,
    dateTo,
    settlement,
    category,
    visibility,
    sort,
    order,
    page,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const byCategory = totals?.byCategory ?? [];
  const byLabel = totals?.byLabel ?? [];
  const meta = data?.meta;
  const years = meta?.years ?? [];

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (debouncedSearch) n++;
    if (viewMode === "overview" && settlement !== "all") n++;
    if (period !== "all") n++;
    if (period === "year" && filterYear !== "all") n++;
    if (period === "all" && filterYear !== "all") n++;
    if (period === "custom" && (dateFrom || dateTo)) n++;
    if (dateAxis !== "delivery") n++;
    if (period === "week" && weekOffset !== 0) n++;
    if (category !== "all") n++;
    if (visibility !== "all") n++;
    return n;
  }, [
    debouncedSearch,
    settlement,
    period,
    filterYear,
    dateFrom,
    dateTo,
    dateAxis,
    weekOffset,
    category,
    visibility,
    viewMode,
  ]);

  const periodSummary = useMemo(() => {
    if (period === "all") {
      return filterYear === "all" ? "Tutte le consegne" : `Anno ${filterYear}`;
    }
    if (period === "week") return weekLabel(weekOffset);
    if (period === "month") return "Mese corrente";
    if (period === "quarter") return "Trimestre corrente";
    if (period === "year") {
      return `Anno ${filterYear === "all" ? new Date().getFullYear() : filterYear}`;
    }
    if (period === "today") return "Oggi";
    if (period === "custom") {
      if (dateFrom && dateTo) return `${formatDate(dateFrom)} → ${formatDate(dateTo)}`;
      if (dateFrom) return `Dal ${formatDate(dateFrom)}`;
      if (dateTo) return `Fino al ${formatDate(dateTo)}`;
      return "Intervallo personalizzato";
    }
    return "";
  }, [period, filterYear, weekOffset, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearch("");
    setPeriod("all");
    setWeekOffset(0);
    setDateAxis("delivery");
    setFilterYear("all");
    setDateFrom("");
    setDateTo("");
    setSettlement(viewMode === "insoluti" ? "open" : "all");
    setCategory("all");
    setVisibility("all");
    setSort(viewMode === "insoluti" ? "residual" : "referenceDate");
    setOrder(viewMode === "insoluti" ? "desc" : "asc");
    setPage(1);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDebtor = (id: string) => {
    setExpandedDebtors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expected = totals?.expected ?? 0;
  const collected = totals?.collected ?? 0;
  const residual = totals?.residual ?? 0;
  const collectedPct = totals?.collectedPct ?? 0;
  const orderCount = totals?.orderCount ?? 0;
  const openOrderCount = totals?.openOrderCount ?? 0;
  const debtors = totals?.debtors ?? [];
  const insolutiTotal = debtors.reduce((s, d) => s + d.residual, 0);

  return (
    <main className="space-y-5">
      <PageHeader
        title="Economia aziendale"
        description="Incassi completi (anche acconti ufficio): previsto, preso e residuo. Chi deve e per quale tipo di pagamento."
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="inline-flex min-h-11 flex-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:flex-none">
              <button
                type="button"
                onClick={showOverview}
                className={`min-h-9 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none ${
                  viewMode === "overview"
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Panoramica
              </button>
              <button
                type="button"
                onClick={showInsoluti}
                className={`min-h-9 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none ${
                  viewMode === "insoluti"
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Insoluti
              </button>
            </div>
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
          </div>
        }
      />

      <div className={filterBarClass}>
        <div className="flex flex-col gap-3">
          <div className="relative w-full max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca cliente, commessa o montatore…"
              className={`${inputFieldClass} pl-9`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Periodo
              </span>
              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-medium text-orange-600 hover:underline"
                >
                  Azzera
                </button>
              ) : null}
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {(
                [
                  ["all", "Tutto"],
                  ["week", "Settimana"],
                  ["month", "Mese"],
                  ["year", "Anno"],
                  ["custom", "Dal / Al"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriodPreset(id)}
                  className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                    period === id
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-500">{periodSummary}</p>
          </div>

          {period === "week" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                onClick={() => setWeekOffset((w) => w - 1)}
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
                onClick={() => setWeekOffset((w) => w + 1)}
              >
                Succ.
                <ChevronRight size={16} />
              </Button>
            </div>
          ) : null}

          {period === "year" ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Anno
              </label>
              <select
                value={filterYear === "all" ? new Date().getFullYear() : filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className={`${selectFieldClass} w-auto min-w-[8rem]`}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {period === "custom" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-lg">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dal
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputFieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Al
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputFieldClass}
                />
              </div>
            </div>
          ) : null}

          {viewMode === "overview" ? (
            <div className="space-y-2 border-t border-slate-200/80 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stato
              </span>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {(
                  [
                    ["all", "Tutte"],
                    ["open", "Da incassare"],
                    ["settled", "Saldate"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSettlement(id)}
                    className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${
                      settlement === id
                        ? "bg-orange-600 text-white"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="border-t border-slate-200/80 pt-3 text-sm text-slate-600">
              Solo chi ha un residuo, dal debito più alto.
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ChevronDown
                size={14}
                className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              />
              {showAdvanced ? "Nascondi opzioni" : "Altre opzioni"}
            </button>
            {showAdvanced ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Periodo calcolato su
                  </label>
                  <select
                    value={dateAxis}
                    onChange={(e) => setDateAxis(e.target.value as DateAxis)}
                    className={selectFieldClass}
                  >
                    <option value="delivery">Consegna prevista (consigliato)</option>
                    <option value="createdAt">Data creazione commessa</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quali voci
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as VisibilityFilter)}
                    className={selectFieldClass}
                  >
                    <option value="all">Tutte (anche acconti ufficio)</option>
                    <option value="field">Solo in cantiere</option>
                    <option value="office">Solo nascoste in cantiere</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ordina elenco
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className={selectFieldClass}
                    >
                      <option value="referenceDate">Data riferimento</option>
                      <option value="residual">Residuo</option>
                      <option value="collected">Incassato</option>
                      <option value="expected">Previsto</option>
                      <option value="customer">Cliente</option>
                      <option value="code">Codice</option>
                      <option value="createdAt">Creazione</option>
                    </select>
                    <select
                      value={order}
                      onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
                      className={`${selectFieldClass} w-28 shrink-0`}
                    >
                      <option value="asc">↑</option>
                      <option value="desc">↓</option>
                    </select>
                  </div>
                </div>
                {period === "all" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Filtra per anno
                    </label>
                    <select
                      value={filterYear}
                      onChange={(e) =>
                        setFilterYear(
                          e.target.value === "all" ? "all" : Number(e.target.value)
                        )
                      }
                      className={selectFieldClass}
                    >
                      <option value="all">Tutti gli anni</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <ListSearchStatus
            loading={loading}
            filteredCount={orderCount}
            totalCount={baselineOrderCount || orderCount}
            itemSingular="commessa"
            itemPlural="commesse"
            isSearchActive={Boolean(debouncedSearch)}
            isNarrowed={Boolean(debouncedSearch) || activeFiltersCount > 0}
          />
        </div>
      </div>

      <div className={`${surfaceCardClass} p-4`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Caricamento…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <Kpi
              label="Commesse"
              value={String(orderCount)}
              hint={
                viewMode === "insoluti"
                  ? `${debtors.length} clienti`
                  : `${openOrderCount} da incassare`
              }
            />
            <Kpi label="Previsto" value={formatCurrency(expected)} tone="expected" />
            <Kpi
              label="Incassato"
              value={formatCurrency(collected)}
              tone="collected"
              hint="Acconti inclusi"
            />
            <Kpi
              label="Da incassare"
              value={formatCurrency(residual)}
              tone="residual"
              residual={residual}
            />
            <Kpi label="% incassato" value={formatPct(collectedPct)} />
          </div>
        )}
      </div>

      {!loading && byCategory.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Per tipo di pagamento</h2>
              <p className="text-xs text-slate-500">
                Tocca una card per filtrare. Tocca di nuovo per togliere il filtro.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLabelDetail((v) => !v)}
              className="text-sm font-medium text-orange-600 hover:underline"
            >
              {showLabelDetail ? "Nascondi etichette" : "Etichette originali"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {byCategory.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                active={category === cat.id}
                onFilter={() =>
                  setCategory((prev) => (prev === cat.id ? "all" : cat.id))
                }
              />
            ))}
          </div>

          {showLabelDetail && byLabel.length > 0 ? (
            <div className={surfaceCardClass}>
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Etichette originali</h3>
              </div>
              <div className={`${tableWrapperClass} border-0 shadow-none`}>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Etichetta</th>
                      <th className="p-3">Macro</th>
                      <th className="p-3 text-right">Voci</th>
                      <th className="p-3 text-right">Previsto</th>
                      <th className="p-3 text-right">Incassato</th>
                      <th className="p-3 text-right">Residuo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byLabel.map((row) => (
                      <tr key={row.label} className="border-t border-slate-100">
                        <td className="p-3 text-slate-800">{row.label}</td>
                        <td className="p-3 text-slate-600">
                          {PAYMENT_CATEGORY_LABELS[row.category]}
                        </td>
                        <td className="p-3 text-right text-slate-500">{row.lineCount}</td>
                        <td className={`p-3 text-right ${economicExpectedClass()}`}>
                          {formatCurrency(row.expected)}
                        </td>
                        <td className={`p-3 text-right ${economicCollectedClass()}`}>
                          {formatCurrency(row.collected)}
                        </td>
                        <td className={`p-3 text-right ${economicResidualClass(row.residual)}`}>
                          {formatCurrency(row.residual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && viewMode === "insoluti" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Chi deve soldi</h2>
            <p className="text-xs text-slate-500">
              {debtors.length} clienti · {openOrderCount} commesse ·{" "}
              {formatCurrency(insolutiTotal || residual)}
            </p>
          </div>

          {debtors.length === 0 ? (
            <div className={`${surfaceCardClass} p-6 text-center text-slate-500`}>
              Nessun insoluto con i filtri attuali.
            </div>
          ) : (
            <div className="space-y-2">
              {debtors.map((debtor) => (
                <DebtorCard
                  key={debtor.customerId}
                  debtor={debtor}
                  expanded={expandedDebtors.has(debtor.customerId)}
                  onToggle={() => toggleDebtor(debtor.customerId)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!loading && rows.length === 0 && viewMode !== "insoluti" ? (
        <div className={`${surfaceCardClass} p-8 text-center text-slate-500`}>
          Nessuna commessa corrisponde ai filtri selezionati.
        </div>
      ) : null}

      {!loading && rows.length > 0 && viewMode === "overview" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Commesse</h2>
            <p className="text-xs text-slate-500">
              Espandi una riga per vedere ogni voce (acconti inclusi)
            </p>
          </div>

          <div className={tableWrapperClass}>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 p-3" />
                  <th className="p-3">Cliente / Commessa</th>
                  <th className="p-3">Consegna</th>
                  <th className="p-3 text-right">Acconto<br /><span className="font-normal normal-case tracking-normal text-slate-400">prev. / inc. / residuo</span></th>
                  <th className="p-3 text-right">Alla consegna<br /><span className="font-normal normal-case tracking-normal text-slate-400">prev. / inc. / residuo</span></th>
                  <th className="p-3 text-right">Fine montaggio<br /><span className="font-normal normal-case tracking-normal text-slate-400">prev. / inc. / residuo</span></th>
                  <th className="p-3 text-right">Previsto</th>
                  <th className="p-3 text-right">Incassato</th>
                  <th className="p-3 text-right">Residuo</th>
                  <th className="p-3 text-center">Stato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <OrderRows
                    key={o.id}
                    row={o}
                    expanded={expandedIds.has(o.id)}
                    onToggle={() => toggleExpanded(o.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className={mobileCardListClass}>
            {rows.map((o) => (
              <OrderMobileCard
                key={o.id}
                row={o}
                expanded={expandedIds.has(o.id)}
                onToggle={() => toggleExpanded(o.id)}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm text-slate-600">
                Pagina {meta.page} di {meta.totalPages} · {meta.total} commesse
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1"
                >
                  <ChevronLeft size={16} />
                  Precedente
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Successiva
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function DebtorCard({
  debtor,
  expanded,
  onToggle,
}: {
  debtor: EconomicDebtor;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${surfaceCardClass} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50 sm:items-center sm:px-4"
      >
        <ChevronDown
          size={16}
          className={`mt-1 shrink-0 text-slate-500 transition-transform sm:mt-0 ${expanded ? "rotate-180" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{debtor.customerName}</p>
          <p className="text-xs text-slate-500">
            {debtor.orderCount}{" "}
            {debtor.orderCount === 1 ? "commessa aperta" : "commesse aperte"}
          </p>
        </div>
        <div className="max-w-[45%] shrink-0 text-right sm:max-w-none">
          <p
            className={`break-words text-sm font-bold tabular-nums sm:text-base ${economicResidualClass(debtor.residual)}`}
          >
            {formatCurrency(debtor.residual)}
          </p>
          <p className="text-[11px] leading-snug text-slate-500 sm:text-xs">
            su {formatCurrency(debtor.expected)}
            <span className="hidden sm:inline">
              {" "}
              · inc.{" "}
              <span className={economicCollectedClass()}>
                {formatCurrency(debtor.collected)}
              </span>
            </span>
          </p>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          {debtor.orders.map((ord) => (
            <div
              key={ord.id}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    to={`/backoffice/orders/${ord.id}`}
                    className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                  >
                    {ord.code}
                  </Link>
                  <p className="text-xs text-slate-500">
                    Consegna{" "}
                    {ord.deliveryWeekYear != null && ord.deliveryWeekNum != null
                      ? formatDeliveryWeek(ord.deliveryWeekYear, ord.deliveryWeekNum)
                      : "—"}{" "}
                    · rif. {formatDate(ord.referenceDate)}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className={`font-bold ${economicResidualClass(ord.residual)}`}>
                    {formatCurrency(ord.residual)}
                  </div>
                  <div className="text-xs text-slate-500">
                    prev. {formatCurrency(ord.expected)} · inc.{" "}
                    {formatCurrency(ord.collected)}
                  </div>
                </div>
              </div>
              {ord.unpaidLines.length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {ord.unpaidLines.map((line) => (
                    <li
                      key={line.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-slate-700">
                        {line.label}
                        <span className="ml-2 text-xs text-slate-400">
                          {line.categoryLabel}
                        </span>
                      </span>
                      <span className={`font-semibold ${economicResidualClass(line.residual)}`}>
                        {formatCurrency(line.residual)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  residual = 0,
}: {
  label: string;
  value: string;
  hint?: string;
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
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
        {label}
      </p>
      <p className={`mt-1 break-words text-base font-bold tabular-nums sm:text-lg ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{hint}</p> : null}
    </div>
  );
}

function CategoryCard({
  cat,
  active,
  onFilter,
}: {
  cat: EconomicCategoryTotal;
  active: boolean;
  onFilter: () => void;
}) {
  const pct =
    cat.expected > 0.009 ? Math.min(100, (cat.collected / cat.expected) * 100) : 100;
  return (
    <button
      type="button"
      onClick={onFilter}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-orange-400 bg-orange-50 shadow-sm ring-2 ring-orange-200"
          : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{cat.label}</p>
        <span className="text-xs text-slate-500">
          {active ? "Filtro attivo" : `${cat.lineCount} voci`}
        </span>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Previsto</span>
          <span className={`font-semibold tabular-nums ${economicExpectedClass()}`}>
            {formatCurrency(cat.expected)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Incassato</span>
          <span className={`font-semibold tabular-nums ${economicCollectedClass()}`}>
            {formatCurrency(cat.collected)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Residuo</span>
          <span className={`font-semibold tabular-nums ${economicResidualClass(cat.residual)}`}>
            {formatCurrency(cat.residual)}
          </span>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">{formatPct(pct)} incassato</p>
    </button>
  );
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
  if (expected <= 0.009 && collected <= 0.009) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="space-y-0.5 text-right text-xs leading-tight tabular-nums">
      <div className={economicExpectedClass()}>{formatCurrency(expected)}</div>
      <div className={`font-medium ${economicCollectedClass()}`}>
        {formatCurrency(collected)}
      </div>
      <div className={`font-semibold ${economicResidualClass(residual)}`}>
        {formatCurrency(residual)}
      </div>
    </div>
  );
}

function PaymentLinesTable({ payments }: { payments: EconomicPaymentLine[] }) {
  if (payments.length === 0) {
    return <p className="px-3 py-2 text-sm text-slate-500">Nessuna voce di pagamento.</p>;
  }
  return (
    <table className="min-w-full text-sm">
      <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-3 py-2">Descrizione</th>
          <th className="px-3 py-2">Tipo</th>
          <th className="px-3 py-2 text-right">Previsto</th>
          <th className="px-3 py-2 text-right">Incassato</th>
          <th className="px-3 py-2 text-right">Residuo</th>
          <th className="px-3 py-2 text-center">Dove</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.id} className="border-t border-slate-100/80">
            <td className="px-3 py-2 text-slate-800">{p.label}</td>
            <td className="px-3 py-2 text-slate-600">{p.categoryLabel}</td>
            <td className={`px-3 py-2 text-right ${economicExpectedClass()}`}>
              {formatCurrency(p.amount)}
            </td>
            <td className={`px-3 py-2 text-right ${economicCollectedClass()}`}>
              {formatCurrency(p.collectedAmount)}
            </td>
            <td className={`px-3 py-2 text-right ${economicResidualClass(p.residual)}`}>
              {formatCurrency(p.residual)}
            </td>
            <td className="px-3 py-2 text-center text-xs text-slate-500">
              {p.showOnField ? "Cantiere" : "Solo ufficio"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrderRows({
  row,
  expanded,
  onToggle,
}: {
  row: EconomicJobOrderRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const payments = row.payments ?? [];
  const acconto = categoryBucket(row, "acconto");
  const consegna = categoryBucket(row, "alla_consegna");
  const montaggio = categoryBucket(row, "fine_montaggio");

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-orange-50/50">
        <td className="p-2">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-expanded={expanded}
            aria-label={expanded ? "Chiudi dettaglio" : "Apri dettaglio"}
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </td>
        <td className="p-3">
          <Link
            to={`/backoffice/orders/${row.id}`}
            className="font-medium text-blue-600 hover:underline"
          >
            {row.customerName ?? "N/D"}
          </Link>
          <div className="font-mono text-xs text-slate-500">{row.code}</div>
        </td>
        <td className="p-3 text-slate-600">
          <div>{deliveryWeekLabel(row)}</div>
          <div className="text-xs text-slate-400">
            rif. {formatDate(row.referenceDate ?? row.createdAt)}
          </div>
        </td>
        <td className="p-3 text-right">
          {acconto ? <MiniMoney {...acconto} /> : <span className="text-slate-400">—</span>}
        </td>
        <td className="p-3 text-right">
          {consegna ? <MiniMoney {...consegna} /> : <span className="text-slate-400">—</span>}
        </td>
        <td className="p-3 text-right">
          {montaggio ? <MiniMoney {...montaggio} /> : <span className="text-slate-400">—</span>}
        </td>
        <td className={`p-3 text-right font-semibold ${economicExpectedClass()}`}>
          {formatCurrency(row.expected)}
        </td>
        <td className={`p-3 text-right font-semibold ${economicCollectedClass()}`}>
          {formatCurrency(row.collected)}
        </td>
        <td className={`p-3 text-right font-semibold ${economicResidualClass(row.residual)}`}>
          {formatCurrency(row.residual)}
        </td>
        <td className="p-3 text-center">
          <StatusBadge settled={row.settled} />
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-slate-50 bg-slate-50/70">
          <td colSpan={10} className="p-0">
            <div className="px-2 py-2 md:px-8">
              <div className="overflow-x-auto">
                <PaymentLinesTable payments={payments} />
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function OrderMobileCard({
  row,
  expanded,
  onToggle,
}: {
  row: EconomicJobOrderRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const payments = row.payments ?? [];
  const acconto = categoryBucket(row, "acconto");
  const consegna = categoryBucket(row, "alla_consegna");
  const montaggio = categoryBucket(row, "fine_montaggio");

  return (
    <DataCard
      title={row.customerName ?? "N/D"}
      subtitle={`Commessa ${row.code} · ${deliveryWeekLabel(row)}`}
      badge={<StatusBadge settled={row.settled} />}
      rows={[
        {
          label: "Acconto (prev. / inc. / residuo)",
          value: acconto
            ? `${formatCurrency(acconto.expected)} / ${formatCurrency(acconto.collected)} / ${formatCurrency(acconto.residual)}`
            : "—",
        },
        {
          label: "Alla consegna (prev. / inc. / residuo)",
          value: consegna
            ? `${formatCurrency(consegna.expected)} / ${formatCurrency(consegna.collected)} / ${formatCurrency(consegna.residual)}`
            : "—",
        },
        {
          label: "Fine montaggio (prev. / inc. / residuo)",
          value: montaggio
            ? `${formatCurrency(montaggio.expected)} / ${formatCurrency(montaggio.collected)} / ${formatCurrency(montaggio.residual)}`
            : "—",
        },
        {
          label: "Previsto totale",
          value: formatCurrency(row.expected),
          valueClassName: economicExpectedClass(),
        },
        {
          label: "Incassato totale",
          value: formatCurrency(row.collected),
          valueClassName: economicCollectedClass(),
        },
        {
          label: "Residuo totale",
          value: formatCurrency(row.residual),
          valueClassName: economicResidualClass(row.residual),
        },
      ]}
      footer={
        <div className="space-y-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Nascondi voci" : "Tutte le voci"}
          </button>
          {expanded ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
              <PaymentLinesTable payments={payments} />
            </div>
          ) : null}
          <Link
            to={`/backoffice/orders/${row.id}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
          >
            Apri dettaglio commessa
          </Link>
        </div>
      }
    />
  );
}

function StatusBadge({ settled }: { settled: boolean }) {
  return (
    <span
      className={
        settled
          ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
          : "inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
      }
    >
      {settled ? "Saldato" : "Aperto"}
    </span>
  );
}
