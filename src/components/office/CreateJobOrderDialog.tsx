import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import CustomerPicker from "@/components/customers/CustomerPicker";
import { jobOrderAPI } from "@/api/jobOrders";
import { orderPaymentAPI } from "@/api/orderPayments";
import type { Customer, JobOrder } from "@/types";
import {
  inputFieldClass,
  modalBackdropClass,
  modalPanelClass,
} from "@/components/layout/PageChrome";
import { officeStatusLabel } from "@/config/officeWorkflow";
import { customerDestinationCity, customerElencoFieldsFromAnagrafica } from "@/utils/customerCity";
import { deliveryWeekFromDate, formatDeliveryWeekInput } from "@/utils/officeElenco";
import { parseMoneyAmount } from "@/utils/payments";

export type CreateJobOrderDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (order: JobOrder) => void;
  /** @deprecated La ricerca cliente usa l'API; prop mantenuta per compatibilità. */
  customers?: Customer[];
  officeWorkflowEnabled: boolean;
  /** Cliente già scelto (es. da scheda cliente) */
  presetCustomer?: Customer | null;
  title?: string;
};

type PaymentDraft = {
  id: string;
  label: string;
  amount: string;
  collected: boolean;
};

function newPaymentDraft(label = "Acconto"): PaymentDraft {
  return {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label,
    amount: "",
    collected: false,
  };
}

function parseAmount(value: string): number | null {
  const n = parseMoneyAmount(value);
  return n != null && n > 0 ? n : null;
}

export default function CreateJobOrderDialog({
  open,
  onClose,
  onCreated,
  officeWorkflowEnabled,
  presetCustomer,
  title,
}: CreateJobOrderDialogProps) {
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [hasMeasurements, setHasMeasurements] = useState(true);
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDraft[]>([]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [productColor, setProductColor] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [pieceCount, setPieceCount] = useState("");
  const [deliveryWeekText, setDeliveryWeekText] = useState("");
  const [notesBackoffice, setNotesBackoffice] = useState("");
  const [hasControcasse, setHasControcasse] = useState(false);
  const [hasMontaggio, setHasMontaggio] = useState(false);
  const [hasEneaPratica, setHasEneaPratica] = useState(false);
  const [saving, setSaving] = useState(false);

  const lockedCustomer = presetCustomer ?? null;

  const prefillFromCustomer = useCallback(
    (customer: Customer) => {
      setAddress(customer.address?.trim() ?? "");
      setDestinationCity(customerDestinationCity(customer));
      const customerNotes = customer.notes?.trim() ?? "";
      if (officeWorkflowEnabled) {
        setNotesBackoffice(customerNotes);
      } else {
        setNotes(customerNotes);
      }
    },
    [officeWorkflowEnabled]
  );

  useEffect(() => {
    if (!open) return;
    setCode("");
    setHasMeasurements(true);
    setPaymentDrafts([]);
    setExpectedDeliveryDate("");
    setProductColor("");
    setPieceCount("");
    setDeliveryWeekText("");
    setHasControcasse(false);
    setHasMontaggio(false);
    setHasEneaPratica(false);
    setMapsUrl("");
    if (lockedCustomer) {
      setSelectedCustomer(lockedCustomer);
      prefillFromCustomer(lockedCustomer);
    } else {
      setSelectedCustomer(null);
      setAddress("");
      setDestinationCity("");
      setNotes("");
      setNotesBackoffice("");
    }
  }, [open, lockedCustomer, prefillFromCustomer]);

  const updatePayment = (id: string, patch: Partial<PaymentDraft>) => {
    setPaymentDrafts((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const activeCustomer = lockedCustomer ?? selectedCustomer;
  const anagraficaFields = customerElencoFieldsFromAnagrafica(activeCustomer);
  const suggestedDestination = customerDestinationCity(activeCustomer);

  const handleCustomerChange = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    if (customer) prefillFromCustomer(customer);
  };

  const handleSubmit = async () => {
    const customer = lockedCustomer ?? selectedCustomer;
    if (!code.trim()) {
      toast.error("Inserisci il numero commessa");
      return;
    }
    if (!customer) {
      toast.error("Seleziona o crea un cliente");
      return;
    }
    if (!address.trim() && !mapsUrl.trim()) {
      toast.error("Indirizzo o link Maps obbligatorio");
      return;
    }

    const paymentRows = paymentDrafts
      .map((row) => {
        const amount = parseAmount(row.amount);
        if (amount == null) return null;
        return {
          label: row.label.trim() || "Pagamento",
          amount,
          collected: row.collected,
          partial: false,
          collectedAmount: row.collected ? amount : 0,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const invalidPayment = paymentDrafts.some(
      (row) => row.amount.trim() && parseAmount(row.amount) == null
    );
    if (invalidPayment) {
      toast.error("Controlla gli importi dei pagamenti");
      return;
    }

    setSaving(true);
    try {
      const deliveryIso = expectedDeliveryDate
        ? new Date(`${expectedDeliveryDate}T12:00:00`).toISOString()
        : undefined;
      const weekMatch = deliveryWeekText.trim().match(/^(\d{4})\/(\d{1,2})$/);
      const weekFromDate = expectedDeliveryDate
        ? deliveryWeekFromDate(expectedDeliveryDate)
        : null;
      const deliveryWeekYear = weekMatch
        ? Number.parseInt(weekMatch[1], 10)
        : weekFromDate?.year;
      const deliveryWeekNum = weekMatch
        ? Number.parseInt(weekMatch[2], 10)
        : weekFromDate?.week;
      const pieces = pieceCount.trim() ? Number.parseInt(pieceCount, 10) : undefined;

      const collectedTotal = paymentRows
        .filter((p) => p.collected)
        .reduce((sum, p) => sum + p.amount, 0);

      const created = await jobOrderAPI.create({
        code: code.trim(),
        customerId: customer.id,
        location: { address: address.trim(), mapsUrl: mapsUrl.trim() },
        ...(officeWorkflowEnabled
          ? { notesBackoffice: notesBackoffice.trim() || undefined }
          : { notes: notes.trim() || undefined }),
        ...(anagraficaFields.contactName
          ? { contactName: anagraficaFields.contactName }
          : {}),
        ...((destinationCity.trim() || anagraficaFields.destinationCity)
          ? {
              destinationCity: (
                destinationCity.trim() || anagraficaFields.destinationCity!
              ).toUpperCase(),
            }
          : {}),
        productColor: productColor.trim() || undefined,
        pieceCount: pieces != null && Number.isFinite(pieces) ? pieces : undefined,
        deliveryWeekYear,
        deliveryWeekNum,
        hasControcasse,
        hasMontaggio,
        hasEneaPratica,
        ...(officeWorkflowEnabled
          ? {
              hasMeasurements,
              expectedDeliveryDate: deliveryIso,
              ...(collectedTotal > 0
                ? {
                    depositAmount: collectedTotal,
                    depositCollectedAt: new Date().toISOString(),
                  }
                : {}),
            }
          : {}),
      });

      if (officeWorkflowEnabled && paymentRows.length > 0) {
        await orderPaymentAPI.bulkReplace(created.id, paymentRows);
      }

      const statusLabel = created.officeStatus
        ? officeStatusLabel(created.officeStatus)
        : null;
      toast.success(
        statusLabel
          ? `Commessa creata — stato: ${statusLabel}`
          : "Commessa creata"
      );
      onCreated(created);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Errore creazione commessa");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className={modalBackdropClass}>
      <div
        className={`${modalPanelClass} max-h-[90vh] max-w-lg space-y-3 overflow-y-auto p-5 sm:p-6`}
      >
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          {title ??
            (officeWorkflowEnabled ? "Nuova commessa ufficio" : "Nuova commessa")}
        </h2>

        {officeWorkflowEnabled && (
          <p className="text-sm text-slate-600">
            Cerca un cliente in anagrafica o creane uno nuovo. L&apos;acconto è
            opzionale: puoi aggiungere uno o più pagamenti (incassati o da incassare).
            La commessa compare subito in <strong>Ufficio</strong>.
          </p>
        )}

        <input
          type="text"
          placeholder="Numero commessa (es. 25-003) *"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={inputFieldClass}
        />

        <CustomerPicker
          locked={lockedCustomer}
          value={selectedCustomer}
          onChange={handleCustomerChange}
          disabled={saving}
        />

        {activeCustomer && (
          <p className="text-xs text-slate-500">
            Indirizzo, comune e note sotto sono precompilati dall&apos;anagrafica — modifica
            nel modal se per questa commessa sono diversi.
          </p>
        )}

        <input
          type="text"
          placeholder="Indirizzo lavoro *"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputFieldClass}
        />
        <input
          type="url"
          placeholder="Link Google Maps"
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          className={inputFieldClass}
        />

        {officeWorkflowEnabled && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeCustomer && (
                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <div>
                    Cliente:{" "}
                    <strong className="text-slate-800">
                      {anagraficaFields.contactName || activeCustomer.name}
                    </strong>
                  </div>
                  {(activeCustomer.phone || activeCustomer.email) && (
                    <div className="mt-1 text-xs text-slate-500">
                      {[activeCustomer.phone, activeCustomer.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Comune consegna (Destinazione)
                </label>
                <input
                  type="text"
                  placeholder={suggestedDestination || "Es. CAGLIARI"}
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className={inputFieldClass}
                />
                {suggestedDestination &&
                  destinationCity.trim().toUpperCase() !== suggestedDestination && (
                    <p className="mt-1 text-xs text-slate-500">
                      Da anagrafica: {suggestedDestination} — modifica se la consegna è altrove
                    </p>
                  )}
              </div>
              {expectedDeliveryDate && deliveryWeekText && (
                <p className="text-xs text-slate-600">
                  Settimana elenco iniziale: <strong>{deliveryWeekText}</strong>
                </p>
              )}
              <input
                type="text"
                placeholder="Colore"
                value={productColor}
                onChange={(e) => setProductColor(e.target.value)}
                className={inputFieldClass}
              />
              <input
                type="number"
                min={0}
                placeholder="Pezzi (Pz)"
                value={pieceCount}
                onChange={(e) => setPieceCount(e.target.value)}
                className={inputFieldClass}
              />
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
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={hasEneaPratica}
                  onChange={(e) => setHasEneaPratica(e.target.checked)}
                />
                <span>
                  Pratica ENEA (E)
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">
                    Promemoria post-montaggio per l&apos;altro ufficio
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
              <p className="text-sm font-semibold text-sky-900">Ingresso ufficio</p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasMeasurements}
                  onChange={(e) => setHasMeasurements(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  Misure definitive già in commessa
                  <span className="mt-0.5 block text-xs font-normal text-sky-800/80">
                    Parte in «Da mandare» con conferma già registrata. Deseleziona
                    solo se mancano ancora i rilievi.
                  </span>
                </span>
              </label>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Termine di consegna previsto
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setExpectedDeliveryDate(next);
                    const week = deliveryWeekFromDate(next);
                    setDeliveryWeekText(
                      week ? formatDeliveryWeekInput(week.year, week.week) : ""
                    );
                  }}
                  className={inputFieldClass}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Data concordata con il fornitore/cliente. Imposta anche la settimana
                  iniziale per l&apos;elenco ufficio
                  {deliveryWeekText ? ` (${deliveryWeekText})` : ""}.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Pagamenti commessa
                  </p>
                  <p className="text-xs text-slate-500">
                    Opzionale — aggiungi acconti già incassati o rate da incassare
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPaymentDrafts((prev) => [
                      ...prev,
                      newPaymentDraft(
                        prev.length === 0 ? "Acconto" : `Pagamento ${prev.length + 1}`
                      ),
                    ])
                  }
                  className="inline-flex shrink-0 items-center gap-1 text-xs"
                >
                  <Plus size={14} />
                  Aggiungi
                </Button>
              </div>

              {paymentDrafts.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nessun pagamento — va bene per ordini senza acconto.
                </p>
              ) : (
                <ul className="space-y-2">
                  {paymentDrafts.map((row) => (
                    <li
                      key={row.id}
                      className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_6rem_auto]"
                    >
                      <input
                        className={inputFieldClass}
                        placeholder="Descrizione"
                        value={row.label}
                        onChange={(e) =>
                          updatePayment(row.id, { label: e.target.value })
                        }
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        className={inputFieldClass}
                        placeholder="€"
                        value={row.amount}
                        onChange={(e) =>
                          updatePayment(row.id, { amount: e.target.value })
                        }
                      />
                      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start">
                        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={row.collected}
                            onChange={(e) =>
                              updatePayment(row.id, { collected: e.target.checked })
                            }
                          />
                          Incassato
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentDrafts((prev) =>
                              prev.filter((p) => p.id !== row.id)
                            )
                          }
                          className="text-slate-400 hover:text-red-600"
                          title="Rimuovi riga"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Note ufficio
              </label>
              <textarea
                placeholder="Compaiono nella colonna Note ufficio dell'elenco (non vanno in cantiere)"
                value={notesBackoffice}
                onChange={(e) => setNotesBackoffice(e.target.value)}
                className={inputFieldClass}
                rows={3}
              />
            </div>
          </>
        )}

        {!officeWorkflowEnabled && (
          <textarea
            placeholder="Note commessa"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputFieldClass}
            rows={3}
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
            className="py-2.5 text-sm font-medium"
          >
            Annulla
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="py-2.5 text-sm font-semibold"
          >
            {saving ? "Salvataggio…" : "Crea commessa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
