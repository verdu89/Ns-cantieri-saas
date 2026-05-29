import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { customerAPI } from "@/api/customers";
import { jobAPI } from "@/api/jobs";
import { jobOrderAPI } from "@/api/jobOrders";
import { paymentAPI } from "@/api/payments";
import type { Customer, JobOrder, Payment } from "@/types";
import {
  PageHeader,
  surfaceCardClass,
  inputFieldClass,
  selectFieldClass,
  filterGridClass,
  tableWrapperClass,
  mobileCardListClass,
} from "@/components/layout/PageChrome";
import { DataCard } from "@/components/layout/DataCard";

type CollectionsRow = {
  id: string;
  jobId: string;
  jobOrderId: string;
  customerId: string | null;
  customerName: string;
  orderCode: string;
  label: string;
  plannedDate: string | null;
  amount: number;
  collectedAmount: number;
  residualAmount: number;
  status: "insoluto" | "in_scadenza" | "futuro" | "incassato" | "senza_data";
};

function dateDiffInDays(targetIso: string, from: Date) {
  const target = new Date(targetIso);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(iso: string | null) {
  if (!iso) return "N/D";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/D";
  return d.toLocaleDateString("it-IT");
}

function formatCurrency(value: number) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function getCollectedAmount(payment: Payment) {
  if (payment.collected) return payment.amount ?? 0;
  if (payment.partial) return payment.collectedAmount ?? 0;
  return 0;
}

export default function CollectionsOverview() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CollectionsRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CollectionsRow["status"]>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [windowDays, setWindowDays] = useState<7 | 15 | 30>(7);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [orders, customers, jobs, allPayments] = await Promise.all([
          jobOrderAPI.list(),
          customerAPI.list(),
          jobAPI.list(),
          paymentAPI.listAll(),
        ]);

        const paymentsByJobId = new Map<string, typeof allPayments>();
        for (const payment of allPayments) {
          const list = paymentsByJobId.get(payment.jobId);
          if (list) list.push(payment);
          else paymentsByJobId.set(payment.jobId, [payment]);
        }

        const customersById = new Map<string, Customer>(customers.map((c) => [c.id, c]));
        const ordersById = new Map<string, JobOrder>(orders.map((o) => [o.id, o]));
        const today = new Date();

        const mappedRows: CollectionsRow[] = [];
        for (const job of jobs) {
          const order = ordersById.get(job.jobOrderId);
          if (!order) continue;
          for (const payment of paymentsByJobId.get(job.id) ?? []) {
            const amount = payment.amount ?? 0;
            const collectedAmount = getCollectedAmount(payment);
            const residualAmount = Math.max(0, amount - collectedAmount);
            const referenceDate = job.plannedDate ?? payment.createdAt ?? order.createdAt ?? null;

            let status: CollectionsRow["status"] = "senza_data";
            if (residualAmount <= 0) {
              status = "incassato";
            } else if (!referenceDate) {
              status = "senza_data";
            } else {
              const days = dateDiffInDays(referenceDate, today);
              if (days === null) status = "senza_data";
              else if (days < 0) status = "insoluto";
              else if (days <= windowDays) status = "in_scadenza";
              else status = "futuro";
            }

            mappedRows.push({
              id: payment.id,
              jobId: job.id,
              jobOrderId: order.id,
              customerId: order.customerId ?? null,
              customerName: customersById.get(order.customerId)?.name ?? "Cliente non trovato",
              orderCode: order.code,
              label: payment.label,
              plannedDate: referenceDate,
              amount,
              collectedAmount,
              residualAmount,
              status,
            });
          }
        }

        setRows(mappedRows);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [windowDays]);

  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.customerId) map.set(row.customerId, row.customerName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        const textOk =
          !q ||
          row.customerName.toLowerCase().includes(q) ||
          row.orderCode.toLowerCase().includes(q) ||
          row.label.toLowerCase().includes(q);
        const statusOk = statusFilter === "all" || row.status === statusFilter;
        const customerOk =
          customerFilter === "all" || (row.customerId !== null && row.customerId === customerFilter);
        return textOk && statusOk && customerOk;
      })
      .sort((a, b) => {
        if (!a.plannedDate && !b.plannedDate) return b.residualAmount - a.residualAmount;
        if (!a.plannedDate) return 1;
        if (!b.plannedDate) return -1;
        return new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime();
      });
  }, [rows, search, statusFilter, customerFilter]);

  const kpi = useMemo(() => {
    const insoluti = rows.filter((r) => r.status === "insoluto");
    const inScadenza = rows.filter((r) => r.status === "in_scadenza");
    const futuri = rows.filter((r) => r.status === "futuro");
    return {
      insolutiCount: insoluti.length,
      insolutiAmount: insoluti.reduce((s, r) => s + r.residualAmount, 0),
      inScadenzaCount: inScadenza.length,
      inScadenzaAmount: inScadenza.reduce((s, r) => s + r.residualAmount, 0),
      futuriCount: futuri.length,
      futuriAmount: futuri.reduce((s, r) => s + r.residualAmount, 0),
      totaleDaIncassare: rows.reduce((s, r) => s + r.residualAmount, 0),
    };
  }, [rows]);

  const statusBadge = (status: CollectionsRow["status"]) => {
    if (status === "insoluto") return "bg-red-100 text-red-700";
    if (status === "in_scadenza") return "bg-amber-100 text-amber-700";
    if (status === "futuro") return "bg-blue-100 text-blue-700";
    if (status === "incassato") return "bg-green-100 text-green-700";
    return "bg-gray-100 text-gray-700";
  };

  const statusLabel = (status: CollectionsRow["status"]) => {
    if (status === "insoluto") return "Insoluto";
    if (status === "in_scadenza") return `In scadenza <= ${windowDays}g`;
    if (status === "futuro") return "Scadenza futura";
    if (status === "incassato") return "Incassato";
    return "Senza data";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Riepilogo incassi"
        description="Scadenze, insoluti e importi da incassare."
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <div className={`p-4 ${surfaceCardClass}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Totale da incassare
          </p>
          <p className="text-xl font-semibold">{formatCurrency(kpi.totaleDaIncassare)}</p>
        </div>
        <div className={`p-4 ${surfaceCardClass}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Insoluti
          </p>
          <p className="text-xl font-semibold text-red-700">{kpi.insolutiCount}</p>
          <p className="text-xs text-red-700">{formatCurrency(kpi.insolutiAmount)}</p>
        </div>
        <div className={`p-4 ${surfaceCardClass}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            In scadenza
          </p>
          <p className="text-xl font-semibold text-amber-700">{kpi.inScadenzaCount}</p>
          <p className="text-xs text-amber-700">{formatCurrency(kpi.inScadenzaAmount)}</p>
        </div>
        <div className={`p-4 ${surfaceCardClass}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Futuri
          </p>
          <p className="text-xl font-semibold text-blue-700">{kpi.futuriCount}</p>
          <p className="text-xs text-blue-700">{formatCurrency(kpi.futuriAmount)}</p>
        </div>
      </div>

      <section className={`space-y-3 p-4 sm:p-5 ${surfaceCardClass}`}>
        <div className={filterGridClass + " lg:grid-cols-4"}>
          <input
            className={`md:col-span-2 ${inputFieldClass}`}
            placeholder="Cerca cliente, commessa o etichetta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={selectFieldClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | CollectionsRow["status"])}
          >
            <option value="all">Stato: tutti</option>
            <option value="insoluto">Solo insoluti</option>
            <option value="in_scadenza">Solo in scadenza</option>
            <option value="futuro">Solo futuri</option>
            <option value="incassato">Solo incassati</option>
            <option value="senza_data">Senza data</option>
          </select>
          <select
            className={selectFieldClass}
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="all">Cliente: tutti</option>
            {customerOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={windowDays === 7 ? "secondary" : "neutral"}
            onClick={() => setWindowDays(7)}
            className="text-sm font-medium"
          >
            Finestra 7 giorni
          </Button>
          <Button
            type="button"
            variant={windowDays === 15 ? "secondary" : "neutral"}
            onClick={() => setWindowDays(15)}
            className="text-sm font-medium"
          >
            Finestra 15 giorni
          </Button>
          <Button
            type="button"
            variant={windowDays === 30 ? "secondary" : "neutral"}
            onClick={() => setWindowDays(30)}
            className="text-sm font-medium"
          >
            Finestra 30 giorni
          </Button>
        </div>

        <div className={mobileCardListClass}>
          {filteredRows.map((row) => (
            <DataCard
              key={row.id}
              title={row.customerName}
              subtitle={`${row.orderCode} · ${row.label}`}
              badge={
                <span className={`text-xs px-2 py-1 rounded-full ${statusBadge(row.status)}`}>
                  {statusLabel(row.status)}
                </span>
              }
              rows={[
                { label: "Data", value: formatDate(row.plannedDate) },
                {
                  label: "Residuo",
                  value: formatCurrency(row.residualAmount),
                  valueClassName: "font-bold text-slate-900",
                },
                {
                  label: "Previsto / incassato",
                  value: `${formatCurrency(row.amount)} / ${formatCurrency(row.collectedAmount)}`,
                },
              ]}
              footer={
                <Link
                  to={`/backoffice/orders/${row.jobOrderId}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
                >
                  Apri ordine
                </Link>
              }
            />
          ))}
          {!loading && filteredRows.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">
              Nessun risultato con i filtri selezionati.
            </p>
          )}
        </div>

        <div className={tableWrapperClass}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                <th className="py-2 text-left">Cliente</th>
                <th className="py-2 text-left">Commessa</th>
                <th className="py-2 text-left">Pagamento</th>
                <th className="py-2 text-left">Data riferimento</th>
                <th className="py-2 text-left">Residuo</th>
                <th className="py-2 text-left">Stato</th>
                <th className="py-2 text-left">Azione</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{row.customerName}</td>
                  <td className="py-2">{row.orderCode}</td>
                  <td className="py-2">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-gray-500">
                      Previsto: {formatCurrency(row.amount)} - Incassato: {formatCurrency(row.collectedAmount)}
                    </p>
                  </td>
                  <td className="py-2">{formatDate(row.plannedDate)}</td>
                  <td className="py-2 font-semibold">{formatCurrency(row.residualAmount)}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-1 rounded ${statusBadge(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="py-2">
                    <Link
                      to={`/backoffice/orders/${row.jobOrderId}`}
                      className="inline-flex items-center justify-center rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-dark"
                    >
                      Apri ordine
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length === 0 && (
          <p className="hidden text-sm text-gray-500 py-4 text-center md:block">
            Nessun risultato con i filtri selezionati.
          </p>
        )}
        {loading && (
          <p className="text-sm text-gray-500 py-4 text-center">Caricamento riepilogo...</p>
        )}
      </section>
    </div>
  );
}
