import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { JobOrder } from "@/types";
import { formatDateTime } from "@/utils/date";
import { isOfficeClosedStatus } from "@/utils/officeBoard";
import {
  eneaInclusionPatch,
  isEneaPraticaCompleted,
  isEneaPraticaPending,
  isEneaPraticaScheduled,
} from "@/utils/eneaPratica";
import { inputFieldClass } from "@/components/layout/PageChrome";

type Props = {
  order: JobOrder;
  saving: boolean;
  onUpdate: (
    patch: Partial<
      Pick<
        JobOrder,
        | "hasEneaPratica"
        | "eneaPraticaPendingAt"
        | "eneaPraticaCompletedAt"
        | "eneaPraticaNote"
      >
    >
  ) => void | Promise<void>;
};

export default function EneaPraticaPanel({ order, saving, onUpdate }: Props) {
  const [completeNote, setCompleteNote] = useState("");

  const pending = isEneaPraticaPending(order);
  const completed = isEneaPraticaCompleted(order);
  const scheduled = isEneaPraticaScheduled(order);
  const archived = isOfficeClosedStatus(order.officeStatus);

  const toggleIncluded = (checked: boolean) => {
    if (checked) {
      void onUpdate(eneaInclusionPatch(order));
      return;
    }
    void onUpdate({
      hasEneaPratica: false,
      eneaPraticaPendingAt: null,
      eneaPraticaCompletedAt: null,
      eneaPraticaNote: null,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Pratica ENEA</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Promemoria per l&apos;ufficio che gestisce la pratica post-montaggio.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(order.hasEneaPratica)}
            disabled={saving}
            onChange={(e) => toggleIncluded(e.target.checked)}
          />
          Inclusa in commessa
        </label>
      </div>

      {!order.hasEneaPratica ? null : completed ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <Check size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Pratica ENEA completata</p>
              <p className="text-xs text-emerald-800/90">
                {formatDateTime(order.eneaPraticaCompletedAt!)}
              </p>
              {order.eneaPraticaNote ? (
                <p className="mt-2 text-xs leading-relaxed">{order.eneaPraticaNote}</p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() =>
              void onUpdate({
                eneaPraticaCompletedAt: null,
                eneaPraticaPendingAt: new Date().toISOString(),
              })
            }
            className="mt-3 py-2 text-xs"
          >
            Segna di nuovo da fare
          </Button>
        </div>
      ) : pending ? (
        <div className="space-y-3 rounded-lg border border-orange-300 bg-orange-50 px-3 py-3 text-sm text-orange-950">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Da fare</p>
              <p className="text-xs leading-relaxed opacity-90">
                Promemoria attivo dal{" "}
                {formatDateTime(order.eneaPraticaPendingAt!)}. Compare in Ufficio
                sotto «Pratiche ENEA da fare». Segna completata quando l&apos;altro
                ufficio ha gestito la pratica.
              </p>
            </div>
          </div>
          <div className="space-y-2 border-t border-orange-200/80 pt-2">
            <label className="block text-xs font-medium">Nota (facoltativa)</label>
            <textarea
              className={`${inputFieldClass} text-sm text-slate-900`}
              rows={2}
              placeholder="Es. inviata il 15/07, protocollo…"
              value={completeNote}
              onChange={(e) => setCompleteNote(e.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => {
                const note = completeNote.trim() || null;
                setCompleteNote("");
                void onUpdate({
                  eneaPraticaCompletedAt: new Date().toISOString(),
                  eneaPraticaNote: note,
                });
              }}
              className="py-2 text-xs font-semibold"
            >
              Segna completata
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
          <p className="text-xs leading-relaxed">
            {archived
              ? "Commessa archiviata: attiva il promemoria per comparire in «Pratiche ENEA da fare» nell'elenco ufficio."
              : scheduled
                ? "Prevista post-montaggio: il promemoria si attiva automaticamente al checkout montaggio completato."
                : "Attiva il promemoria quando serve ricordare la pratica all'altro ufficio."}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() =>
              void onUpdate({ eneaPraticaPendingAt: new Date().toISOString() })
            }
            className="mt-3 py-2 text-xs"
          >
            Attiva promemoria ora
          </Button>
        </div>
      )}
    </div>
  );
}
