import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ExternalLink, Loader2, X } from "lucide-react";
import {
  libroneImportAPI,
  type LibronePendingRow,
} from "@/api/libroneImport";
import { formatDeliveryWeek } from "@/utils/officeElenco";
import { DataCard } from "@/components/layout/DataCard";
import {
  PageHeader,
  mobileCardListClass,
  surfaceCardClass,
  tableWrapperClass,
} from "@/components/layout/PageChrome";

function pendingNome(row: LibronePendingRow): string {
  return row.contactName?.trim() || row.customerName || "—";
}

function pendingFlags(row: LibronePendingRow): string {
  const flags: string[] = [];
  if (row.hasControcasse) flags.push("C");
  if (row.hasMontaggio) flags.push("M");
  return flags.length > 0 ? flags.join(" · ") : "—";
}

function PendingRowActions({
  row,
  onDismiss,
}: {
  row: LibronePendingRow;
  onDismiss: (orderId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to={`/backoffice/customers/${row.customerId}?editAnagrafica=1`}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-none sm:py-1.5 sm:text-xs"
      >
        <ExternalLink size={14} />
        Apri cliente
      </Link>
      <button
        type="button"
        title="Rimuovi dall'elenco (anagrafica già ok)"
        onClick={() => onDismiss(row.orderId)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:min-h-0 sm:min-w-0 sm:border-0 sm:p-1.5"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function PendingMobileCard({
  row,
  onDismiss,
}: {
  row: LibronePendingRow;
  onDismiss: (orderId: string) => void;
}) {
  return (
    <DataCard
      title={row.code}
      subtitle={pendingNome(row)}
      badge={
        pendingFlags(row) !== "—" ? (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {pendingFlags(row)}
          </span>
        ) : undefined
      }
      rows={[
        {
          label: "Sett.",
          value:
            formatDeliveryWeek(row.deliveryWeekYear, row.deliveryWeekNum) || "—",
        },
        { label: "Colore", value: row.productColor || "—" },
        {
          label: "Pz",
          value: row.pieceCount ?? "—",
          valueClassName: "tabular-nums",
        },
        { label: "Destinazione", value: row.destinationCity || "—" },
        {
          label: "Note",
          value: row.notesBackoffice || "—",
          valueClassName: "text-left text-xs font-normal text-slate-600",
        },
      ]}
      footer={<PendingRowActions row={row} onDismiss={onDismiss} />}
    />
  );
}

export default function LibronePending() {
  const [rows, setRows] = useState<LibronePendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await libroneImportAPI.listPending();
      setRows(data);
    } catch (err) {
      console.error(err);
      toast.error("Errore caricamento elenco");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDismiss = async (orderId: string) => {
    try {
      await libroneImportAPI.dismissPending(orderId);
      setRows((prev) => prev.filter((r) => r.orderId !== orderId));
      toast.success("Rimossa dall'elenco");
    } catch (err) {
      console.error(err);
      toast.error("Errore");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nuove commesse da completare"
        description="Commesse nuove importate dal librone (sezioni 1–5). I montaggi da completare restano nella sezione cantiere dell'elenco. Qui inserisci telefono e anagrafica cliente."
        actions={
          <Link
            to="/backoffice/office"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            ← Elenco ufficio
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="animate-spin" size={20} />
          Caricamento…
        </div>
      ) : rows.length === 0 ? (
        <div className={`${surfaceCardClass} p-8 text-center text-slate-600`}>
          Nessuna commessa in attesa di anagrafica.
        </div>
      ) : (
        <>
          <div className={`${tableWrapperClass} ${surfaceCardClass}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Comm</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Sett.</th>
                  <th className="px-3 py-2">Colore</th>
                  <th className="px-3 py-2 text-right">Pz</th>
                  <th className="px-3 py-2">Destinazione</th>
                  <th className="px-3 py-2">Note ufficio</th>
                  <th className="px-3 py-2 text-center">C</th>
                  <th className="px-3 py-2 text-center">M</th>
                  <th className="px-3 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.orderId}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">
                      {row.code}
                    </td>
                    <td className="px-3 py-2">{pendingNome(row)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDeliveryWeek(
                        row.deliveryWeekYear,
                        row.deliveryWeekNum
                      ) || "—"}
                    </td>
                    <td className="px-3 py-2">{row.productColor || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.pieceCount ?? "—"}
                    </td>
                    <td className="px-3 py-2">{row.destinationCity || "—"}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-600">
                      {row.notesBackoffice || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.hasControcasse ? "C" : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.hasMontaggio ? "M" : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <PendingRowActions row={row} onDismiss={handleDismiss} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={mobileCardListClass}>
            {rows.map((row) => (
              <PendingMobileCard
                key={row.orderId}
                row={row}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
