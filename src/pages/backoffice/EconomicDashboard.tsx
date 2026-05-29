import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  economicsAPI,
  type EconomicJobOrderRow,
  type EconomicOverviewResponse,
} from "@/api/economics";
import { Button } from "@/components/ui/Button";
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
import { ListSearchStatus } from "@/components/layout/ListSearchStatus";
import { DataCard } from "@/components/layout/DataCard";

type PeriodPreset = "all" | "today" | "week" | "month" | "quarter" | "year" | "custom";
type SettlementFilter = "all" | "open" | "settled";
type SortKey = "createdAt" | "code" | "customer" | "expected" | "collected" | "residual";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT");
}

function formatCurrency(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function periodToRange(
  period: PeriodPreset,
  filterYear: number | "all"
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

  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }
  if (period === "week") {
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }
  if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    start.setMonth(q * 3, 1);
    start.setHours(0, 0, 0, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }
  return {};
}

export default function EconomicDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EconomicOverviewResponse | null>(null);
  const [baselineOrderCount, setBaselineOrderCount] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [settlement, setSettlement] = useState<SettlementFilter>("all");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, period, filterYear, dateFrom, dateTo, customerId, settlement, sort, order]);

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
          : periodToRange(period, filterYear);

      const res = await economicsAPI.jobOrdersOverview({
        q: debouncedSearch || undefined,
        customerId: customerId || undefined,
        settlement,
        sort,
        order,
        page,
        pageSize,
        ...range,
      });
      setData(res);
      if (!debouncedSearch) {
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
    filterYear,
    dateFrom,
    dateTo,
    customerId,
    settlement,
    sort,
    order,
    page,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {
    expected: 0,
    collected: 0,
    residual: 0,
    orderCount: 0,
  };
  const meta = data?.meta;
  const years = meta?.years ?? [];
  const customers = meta?.customers ?? [];

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (debouncedSearch) n++;
    if (customerId) n++;
    if (settlement !== "all") n++;
    if (period !== "all") n++;
    if (filterYear !== "all") n++;
    if (period === "custom" && (dateFrom || dateTo)) n++;
    return n;
  }, [debouncedSearch, customerId, settlement, period, filterYear, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearch("");
    setPeriod("all");
    setFilterYear("all");
    setDateFrom("");
    setDateTo("");
    setCustomerId("");
    setSettlement("all");
    setSort("createdAt");
    setOrder("desc");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestione economica"
        description="Incassi per commessa: totali calcolati sul server, filtri e ordinamento senza scaricare tutto il gestionale."
        actions={
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
        }
      />

      <div className={filterBarClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            Filtri
            {activeFiltersCount > 0 ? (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                {activeFiltersCount} attivi
              </span>
            ) : null}
          </p>
          {activeFiltersCount > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-orange-600 hover:underline"
            >
              Azzera filtri
            </button>
          ) : null}
        </div>

        <div className={filterGridClass}>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cerca commessa o cliente
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Codice commessa, nome cliente…"
                className={`${inputFieldClass} pl-9`}
              />
            </div>
            <ListSearchStatus
              loading={loading}
              filteredCount={totals.orderCount}
              totalCount={baselineOrderCount || totals.orderCount}
              itemSingular="commessa"
              itemPlural="commesse"
              isSearchActive={Boolean(debouncedSearch)}
              isNarrowed={Boolean(debouncedSearch)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cliente
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={`${selectFieldClass} w-full`}
            >
              <option value="">Tutti i clienti</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stato incasso
            </label>
            <select
              value={settlement}
              onChange={(e) => setSettlement(e.target.value as SettlementFilter)}
              className={`${selectFieldClass} w-full`}
            >
              <option value="all">Tutte le commesse</option>
              <option value="open">Con residuo da incassare</option>
              <option value="settled">Saldate</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Periodo rapido
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
              className={`${selectFieldClass} w-full`}
            >
              <option value="all">Tutto</option>
              <option value="today">Oggi</option>
              <option value="week">Settimana corrente</option>
              <option value="month">Mese corrente</option>
              <option value="quarter">Trimestre corrente</option>
              <option value="year">Anno (sotto)</option>
              <option value="custom">Intervallo personalizzato</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Anno commessa
            </label>
            <select
              value={filterYear}
              onChange={(e) =>
                setFilterYear(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className={`${selectFieldClass} w-full`}
            >
              <option value="all">Tutti</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {period === "custom" ? (
            <>
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
            </>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ordina per
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={`${selectFieldClass} w-full`}
            >
              <option value="createdAt">Data commessa</option>
              <option value="code">Codice commessa</option>
              <option value="customer">Cliente</option>
              <option value="expected">Importo previsto</option>
              <option value="collected">Incassato</option>
              <option value="residual">Residuo</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Direzione
            </label>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
              className={`${selectFieldClass} w-full`}
            >
              <option value="desc">Decrescente</option>
              <option value="asc">Crescente</option>
            </select>
          </div>
        </div>
      </div>

      <div className={`${surfaceCardClass} p-4`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Caricamento…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi label="Commesse (filtro)" value={String(totals.orderCount)} />
            <Kpi label="Totale previsto" value={formatCurrency(totals.expected)} tone="blue" />
            <Kpi label="Totale incassato" value={formatCurrency(totals.collected)} tone="green" />
            <Kpi
              label="Residuo"
              value={formatCurrency(totals.residual)}
              tone={totals.residual > 0 ? "red" : "green"}
            />
          </div>
        )}
      </div>

      {!loading && rows.length === 0 ? (
        <div className={`${surfaceCardClass} p-8 text-center text-slate-500`}>
          Nessuna commessa corrisponde ai filtri selezionati.
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          <div className={tableWrapperClass}>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Commessa</th>
                  <th className="p-3">Data</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Previsto</th>
                  <th className="p-3 text-right">Incassato</th>
                  <th className="p-3 text-right">Residuo</th>
                  <th className="p-3 text-center">Stato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <OrderRow key={o.id} row={o} />
                ))}
              </tbody>
            </table>
          </div>

          <div className={mobileCardListClass}>
            {rows.map((o) => (
              <OrderMobileCard key={o.id} row={o} />
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
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
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
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function OrderRow({ row }: { row: EconomicJobOrderRow }) {
  return (
    <tr className="border-t border-slate-100 hover:bg-orange-50/50">
      <td className="p-3">
        <Link
          to={`/backoffice/orders/${row.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.customerName ?? "N/D"}
        </Link>
      </td>
      <td className="p-3 font-mono text-slate-800">{row.code}</td>
      <td className="p-3 text-slate-600">{formatDate(row.createdAt)}</td>
      <td className="p-3 text-right text-slate-500">{row.paymentCount}</td>
      <td className="p-3 text-right font-semibold text-blue-700">
        {formatCurrency(row.expected)}
      </td>
      <td className="p-3 text-right font-semibold text-emerald-600">
        {formatCurrency(row.collected)}
      </td>
      <td
        className={`p-3 text-right font-semibold ${
          row.residual > 0 ? "text-red-700" : "text-emerald-700"
        }`}
      >
        {formatCurrency(row.residual)}
      </td>
      <td className="p-3 text-center">
        <StatusBadge settled={row.settled} />
      </td>
    </tr>
  );
}

function OrderMobileCard({ row }: { row: EconomicJobOrderRow }) {
  return (
    <DataCard
      title={row.customerName ?? "N/D"}
      subtitle={`Commessa ${row.code}`}
      badge={<StatusBadge settled={row.settled} />}
      rows={[
        { label: "Data", value: formatDate(row.createdAt) },
        { label: "Rate pagamento", value: String(row.paymentCount) },
        { label: "Previsto", value: formatCurrency(row.expected) },
        {
          label: "Incassato",
          value: formatCurrency(row.collected),
          valueClassName: "text-emerald-600",
        },
        {
          label: "Residuo",
          value: formatCurrency(row.residual),
          valueClassName: row.residual > 0 ? "font-bold text-red-700" : "text-emerald-700",
        },
      ]}
      footer={
        <Link
          to={`/backoffice/orders/${row.id}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          Apri dettaglio commessa
        </Link>
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