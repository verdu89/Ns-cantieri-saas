import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Save, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { jobOrderAPI } from "@/api/jobOrders";
import type { JobOrderUpdatePayload } from "@/api/jobOrders";
import type { Customer, Job, JobOrder } from "@/types";
import { customerElencoFieldsFromAnagrafica, customerDestinationCity } from "@/utils/customerCity";
import {
  OFFICE_STATUS_CONFIG,
} from "@/config/officeWorkflow";
import type { OfficePipelineStatus } from "@/config/officeWorkflow";
import {
  OFFICE_CLOSED_STATUS,
  OFFICE_UNSETTLED_STATUS,
  isOfficeAutoConcluded,
  isOfficeClosedStatus,
  isOfficeUnsettled,
} from "@/utils/officeBoard";
import OfficeStatusPipeline from "@/components/office/OfficeStatusPipeline";
import EneaPraticaPanel from "@/components/office/EneaPraticaPanel";
import {
  deliveryWeekFromDate,
  formatDeliveryWeek,
  formatDeliveryHistoryShift,
} from "@/utils/officeElenco";
import DeliveryWeekPicker, { type DeliveryWeekValue } from "@/components/office/DeliveryWeekPicker";
import DeliveryDeadlineSummary from "@/components/office/DeliveryDeadlineSummary";
import { surfaceCardClass, inputFieldClass } from "@/components/layout/PageChrome";
import { formatDateTime } from "@/utils/date";
import { parseHttpErrorMessage } from "@/utils/httpError";

type Props = {
  order: JobOrder;
  jobs: Job[];
  customer?: Customer | null;
  onUpdated: (order: JobOrder) => void;
};

export default function OfficeWorkflowPanel({ order, jobs, customer, onUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [deliveryDateChangeNote, setDeliveryDateChangeNote] = useState("");
  const suggestedDestination = customerDestinationCity(customer);
  const [destinationCity, setDestinationCity] = useState(
    order.destinationCity?.trim() || suggestedDestination
  );
  const [productColor, setProductColor] = useState(order.productColor ?? "");
  const [pieceCount, setPieceCount] = useState(
    order.pieceCount != null ? String(order.pieceCount) : ""
  );
  const [deliveryWeekYear, setDeliveryWeekYear] = useState(
    order.deliveryWeekYear != null ? String(order.deliveryWeekYear) : ""
  );
  const [deliveryWeekNum, setDeliveryWeekNum] = useState(
    order.deliveryWeekNum != null ? String(order.deliveryWeekNum) : ""
  );
  const [pickerWeek, setPickerWeek] = useState<DeliveryWeekValue>(
    order.deliveryWeekYear != null && order.deliveryWeekNum != null
      ? { year: order.deliveryWeekYear, week: order.deliveryWeekNum }
      : deliveryWeekFromDate(order.expectedDeliveryDate)
  );
  const [notesBackoffice, setNotesBackoffice] = useState(order.notesBackoffice ?? "");
  const [hasControcasse, setHasControcasse] = useState(Boolean(order.hasControcasse));
  const [hasMontaggio, setHasMontaggio] = useState(Boolean(order.hasMontaggio));

  useEffect(() => {
    setProductColor(order.productColor ?? "");
    setDestinationCity(
      order.destinationCity?.trim() || customerDestinationCity(customer) || ""
    );
    setPieceCount(order.pieceCount != null ? String(order.pieceCount) : "");
    setDeliveryWeekYear(order.deliveryWeekYear != null ? String(order.deliveryWeekYear) : "");
    setDeliveryWeekNum(order.deliveryWeekNum != null ? String(order.deliveryWeekNum) : "");
    setPickerWeek(
      order.deliveryWeekYear != null && order.deliveryWeekNum != null
        ? { year: order.deliveryWeekYear, week: order.deliveryWeekNum }
        : deliveryWeekFromDate(order.expectedDeliveryDate)
    );
    setNotesBackoffice(order.notesBackoffice ?? "");
    setHasControcasse(Boolean(order.hasControcasse));
    setHasMontaggio(Boolean(order.hasMontaggio));
  }, [order, customer]);

  const statusConfig =
    order.officeStatus && order.officeStatus in OFFICE_STATUS_CONFIG
      ? OFFICE_STATUS_CONFIG[order.officeStatus as keyof typeof OFFICE_STATUS_CONFIG]
      : null;

  const isClosed = isOfficeClosedStatus(order.officeStatus);
  const isUnsettled = isOfficeUnsettled(order);

  const persist = async (
    patch: Parameters<typeof jobOrderAPI.update>[1],
    options?: { silent?: boolean }
  ) => {
    setSaving(true);
    try {
      const updated = await jobOrderAPI.update(order.id, patch);
      onUpdated(updated);
      if (!options?.silent) toast.success("Aggiornato");
      return updated;
    } catch (err) {
      console.error(err);
      toast.error(parseHttpErrorMessage(err, "Errore salvataggio"));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = (
    officeStatus: OfficePipelineStatus,
    options?: { confirmClient?: boolean; clientConfirmedNote?: string | null }
  ) => {
    void persist(
      {
        officeStatus,
        ...(options?.confirmClient
          ? {
              clientConfirmedAt: new Date().toISOString(),
              ...(options.clientConfirmedNote !== undefined
                ? { clientConfirmedNote: options.clientConfirmedNote }
                : {}),
            }
          : {}),
      },
      { silent: true }
    ).then((updated) => {
      if (updated) toast.success("Aggiornato");
    });
  };

  const closeInOffice = () => {
    void persist({ officeStatus: OFFICE_CLOSED_STATUS }, { silent: true }).then(
      (updated) => {
        if (!updated) return;
        if (updated.officeStatus === OFFICE_UNSETTLED_STATUS) {
          toast.success("Commessa insoluta passata a Terminate ma insolute");
        } else if (updated.officeStatus === OFFICE_CLOSED_STATUS) {
          toast.success("Commessa passata a Terminate e consegnate");
        }
      }
    );
  };

  const reopenInOffice = () => {
    void persist({ officeStatus: "pronte_da_consegnare" });
  };

  const applyPickerWeek = (week: DeliveryWeekValue) => {
    setPickerWeek(week);
    if (week) {
      setDeliveryWeekYear(String(week.year));
      setDeliveryWeekNum(String(week.week));
    } else {
      setDeliveryWeekYear("");
      setDeliveryWeekNum("");
    }
  };

  const saveDeliveryWeekShift = async () => {
    const year = deliveryWeekYear.trim()
      ? Number.parseInt(deliveryWeekYear, 10)
      : null;
    const week = deliveryWeekNum.trim()
      ? Number.parseInt(deliveryWeekNum, 10)
      : null;
    if (year == null || week == null || !Number.isFinite(year) || !Number.isFinite(week)) {
      toast.error("Seleziona la settimana di consegna");
      return;
    }

    const sameWeek =
      order.deliveryWeekYear === year && order.deliveryWeekNum === week;
    if (sameWeek && !deliveryDateChangeNote.trim()) {
      toast.error("La settimana non è cambiata");
      return;
    }

    setSaving(true);
    try {
      const patch: JobOrderUpdatePayload = {
        deliveryWeekYear: year,
        deliveryWeekNum: week,
        deliveryDateChangeNote: deliveryDateChangeNote.trim() || null,
      };
      const updated = await jobOrderAPI.update(order.id, patch);
      onUpdated(updated);
      setDeliveryDateChangeNote("");
      toast.success("Settimana pianificata aggiornata");
    } catch (err) {
      console.error(err);
      toast.error("Errore salvataggio settimana");
    } finally {
      setSaving(false);
    }
  };

  const deliveryHistory = order.deliveryDateHistory ?? [];

  const saveElencoFields = () => {
    const pieces = pieceCount.trim()
      ? Number.parseInt(pieceCount, 10)
      : null;
    const anagrafica = customerElencoFieldsFromAnagrafica(customer);
    void persist({
      contactName: anagrafica.contactName,
      destinationCity:
        destinationCity.trim().toUpperCase() ||
        anagrafica.destinationCity ||
        null,
      productColor: productColor.trim() || null,
      pieceCount: pieces != null && Number.isFinite(pieces) ? pieces : null,
      deliveryWeekYear: deliveryWeekYear.trim()
        ? Number.parseInt(deliveryWeekYear, 10)
        : null,
      deliveryWeekNum: deliveryWeekNum.trim()
        ? Number.parseInt(deliveryWeekNum, 10)
        : null,
      notesBackoffice: notesBackoffice.trim() || undefined,
      hasControcasse,
      hasMontaggio,
    });
  };

  const confirmClient = (note?: string | null) => {
    void persist({
      clientConfirmedAt: new Date().toISOString(),
      clientConfirmedNote: note ?? null,
    });
  };

  const requestMeasurementsRevision = (note?: string | null) => {
    void persist({
      clientConfirmedAt: null,
      clientConfirmedNote: note?.trim() || null,
    }).then((updated) => {
      if (updated) toast.success("Revisione misure registrata");
    });
  };

  const saveClientConfirmNote = (note: string | null) => {
    void persist({ clientConfirmedNote: note });
  };

  const updateEneaPratica = (
    patch: Partial<
      Pick<
        JobOrder,
        | "hasEneaPratica"
        | "eneaPraticaPendingAt"
        | "eneaPraticaCompletedAt"
        | "eneaPraticaNote"
      >
    >
  ) => {
    void persist(patch);
  };

  return (
    <div className={`space-y-4 p-4 md:p-6 ${surfaceCardClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 md:text-xl">
            Gestione ufficio
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Stato produzione e pianificazione pre-cantiere
          </p>
        </div>
        {statusConfig && isClosed && (
          <span
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusConfig.accent}`}
          >
            {statusConfig.label}
          </span>
        )}
      </div>

      <OfficeStatusPipeline
        order={order}
        jobs={jobs}
        saving={saving}
        isClosed={isClosed}
        isUnsettled={isUnsettled}
        autoArchiveSuggested={isOfficeAutoConcluded(order, jobs)}
        onChangeStatus={changeStatus}
        onConfirmClient={confirmClient}
        onRequestMeasurementsRevision={requestMeasurementsRevision}
        onSaveClientConfirmNote={saveClientConfirmNote}
        onCloseInOffice={order.officeStatus && !isClosed ? closeInOffice : undefined}
        onReopenInOffice={isClosed ? reopenInOffice : undefined}
      />

      <EneaPraticaPanel order={order} saving={saving} onUpdate={updateEneaPratica} />

      {/* Campi elenco generale (come Access) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-800">Scheda commessa</div>
            <p className="text-xs text-slate-500">
              Settimana, colore, pezzi, note ufficio. Nome cliente e comune in
              intestazione; il comune si può correggere qui sotto.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={saving}
            onClick={saveElencoFields}
            className="inline-flex items-center gap-2 text-sm"
          >
            <Save size={16} />
            Salva scheda
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="text-xs font-medium text-slate-500">Settimana elenco</span>
            <div className="font-semibold text-slate-900">
              {pickerWeek
                ? formatDeliveryWeek(pickerWeek.year, pickerWeek.week)
                : "— non impostata"}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Modifica sotto con il calendario settimane quando sposti la consegna.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Comune consegna (Destinazione)
            </label>
            <input
              className={inputFieldClass}
              placeholder={suggestedDestination || "Es. CAGLIARI"}
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
            />
            {suggestedDestination && suggestedDestination !== destinationCity.trim().toUpperCase() && (
              <p className="mt-1 text-xs text-slate-500">
                Suggerito da anagrafica: {suggestedDestination}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Colore</label>
            <input
              className={inputFieldClass}
              placeholder="Es. Bianco Liscio"
              value={productColor}
              onChange={(e) => setProductColor(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Pezzi (Pz)</label>
            <input
              type="number"
              min={0}
              className={inputFieldClass}
              value={pieceCount}
              onChange={(e) => setPieceCount(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Note ufficio
            </label>
            <textarea
              className={inputFieldClass}
              rows={3}
              placeholder="Es. vetro da definire, CONTROCASSE DA CONSEGNARE, disponibilità cliente mar/gio pomeriggio…"
              value={notesBackoffice}
              onChange={(e) => setNotesBackoffice(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Compaiono nella colonna &quot;Note ufficio&quot; dell&apos;elenco. Quando sposti
              la settimana, annota qui le disponibilità del cliente.
            </p>
          </div>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasControcasse}
                onChange={(e) => setHasControcasse(e.target.checked)}
              />
              Controcasse (C)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasMontaggio}
                onChange={(e) => setHasMontaggio(e.target.checked)}
              />
              Montaggio (M)
            </label>
          </div>
        </div>
      </div>

      {/* Pianificazione consegna */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <label className="mb-2 block text-sm font-semibold text-slate-800">
          Pianificazione consegna
        </label>
        <div className="mb-4">
          <DeliveryDeadlineSummary order={order} />
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Il <strong>termine</strong> si imposta alla creazione commessa. Qui sposti la{" "}
          <strong>settimana elenco</strong> quando posticipi; disponibilità cliente e arrivi
          nelle note ufficio.
        </p>
        <DeliveryWeekPicker value={pickerWeek} onChange={applyPickerWeek} className="mb-4" />
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Nota spostamento (es. Posticipata da cliente — sett. 28)"
            value={deliveryDateChangeNote}
            onChange={(e) => setDeliveryDateChangeNote(e.target.value)}
            className={inputFieldClass}
          />
          <Button
            type="button"
            variant="primary"
            disabled={saving}
            onClick={() => void saveDeliveryWeekShift()}
            className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <Save size={16} />
            Salva settimana e nota
          </Button>
        </div>

        {deliveryHistory.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <History size={16} />
              Storico spostamenti settimana ({deliveryHistory.length})
            </div>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {deliveryHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="font-medium text-slate-800">
                    {formatDeliveryHistoryShift(entry)}
                  </div>
                  {entry.note ? (
                    <div className="mt-1 text-slate-600">— {entry.note}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-slate-400">
                    {formatDateTime(entry.changedAt)}
                    {entry.changedBy ? ` — ${entry.changedBy}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!order.officeStatus && !isClosed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Commessa storica (senza stato ufficio)</p>
          <p className="mt-1 text-amber-800">
            Scegli lo stato iniziale nel flusso sopra, poi salva scheda con settimana
            consegna, note e comune.
          </p>
        </div>
      )}
    </div>
  );
}
