import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Save,
  X,
  Edit,
  Trash2,
  Calendar,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type {
  Documento,
  Job,
  JobOrder,
  OrderPayment,
  Payment,
  Worker,
} from "@/types";
import { STATUS_CONFIG, getJobDisplayStatus } from "@/config/statusConfig";
import { summarizeOrderFieldJobs } from "@/utils/officeBoard";
import { isOrderDocumentVisibleOnField } from "@/utils/documenti";
import {
  isOrderPaymentVisibleOnField,
  paymentAmountClass,
} from "@/utils/payments";
import {
  JOB_TITLE_SELECT_OPTIONS,
  jobTitleDisplay,
} from "@/config/jobTitles";
import {
  surfaceCardClass,
  modalBackdropClass,
  modalPanelClass,
  inputFieldClass,
  selectFieldClass,
} from "@/components/layout/PageChrome";
import { formatDateTime } from "@/utils/date";

type Props = {
  order: JobOrder;
  jobs: Job[];
  workers: Worker[];
  sortedJobs: Job[];
  lastCreatedJobId: string | null;
  notes: string;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
  orderPayments: OrderPayment[];
  documenti: Documento[];
  allPayments: Payment[];
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  showForm: boolean;
  formData: Partial<Job>;
  editingId: string | null;
  openConfirm: boolean;
  inheritPaymentIds: string[];
  onInheritPaymentIdsChange: (ids: string[]) => void;
  onOpenNewJob: () => void;
  onCloseForm: () => void;
  onSaveJob: () => void;
  onFormDataChange: (data: Partial<Job>) => void;
  onEditJob: (job: Job) => void;
  onDeleteJob: (jobId: string) => void;
  onConfirmDelete: () => void;
  setOpenConfirm: React.Dispatch<React.SetStateAction<boolean>>;
};

function defaultInheritIds(
  title: string | undefined,
  payments: OrderPayment[]
): string[] {
  if (title === "consegna_controcasse") return [];
  return payments.map((p) => p.id);
}

export default function OrderFieldTab({
  order,
  workers,
  sortedJobs,
  lastCreatedJobId,
  notes,
  onNotesChange,
  onSaveNotes,
  orderPayments,
  documenti,
  allPayments,
  totalExpected,
  totalCollected,
  totalPending,
  showForm,
  formData,
  editingId,
  openConfirm,
  inheritPaymentIds,
  onInheritPaymentIdsChange,
  onOpenNewJob,
  onCloseForm,
  onSaveJob,
  onFormDataChange,
  onEditJob,
  onDeleteJob,
  onConfirmDelete,
  setOpenConfirm,
}: Props) {
  const navigate = useNavigate();
  const fieldSummary = summarizeOrderFieldJobs(sortedJobs, order.id);
  const openCount = fieldSummary.openField.length;
  const totalField = fieldSummary.allField.length;
  const visibleOrderDocuments = documenti.filter(isOrderDocumentVisibleOnField);
  const visibleOrderPayments = orderPayments.filter(isOrderPaymentVisibleOnField);

  useEffect(() => {
    if (!showForm || editingId) return;
    if (!formData.title) {
      onInheritPaymentIdsChange([]);
      return;
    }
    onInheritPaymentIdsChange(
      defaultInheritIds(formData.title, visibleOrderPayments)
    );
    // Solo al cambio tipologia / apertura form: non reagire a ogni toggle checkbox.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intenzionale
  }, [showForm, editingId, formData.title]);

  const toggleInheritPayment = (id: string) => {
    if (inheritPaymentIds.includes(id)) {
      onInheritPaymentIdsChange(inheritPaymentIds.filter((x) => x !== id));
    } else {
      onInheritPaymentIdsChange([...inheritPaymentIds, id]);
    }
  };

  return (
    <div className="space-y-5">
      <div className={`${surfaceCardClass} p-4 md:p-6`}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Interventi cantiere</h2>
            <p className="text-sm text-slate-600">
              Consegna, montaggio e attività in cantiere collegate a questa commessa.
              {totalField > 0 && openCount === 0 && (
                <>
                  {" "}
                  <span className="font-medium text-slate-700">
                    Storico: {totalField} intervent
                    {totalField === 1 ? "o" : "i"} conclus
                    {totalField === 1 ? "o" : "i"}.
                  </span>
                </>
              )}
              {totalField > 0 && openCount > 0 && (
                <>
                  {" "}
                  <span className="font-medium text-slate-700">
                    {openCount} apert{openCount === 1 ? "o" : "i"}
                    {totalField !== openCount ? ` su ${totalField}` : ""}
                  </span>
                  {fieldSummary.assistenza.length > 0 && (
                    <span className="text-slate-500">
                      {" "}
                      · {fieldSummary.assistenza.length} assistenza
                      {fieldSummary.assistenza.length === 1 ? "" : " post-vendita"}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={onOpenNewJob}
            className="inline-flex w-full items-center gap-2 py-2.5 font-semibold sm:w-auto"
          >
            <Plus size={16} />
            Nuovo intervento
          </Button>
        </div>

        {sortedJobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-600">
            Nessun intervento. Quando il prodotto è pronto, crea consegna o montaggio qui.
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-2">
              {sortedJobs.map((j) => (
                <JobMobileCard
                  key={j.id}
                  job={j}
                  workers={workers}
                  highlight={lastCreatedJobId === j.id}
                  onOpen={() => navigate(`/backoffice/jobs/${j.id}`)}
                  onEdit={() => onEditJob(j)}
                  onDelete={() => onDeleteJob(j.id)}
                />
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="p-3">Data</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Squadra</th>
                    <th className="p-3">Stato</th>
                    <th className="p-3">Note</th>
                    <th className="p-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedJobs.map((j) => (
                    <JobTableRow
                      key={j.id}
                      job={j}
                      workers={workers}
                      highlight={lastCreatedJobId === j.id}
                      onOpen={() => navigate(`/backoffice/jobs/${j.id}`)}
                      onEdit={() => onEditJob(j)}
                      onDelete={() => onDeleteJob(j.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className={`${surfaceCardClass} p-4 md:p-6`}>
        <h2 className="mb-1 text-lg font-bold text-slate-900">Note per il montatore</h2>
        <p className="mb-3 text-sm text-slate-600">
          Visibili in cantiere sugli interventi (diverse dalle note ufficio in elenco).
        </p>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Istruzioni per chi va in cantiere…"
          className={`${inputFieldClass} mb-3`}
          rows={4}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onNotesChange(order.notes ?? "")}
            className="gap-2"
          >
            <X size={16} />
            Annulla
          </Button>
          <Button type="button" variant="primary" onClick={onSaveNotes} className="gap-2">
            <Save size={16} />
            Salva note
          </Button>
        </div>
      </div>

      {allPayments.length > 0 && (
        <details className={`${surfaceCardClass} p-4 md:p-6`}>
          <summary className="cursor-pointer text-lg font-bold text-slate-900">
            Pagamenti sui interventi ({allPayments.length})
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            Dettaglio per uscita (può ripetere voci se ereditate su più interventi). I
            totali sotto usano il piano commessa, senza doppi conteggi.
          </p>
          <ul className="mt-3 space-y-2">
            {allPayments.map((p) => {
              const job = sortedJobs.find((j) => j.id === p.jobId);
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {p.label} —{" "}
                  <span className={`font-bold ${paymentAmountClass(p)}`}>
                    {p.amount.toFixed(2)} €
                  </span>
                  {job && (
                    <span className="text-slate-500">
                      {" "}
                      · {jobTitleDisplay(job.title)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
            <div>Previsto: {totalExpected.toFixed(2)} €</div>
            <div className="text-green-700">Incassato: {totalCollected.toFixed(2)} €</div>
            <div className={totalPending > 0 ? "font-bold text-red-700" : "font-bold text-green-700"}>
              Residuo: {totalPending.toFixed(2)} €
            </div>
          </div>
        </details>
      )}

      {showForm && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-3 p-5 sm:p-6`}>
            <h2 className="text-lg font-bold text-slate-900">
              {editingId ? "Modifica intervento" : "Nuovo intervento"}
            </h2>
            {!editingId && (
              <p className="text-sm text-slate-600">
                Crea consegna o montaggio per mandare la commessa in cantiere.
              </p>
            )}

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipologia *
            </label>
            <select
              value={formData.title ?? ""}
              onChange={(e) =>
                onFormDataChange({
                  ...formData,
                  title: e.target.value as Job["title"],
                })
              }
              className={`${selectFieldClass} w-full`}
            >
              <option value="">Seleziona tipo</option>
              {JOB_TITLE_SELECT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note intervento
            </label>
            <textarea
              value={formData.notes ?? ""}
              onChange={(e) =>
                onFormDataChange({ ...formData, notes: e.target.value })
              }
              className={inputFieldClass}
              rows={3}
            />

            {!editingId &&
              (visibleOrderPayments.length > 0 || visibleOrderDocuments.length > 0) && (
              <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-sm text-sky-950">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                  Da commessa in cantiere
                </p>
                {visibleOrderPayments.length > 0 ? (
                  <>
                    <p className="text-xs text-sky-900/80">
                      Seleziona i pagamenti da portare su <strong>questo</strong> intervento.
                      Deseleziona quelli che non si incassano qui
                      {formData.title === "consegna_controcasse"
                        ? " (controcasse: di default nessuno)."
                        : "."}
                    </p>
                    <ul className="space-y-1.5">
                      {visibleOrderPayments.map((p) => {
                        const checked = inheritPaymentIds.includes(p.id);
                        return (
                          <li key={p.id}>
                            <label className="flex cursor-pointer items-start gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                checked={checked}
                                onChange={() => toggleInheritPayment(p.id)}
                              />
                              <span>
                                <span className="font-medium text-sky-950">{p.label}</span>
                                {" — "}
                                {p.amount.toLocaleString("it-IT", {
                                  style: "currency",
                                  currency: "EUR",
                                })}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[11px] text-sky-800/70">
                      {inheritPaymentIds.length} di {visibleOrderPayments.length} selezionat
                      {inheritPaymentIds.length === 1 ? "o" : "i"}
                    </p>
                  </>
                ) : null}
                {visibleOrderDocuments.length > 0 && (
                  <>
                    <p className="text-xs text-sky-900/80">
                      Allegati non nascosti in commessa restano disponibili in cantiere:
                    </p>
                    <ul className="space-y-0.5 text-xs">
                      {visibleOrderDocuments.map((doc) => (
                        <li key={doc.id}>{doc.fileName}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCloseForm}>
                Annulla
              </Button>
              <Button type="button" variant="primary" onClick={onSaveJob}>
                Salva
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={openConfirm}
        setOpen={setOpenConfirm}
        title="Elimina intervento"
        description="Sei sicuro? L'azione non può essere annullata."
        confirmText="Elimina"
        cancelText="Annulla"
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}

function JobMobileCard({
  job,
  workers,
  highlight,
  onOpen,
  onEdit,
  onDelete,
}: {
  job: Job;
  workers: Worker[];
  highlight: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const st = getJobDisplayStatus(job.persistedStatus ?? job.status, job.plannedDate);
  const cfg = STATUS_CONFIG[st];

  return (
    <div
      className={`cursor-pointer rounded-xl border p-3 shadow-sm ${
        highlight ? "animate-pulse border-green-300 bg-green-50" : "border-slate-200 bg-white"
      }`}
      onClick={onOpen}
    >
      <div className="flex justify-between gap-2">
        <span className="text-sm text-slate-600">
          {job.plannedDate ? formatDateTime(job.plannedDate) : "—"}
        </span>
        <span className="font-semibold text-sm">{jobTitleDisplay(job.title)}</span>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        <Users size={12} className="inline mr-1" />
        {job.assignedWorkers?.length
          ? job.assignedWorkers
              .map((id) => workers.find((w) => w.id === id)?.name)
              .join(", ")
          : "—"}
      </div>
      <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs ${cfg?.color ?? ""}`}>
        {cfg?.label ?? st}
      </span>
      <div className="mt-2 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onEdit} className="p-1 text-yellow-600">
          <Edit size={16} />
        </button>
        <button type="button" onClick={onDelete} className="p-1 text-red-600">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function JobTableRow({
  job,
  workers,
  highlight,
  onOpen,
  onEdit,
  onDelete,
}: {
  job: Job;
  workers: Worker[];
  highlight: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const st = getJobDisplayStatus(job.persistedStatus ?? job.status, job.plannedDate);
  const cfg = STATUS_CONFIG[st];

  return (
    <tr
      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
        highlight ? "bg-green-50" : ""
      }`}
      onClick={onOpen}
    >
      <td className="p-3">
        <Calendar size={14} className="mr-1 inline opacity-60" />
        {job.plannedDate ? formatDateTime(job.plannedDate) : "—"}
      </td>
      <td className="p-3">{jobTitleDisplay(job.title)}</td>
      <td className="p-3 text-slate-600">
        {job.assignedWorkers?.length
          ? job.assignedWorkers
              .map((id) => workers.find((w) => w.id === id)?.name)
              .join(", ")
          : "—"}
      </td>
      <td className="p-3">
        <span className={`rounded px-2 py-0.5 text-xs ${cfg?.color ?? ""}`}>
          {cfg?.label ?? st}
        </span>
      </td>
      <td className="max-w-[200px] truncate p-3 text-slate-600">{job.notes || "—"}</td>
      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onEdit} className="p-1 text-yellow-600">
          <Edit size={16} />
        </button>
        <button type="button" onClick={onDelete} className="p-1 text-red-600">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}
