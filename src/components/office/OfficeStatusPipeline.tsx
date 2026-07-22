import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, AlertTriangle, Archive } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Job, JobOrder } from "@/types";
import {
  OFFICE_PIPELINE_STATUSES,
  OFFICE_STATUS_CONFIG,
  type OfficePipelineStatus,
} from "@/config/officeWorkflow";
import {
  advanceStatusLabel,
  checkOfficeCloseTransition,
  checkOfficeStatusTransition,
  isClientConfirmed,
  isMeasurementsAwaitingDefinition,
  isMeasurementsRevisionPending,
  nextPipelineStatus,
  pipelineIndex,
  previousPipelineStatus,
  type StatusTransitionCheck,
} from "@/utils/officeStatusTransition";
import { isEneaPraticaPending } from "@/utils/eneaPratica";
import { jobTitleDisplay } from "@/config/jobTitles";
import { STATUS_CONFIG, getJobDisplayStatus } from "@/config/statusConfig";
import { formatDateTime } from "@/utils/date";
import {
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  inputFieldClass,
} from "@/components/layout/PageChrome";

type Props = {
  order: JobOrder;
  jobs: Job[];
  saving: boolean;
  isClosed?: boolean;
  isUnsettled?: boolean;
  autoArchiveSuggested?: boolean;
  onChangeStatus: (
    status: OfficePipelineStatus,
    options?: { confirmClient?: boolean; clientConfirmedNote?: string | null }
  ) => void | Promise<void>;
  onConfirmClient?: (note?: string | null) => void | Promise<void>;
  onRequestMeasurementsRevision?: (note: string | null) => void | Promise<void>;
  onSaveClientConfirmNote?: (note: string | null) => void | Promise<void>;
  onCloseInOffice?: () => void | Promise<void>;
  onReopenInOffice?: () => void | Promise<void>;
};

export default function OfficeStatusPipeline({
  order,
  jobs,
  saving,
  isClosed = false,
  isUnsettled = false,
  autoArchiveSuggested = false,
  onChangeStatus,
  onConfirmClient,
  onRequestMeasurementsRevision,
  onSaveClientConfirmNote,
  onCloseInOffice,
  onReopenInOffice,
}: Props) {
  const current = order.officeStatus as OfficePipelineStatus | undefined;
  const currentIndex = isClosed ? OFFICE_PIPELINE_STATUSES.length : pipelineIndex(current);
  const next = nextPipelineStatus(current);
  const prev = previousPipelineStatus(current);
  const [pending, setPending] = useState<{
    target: OfficePipelineStatus;
    check: StatusTransitionCheck;
  } | null>(null);
  const [pendingConfirmNote, setPendingConfirmNote] = useState("");
  const [confirmNoteDraft, setConfirmNoteDraft] = useState("");
  const [editingConfirmNote, setEditingConfirmNote] = useState(false);
  const [editConfirmNoteDraft, setEditConfirmNoteDraft] = useState("");
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");
  const [pendingEneaClose, setPendingEneaClose] = useState(false);
  const [blockedClose, setBlockedClose] = useState<ReturnType<
    typeof checkOfficeCloseTransition
  > | null>(null);

  const requestCloseInOffice = () => {
    if (!onCloseInOffice) return;
    const check = checkOfficeCloseTransition(jobs, order.id);
    if (!check.allowed) {
      setBlockedClose(check);
      return;
    }
    if (isEneaPraticaPending(order)) {
      setPendingEneaClose(true);
      return;
    }
    void onCloseInOffice();
  };

  const requestStatus = (target: OfficePipelineStatus) => {
    if (target === current) return;
    const check = checkOfficeStatusTransition(order, target);
    if (!check.allowed) return;
    if (check.warning) {
      setPending({ target, check });
      return;
    }
    void onChangeStatus(target);
  };

  const proceedPending = (confirmClient: boolean) => {
    if (!pending) return;
    const target = pending.target;
    const note = pendingConfirmNote.trim() || null;
    setPending(null);
    setPendingConfirmNote("");
    void onChangeStatus(
      target,
      confirmClient
        ? { confirmClient: true, clientConfirmedNote: note }
        : undefined
    );
  };

  const startEditConfirmNote = () => {
    setEditConfirmNoteDraft(order.clientConfirmedNote ?? "");
    setEditingConfirmNote(true);
  };

  const saveEditedConfirmNote = () => {
    if (!onSaveClientConfirmNote) return;
    const note = editConfirmNoteDraft.trim() || null;
    setEditingConfirmNote(false);
    void onSaveClientConfirmNote(note);
  };

  const submitMeasurementsRevision = () => {
    if (!onRequestMeasurementsRevision) return;
    const note = revisionNoteDraft.trim() || null;
    setRevisionModalOpen(false);
    setRevisionNoteDraft("");
    void onRequestMeasurementsRevision(note);
  };

  const awaitingDefinition = isMeasurementsAwaitingDefinition(order);
  const revisionPending = isMeasurementsRevisionPending(order);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Stato commessa</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Avanza un passo alla volta o tocca uno stato per spostarti (con controllo
              misure prima dell&apos;officina).
            </p>
          </div>
          {isClosed ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                isUnsettled
                  ? OFFICE_STATUS_CONFIG.conclusa_insoluta.accent
                  : OFFICE_STATUS_CONFIG.conclusa_ufficio.accent
              }`}
            >
              {isUnsettled
                ? OFFICE_STATUS_CONFIG.conclusa_insoluta.label
                : "Terminate e consegnate"}
            </span>
          ) : (
            current && (
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${OFFICE_STATUS_CONFIG[current].accent}`}
              >
                {OFFICE_STATUS_CONFIG[current].label}
              </span>
            )
          )}
        </div>

        {!current && !isClosed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900">
            <p className="font-medium">Commessa senza stato ufficio</p>
            <p className="mt-1 text-amber-800">
              Scegli da dove partire: di solito «Da definire» se mancano le misure, «Da
              mandare» se la commessa è già completa.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => requestStatus("da_definire")}
                className="text-xs"
              >
                Parti da Da definire
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => requestStatus("da_mandare_in_lavorazione")}
                className="text-xs"
              >
                Parti da Da mandare
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              {OFFICE_PIPELINE_STATUSES.map((status, index) => {
                const config = OFFICE_STATUS_CONFIG[status];
                const isCurrent = !isClosed && status === current;
                const isDone = isClosed || currentIndex > index;

                return (
                  <button
                    key={status}
                    type="button"
                    disabled={saving || isClosed || isCurrent}
                    onClick={() => requestStatus(status)}
                    className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      isCurrent
                        ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                        : isDone
                          ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
                          : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white"
                    }`}
                    title={config.description}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isCurrent
                          ? "bg-sky-600 text-white"
                          : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
                      }`}
                    >
                      {isDone ? <Check size={16} /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-900 sm:text-sm">
                        {config.shortLabel}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                        {config.description}
                      </span>
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                disabled
                className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  isClosed && isUnsettled
                    ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                    : "border-slate-200 bg-slate-50/50 opacity-80"
                }`}
                title={OFFICE_STATUS_CONFIG.conclusa_insoluta.description}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isClosed && isUnsettled
                      ? "bg-amber-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isClosed && isUnsettled ? <Check size={16} /> : <Archive size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-900 sm:text-sm">
                    Terminate ma insolute
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                    {OFFICE_STATUS_CONFIG.conclusa_insoluta.description}
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled={saving || isClosed || !onCloseInOffice}
                onClick={() => requestCloseInOffice()}
                className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  isClosed && !isUnsettled
                    ? "border-slate-500 bg-slate-100 ring-2 ring-slate-300"
                    : autoArchiveSuggested
                      ? "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-50"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-400 hover:bg-white"
                }`}
                title={OFFICE_STATUS_CONFIG.conclusa_ufficio.description}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isClosed && !isUnsettled
                      ? "bg-slate-700 text-white"
                      : autoArchiveSuggested
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
                  }`}
                >
                  {isClosed && !isUnsettled ? <Check size={16} /> : <Archive size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-900 sm:text-sm">
                    Terminate e consegnate
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                    {OFFICE_STATUS_CONFIG.conclusa_ufficio.description}
                  </span>
                </span>
              </button>
            </div>

            {isClosed && isUnsettled && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-900">
                Resta un importo da incassare. Quando segni i pagamenti come saldati (da
                commessa o intervento), la commessa passa automaticamente a{" "}
                <strong>Terminate e consegnate</strong>.
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              {isClosed && onReopenInOffice ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void onReopenInOffice()}
                  className="inline-flex items-center gap-1.5 text-sm"
                >
                  <ArrowLeft size={16} />
                  Riapri in ufficio (Pronte da consegnare)
                </Button>
              ) : (
                <>
                  {prev && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => requestStatus(prev)}
                      className="inline-flex items-center gap-1.5 text-sm"
                    >
                      <ArrowLeft size={16} />
                      Indietro: {OFFICE_STATUS_CONFIG[prev].shortLabel}
                    </Button>
                  )}
                  {next ? (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={saving}
                      onClick={() => requestStatus(next)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold"
                    >
                      <ArrowRight size={16} />
                      {advanceStatusLabel(current)}
                    </Button>
                  ) : (
                    onCloseInOffice && (
                      <Button
                        type="button"
                        variant="primary"
                        disabled={saving}
                        onClick={() => requestCloseInOffice()}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold"
                      >
                        <Archive size={16} />
                        Archivia commessa
                      </Button>
                    )
                  )}
                  {next && onCloseInOffice && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => requestCloseInOffice()}
                      className="inline-flex items-center gap-1.5 text-sm"
                    >
                      <Archive size={16} />
                      Archivia commessa
                    </Button>
                  )}
                </>
              )}
            </div>

            {!isClosed && (
            <div
              className={`mt-4 rounded-lg border px-3 py-3 text-sm ${
                isClientConfirmed(order)
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
                  : revisionPending
                    ? "border-orange-300 bg-orange-50 ring-1 ring-orange-200 text-orange-950"
                    : "border-amber-200 bg-amber-50/70 text-amber-900"
              }`}
            >
              {isClientConfirmed(order) ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Misure definitive confermate</p>
                      <p className="text-xs text-emerald-800/90">
                        {formatDateTime(order.clientConfirmedAt!)}
                      </p>
                    </div>
                  </div>
                  {editingConfirmNote ? (
                    <div className="space-y-2 border-t border-emerald-200/80 pt-2">
                      <label className="block text-xs font-medium text-emerald-900">
                        Nota (facoltativa)
                      </label>
                      <textarea
                        className={`${inputFieldClass} text-sm text-slate-900`}
                        rows={2}
                        placeholder="Es. conferma via email, telefonata con il cliente…"
                        value={editConfirmNoteDraft}
                        onChange={(e) => setEditConfirmNoteDraft(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          disabled={saving}
                          onClick={saveEditedConfirmNote}
                          className="py-2 text-xs"
                        >
                          Salva
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving}
                          onClick={() => setEditingConfirmNote(false)}
                          className="py-2 text-xs"
                        >
                          Annulla
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {order.clientConfirmedNote ? (
                        <p className="border-t border-emerald-200/80 pt-2 text-xs leading-relaxed text-emerald-800">
                          {order.clientConfirmedNote}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-emerald-200/80 pt-2 text-xs">
                        {onSaveClientConfirmNote && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={startEditConfirmNote}
                            className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                          >
                            {order.clientConfirmedNote ? "Modifica nota" : "Aggiungi nota"}
                          </button>
                        )}
                        {onRequestMeasurementsRevision && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setRevisionNoteDraft("");
                              setRevisionModalOpen(true);
                            }}
                            className="font-medium text-emerald-900 underline-offset-2 hover:underline"
                          >
                            Segna revisione misure
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      {awaitingDefinition ? (
                        <>
                          <p className="font-medium">Misure da definire</p>
                          <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                            Completa scheda e note. Quando hai le misure definitive,
                            confermale qui prima di mandare in officina.
                          </p>
                        </>
                      ) : revisionPending ? (
                        <>
                          <p className="font-medium">Revisione misure in corso</p>
                          <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                            Aggiorna scheda e note, poi conferma di nuovo quando le
                            misure sono definitive.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Conferma misure mancante</p>
                          <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                            Registra la conferma prima di mandare in officina.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {revisionPending && order.clientConfirmedNote ? (
                    <p className="rounded-md border border-orange-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-orange-900">
                      <span className="font-semibold">Note revisione: </span>
                      {order.clientConfirmedNote}
                    </p>
                  ) : null}
                  {onConfirmClient && (
                    <div className="space-y-2 border-t border-current/10 pt-2">
                      <label className="block text-xs font-medium">
                        {revisionPending
                          ? "Nota sulla nuova conferma (facoltativa)"
                          : "Nota (facoltativa)"}
                      </label>
                      <textarea
                        className={`${inputFieldClass} text-sm text-slate-900`}
                        rows={2}
                        placeholder="Es. email del cliente, telefonata con Mario Rossi…"
                        value={confirmNoteDraft}
                        onChange={(e) => setConfirmNoteDraft(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="primary"
                        disabled={saving}
                        onClick={() => {
                          const note = confirmNoteDraft.trim() || null;
                          setConfirmNoteDraft("");
                          void onConfirmClient(note);
                        }}
                        className="py-2 text-xs font-semibold"
                      >
                        {revisionPending
                          ? "Conferma misure aggiornate"
                          : "Conferma misure definitive"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>

      {pending?.check.warning === "missing_client_confirm" && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-4 p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {pending.check.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{pending.check.message}</p>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Nota conferma (facoltativa)
                  </label>
                  <textarea
                    className={`${inputFieldClass} text-sm`}
                    rows={2}
                    placeholder="Es. email del cliente, comunicazione a voce…"
                    value={pendingConfirmNote}
                    onChange={(e) => setPendingConfirmNote(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className={`${modalActionsClass} flex-col sm:flex-row`}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPending(null);
                  setPendingConfirmNote("");
                }}
                className="w-full py-2.5 sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => proceedPending(false)}
                className="w-full py-2.5 text-amber-900 sm:w-auto"
              >
                Manda senza conferma
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => proceedPending(true)}
                className="w-full py-2.5 font-semibold sm:w-auto"
              >
                Conferma misure e manda in lavorazione
              </Button>
            </div>
          </div>
        </div>
      )}

      {revisionModalOpen && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-4 p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-orange-100 p-2 text-orange-700">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Revisione misure
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Le misure vanno riviste? La conferma attuale viene tolta finché non
                  registri di nuovo quelle aggiornate. L&apos;officina non dovrebbe
                  procedere fino alla nuova conferma.
                </p>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Note (facoltativo)
                  </label>
                  <textarea
                    className={`${inputFieldClass} text-sm`}
                    rows={3}
                    placeholder="Es. rilievo da rifare, correzione interna, variazione in commessa…"
                    value={revisionNoteDraft}
                    onChange={(e) => setRevisionNoteDraft(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className={`${modalActionsClass} flex-col sm:flex-row`}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRevisionModalOpen(false);
                  setRevisionNoteDraft("");
                }}
                className="w-full py-2.5 sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={submitMeasurementsRevision}
                className="w-full py-2.5 font-semibold sm:w-auto"
              >
                Segna revisione in corso
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingEneaClose && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-4 p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-orange-100 p-2 text-orange-700">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Pratica ENEA ancora aperta
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Resta un promemoria ENEA da fare per questa commessa. Puoi
                  archiviare comunque: la commessa comparirà in «Pratiche ENEA da
                  fare» finché non la segni completata.
                </p>
              </div>
            </div>
            <div className={`${modalActionsClass} flex-col sm:flex-row`}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingEneaClose(false)}
                className="w-full py-2.5 sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setPendingEneaClose(false);
                  void onCloseInOffice?.();
                }}
                className="w-full py-2.5 font-semibold sm:w-auto"
              >
                Archivia comunque
              </Button>
            </div>
          </div>
        </div>
      )}

      {blockedClose && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-4 p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-red-100 p-2 text-red-700">
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">
                  {blockedClose.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{blockedClose.message}</p>
                <ul className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  {blockedClose.openJobs.map((job) => {
                    const displayStatus = getJobDisplayStatus(
                      job.persistedStatus ?? job.status,
                      job.plannedDate
                    );
                    const statusLabel =
                      STATUS_CONFIG[displayStatus]?.label ?? displayStatus;
                    return (
                      <li key={job.id} className="flex flex-wrap gap-x-2 gap-y-1">
                        <span className="font-medium text-slate-900">
                          {jobTitleDisplay(job.title)}
                        </span>
                        <span className="text-slate-500">· {statusLabel}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className={modalActionsClass}>
              <Button
                type="button"
                variant="primary"
                onClick={() => setBlockedClose(null)}
                className="w-full py-2.5 sm:w-auto"
              >
                Ho capito
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
