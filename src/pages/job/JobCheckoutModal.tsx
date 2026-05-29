import { Button } from "@/components/ui/Button";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Documento, Job, Payment } from "@/types";
import { jobAPI } from "@/api/jobs";
import { documentAPI } from "@/api/documentAPI";
import { reviewAPI } from "@/api/reviewAPI";
import { workerAPI } from "@/api/workers";
import { toast } from "react-hot-toast";
import { toDbDate, formatDateTime } from "@/utils/date";
import imageCompression from "browser-image-compression";
import { useAuth } from "@/context/AuthContext";
import { modalInputFieldClass, modalPanelClass } from "@/components/layout/PageChrome";
import { parseHttpErrorMessage } from "@/utils/httpError";
import { assertOnlineOrThrow } from "@/utils/networkStatus";
import { uploadDocumentsToJob } from "@/utils/uploadDocuments";
import { withRetry } from "@/utils/retry";
import UploadProgressBar from "@/components/ui/UploadProgressBar";
import { useUploadQueue } from "@/context/UploadQueueContext";
import {
  buildCheckoutReportNotes,
  mergeJobNotesAtCheckout,
} from "@/utils/checkoutReport";
import { appendCheckoutFormToReport } from "@/utils/checkoutFormReport";
import {
  CheckoutCelebration,
  type CheckoutCelebrationFootnote,
} from "@/components/job/CheckoutCelebration";
import type { CheckoutOutcome } from "@/utils/checkoutCelebration";
import { buildCheckoutFormDefaults, type CheckoutFormData } from "@/config/checkoutForm";
import { canOfferReviewRequestAtCheckout } from "@/config/jobTitles";
import {
  listCheckoutEvents,
  nextCheckoutIndex,
  pendingCheckoutDocuments,
} from "@/lib/checkoutSession";
import { CheckoutDigitalForm } from "@/components/checkout/CheckoutDigitalForm";
import { SignaturePad } from "@/components/checkout/SignaturePad";
import { CheckoutFormPreview } from "@/components/checkout/CheckoutFormPreview";
import { brandingFromUser } from "@/utils/checkoutBrandingFromUser";
import { CheckoutPaymentsEditor } from "@/components/checkout/CheckoutPaymentsEditor";
import { ManualCheckoutSections } from "@/components/checkout/ManualCheckoutSections";
import { DigitalCheckoutAttachmentsStep } from "@/components/checkout/DigitalCheckoutAttachmentsStep";
import {
  CHECKOUT_STEP_LABELS,
  checkoutAttachmentSaveAs,
  checkoutStepsForMode,
  hasDigitalCheckoutDraft,
  hasManualCheckoutDraft,
  manualCheckoutPaperPhotoName,
  type CheckoutModeSwitchConfirm,
  type CheckoutStep,
} from "@/lib/checkoutModalHelpers";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/* ===================== Component ===================== */
export default function JobCheckoutModal({
  job: initialJob,
  payments,
  setPayments,
  ultimato,
  setUltimato,
  finalConclusion,
  setFinalConclusion,
  setCheckoutOpen,
  checkingOut,
  setCheckingOut,
  loadData,
  onStorageChange,
  orderCode,
  customerName,
  customerPhone,
  orderDate,
}: {
  job: Job;
  orderCode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderDate?: string | null;
  payments: Payment[];
  setPayments: (rows: Payment[]) => void;
  ultimato: "si" | "no" | null;
  setUltimato: (v: "si" | "no") => void;
  finalConclusion: string;
  setFinalConclusion: (v: string) => void;
  setCheckoutOpen: (v: boolean) => void;
  checkingOut: boolean;
  setCheckingOut: (v: boolean) => void;
  loadData?: () => Promise<void>;
  onStorageChange?: () => void;
}) {
  const { user, refreshUser } = useAuth();
  const [checkoutPayments, setCheckoutPayments] = useState<Payment[]>(payments);
  const [celebrationPrefs, setCelebrationPrefs] = useState<{
    customMessage?: string | null;
    backgroundImageUrl?: string | null;
    workerName: string;
  } | null>(null);
  useEffect(() => {
    setCheckoutPayments(payments);
  }, [payments]);
  const [files, setFiles] = useState<File[]>([]);
  /** Solo checkout manuale: foto del foglio cartaceo firmato. */
  const [paperFiles, setPaperFiles] = useState<File[]>([]);
  const [celebration, setCelebration] = useState<{
    outcome: CheckoutOutcome;
    footnotes: CheckoutCelebrationFootnote[];
  } | null>(null);
  const [job, setJob] = useState<Job>(initialJob);
  const [requestReview, setRequestReview] = useState<"si" | "no">("no");
  const [technicianNames, setTechnicianNames] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    name?: string;
  } | null>(null);
  const { notifyQueued, refreshPendingCount } = useUploadQueue();
  const reviewRequestFeatureEnabled = Boolean(user?.reviewRequestEnabled);
  const reviewRequestOffered =
    reviewRequestFeatureEnabled && canOfferReviewRequestAtCheckout(job.title);
  const tenantCheckoutDigitalEnabled = Boolean(user?.checkoutDigitalEnabled);
  const [forceManualCheckout, setForceManualCheckout] = useState(false);
  const [modeSwitchConfirm, setModeSwitchConfirm] =
    useState<CheckoutModeSwitchConfirm | null>(null);
  const checkoutDigitalEnabled =
    tenantCheckoutDigitalEnabled && !forceManualCheckout;
  const performingTechnicianName =
    user?.name?.trim() || user?.email?.trim() || "Operatore";
  const checkoutSteps = useMemo(
    () => checkoutStepsForMode(checkoutDigitalEnabled),
    [checkoutDigitalEnabled]
  );

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("dati");
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const [jobDocs, setJobDocs] = useState<Documento[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormData>(() =>
    buildCheckoutFormDefaults(initialJob)
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const sessionIndex = useMemo(() => nextCheckoutIndex(job), [job]);
  const priorCheckouts = useMemo(() => listCheckoutEvents(job), [job]);
  const lastCheckout = priorCheckouts[0];
  const pendingDocs = useMemo(
    () => pendingCheckoutDocuments(jobDocs),
    [jobDocs]
  );
  const branding = useMemo(() => brandingFromUser(user), [user]);
  const resolvedCustomerPhone =
    customerPhone?.trim() || job.customer?.phone?.trim() || "";

  useEffect(() => {
    void documentAPI.listByJob(job.id).then(setJobDocs).catch(() => setJobDocs([]));
  }, [job.id]);

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Profilo aggiornato (frase/foto checkout) — non usare solo lo snapshot al login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await refreshUser();
      if (cancelled || !me) return;
      setCelebrationPrefs({
        customMessage: me.checkoutCelebrationMessage,
        backgroundImageUrl: me.checkoutCelebrationImageUrl,
        workerName: me.name ?? "Operatore",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  // 🔹 quando apro il modal, ricarico il job completo con team ed eventi checkout
  useEffect(() => {
    (async () => {
      try {
        const fullJob = await jobAPI.getById(initialJob.id);
        if (fullJob) {
          setJob(fullJob);
          setCheckoutForm(buildCheckoutFormDefaults(fullJob));
        }
      } catch (err) {
        console.error("Errore caricamento job completo:", err);
        toast.error("Errore caricamento dati job");
      }
    })();
  }, [initialJob.id]);

  useEffect(() => {
    (async () => {
      try {
        const workers = await workerAPI.list();
        const names = (job.assignedWorkers ?? [])
          .map((workerId) => workers.find((w) => w.id === workerId)?.name ?? workerId)
          .filter(Boolean);
        setTechnicianNames(names);
      } catch (err) {
        console.error("Errore caricamento squadra checkout:", err);
        setTechnicianNames((job.assignedWorkers ?? []).filter(Boolean));
      }
    })();
  }, [job.assignedWorkers]);

  useEffect(() => {
    if (!tenantCheckoutDigitalEnabled) {
      setForceManualCheckout(false);
      return;
    }
    setCheckoutStep("dati");
    setSignatureDataUrl(null);
  }, [forceManualCheckout, tenantCheckoutDigitalEnabled]);

  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [checkoutStep]);

  const checkoutIndex = sessionIndex;
  const isLastCheckoutStep =
    checkoutStep === checkoutSteps[checkoutSteps.length - 1];
  const checkoutStepIndex = checkoutSteps.indexOf(checkoutStep);

  const goToPrevCheckoutStep = useCallback(() => {
    const i = checkoutSteps.indexOf(checkoutStep);
    if (i > 0) setCheckoutStep(checkoutSteps[i - 1]!);
  }, [checkoutStep, checkoutSteps]);

  const applyManualCheckout = useCallback(() => {
    setForceManualCheckout(true);
    setModeSwitchConfirm(null);
  }, []);

  const applyDigitalCheckout = useCallback(() => {
    setForceManualCheckout(false);
    setModeSwitchConfirm(null);
  }, []);

  const requestManualCheckout = useCallback(() => {
    if (
      hasDigitalCheckoutDraft(checkoutForm, {
        signatureDataUrl,
        digitalFileCount: files.length,
      })
    ) {
      setModeSwitchConfirm("to-manual");
      return;
    }
    applyManualCheckout();
  }, [applyManualCheckout, checkoutForm, files.length, signatureDataUrl]);

  const requestDigitalCheckout = useCallback(() => {
    if (hasManualCheckoutDraft(paperFiles.length)) {
      setModeSwitchConfirm("to-digital");
      return;
    }
    applyDigitalCheckout();
  }, [applyDigitalCheckout, paperFiles.length]);

  const goToNextCheckoutStep = useCallback(() => {
    if (checkoutStep === "dati" && !ultimato) {
      toast.error("Seleziona l'esito intervento");
      return;
    }
    if (checkoutStep === "firma" && !signatureDataUrl) {
      toast.error("Richiesta la firma del cliente");
      return;
    }
    const i = checkoutSteps.indexOf(checkoutStep);
    if (i < checkoutSteps.length - 1) setCheckoutStep(checkoutSteps[i + 1]!);
  }, [checkoutStep, checkoutSteps, signatureDataUrl, ultimato]);

  const compressUploadFiles = async (uploadedFiles: File[]): Promise<File[]> => {
    const compressedFiles: File[] = [];
    for (const file of uploadedFiles) {
      if (file.type.startsWith("image/")) {
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
          });
          compressedFiles.push(compressed);
        } catch (err) {
          console.error("Errore compressione immagine:", err);
          compressedFiles.push(file);
        }
      } else {
        compressedFiles.push(file);
      }
    }
    return compressedFiles;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const compressed = await compressUploadFiles(Array.from(e.target.files));
    setFiles((prev) => [...prev, ...compressed]);
    e.target.value = "";
  };

  const handlePaperFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const compressed = await compressUploadFiles(Array.from(e.target.files));
    setPaperFiles((prev) => [...prev, ...compressed]);
    e.target.value = "";
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const removePaperFile = (name: string) => {
    setPaperFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const confirmCheckout = async () => {
    if (!ultimato) {
      toast.error("⚠️ Seleziona un esito prima di procedere");
      return;
    }

    const stato = ultimato === "si" ? "completato" : "da_completare";

    setCheckingOut(true);
    const footnotes: CheckoutCelebrationFootnote[] = [];
    try {
      await assertOnlineOrThrow();

      // 1) Upload allegati (retry automatico; checkout non si blocca se solo alcuni falliscono)
      const newUploads = checkoutDigitalEnabled ? files : paperFiles;
      if (newUploads.length > 0) {
        const uploadResult = await uploadDocumentsToJob(
          job.id,
          newUploads.map((file, fileIndex) => ({
            file,
            saveAs: checkoutAttachmentSaveAs(
              checkoutDigitalEnabled,
              checkoutIndex,
              file,
              fileIndex
            ),
            checkoutIndex,
          })),
          {
            allowPartial: true,
            onStorageChange,
            onProgress: (done, total, name) =>
              setUploadProgress({ done, total, name }),
          }
        );

        if (uploadResult.queued.length > 0) notifyQueued(uploadResult.queued.length);
        void refreshPendingCount();

        if (uploadResult.succeeded.length === 0 && uploadResult.queued.length === 0) {
          toast.error(
            "Nessun allegato caricato: verifica la connessione e riprova."
          );
          return;
        }
        if (uploadResult.succeeded.length > 0) {
          footnotes.push({
            id: "attachments-ok",
            text:
              uploadResult.succeeded.length === 1
                ? "1 allegato caricato"
                : `${uploadResult.succeeded.length} allegati caricati`,
          });
        }
        if (uploadResult.queued.length > 0) {
          footnotes.push({
            id: "attachments-queued",
            text: `${uploadResult.queued.length} allegati in coda: verranno caricati in automatico`,
          });
        } else if (uploadResult.failed.length > 0) {
          toast.error(
            `${uploadResult.failed.length} allegati non caricati. Puoi riallegarli dall'intervento.`,
            { duration: 7000 }
          );
        }
      }

      // 2) Checkout unificato: incassi, evento report, stato intervento, un solo log attività
      const checkoutClosedAtLabel = formatDateTime(new Date());
      let reportNotes = buildCheckoutReportNotes({
        performedByName: user?.name ?? "",
        performedByEmail: user?.email ?? "",
        datetimeLabel: checkoutClosedAtLabel,
        stato,
        technicianNames,
        payments: checkoutPayments,
        // Checkout digitale: note cantiere già nel modulo (note montatore); evita triplo testo nel report.
        jobNotes: checkoutDigitalEnabled ? undefined : job.notes,
        finalConclusion,
        requestReviewFeatureEnabled: reviewRequestOffered,
        requestReview: reviewRequestOffered ? requestReview : "no",
      });

      if (checkoutDigitalEnabled) {
        reportNotes = appendCheckoutFormToReport(reportNotes, {
          ...checkoutForm,
          clienteSignerName:
            checkoutForm.clienteSignerName.trim() ||
            customerName ||
            job.customer?.name ||
            "",
        });
      }

      const paymentPayload = checkoutPayments
        .filter((p) => !p.id.startsWith("tmp-"))
        .map((p) => ({
          id: p.id,
          collected: p.collected,
          partial: p.partial,
          collectedAmount: p.collected ? p.amount : p.collectedAmount ?? 0,
        }));

      const signerName =
        checkoutForm.clienteSignerName.trim() ||
        customerName ||
        job.customer?.name ||
        "Cliente";

      if (checkoutDigitalEnabled) {
        footnotes.push({
          id: "checkout-pdf",
          text: "Modulo fine lavori PDF generato e salvato negli allegati",
        });
      }

      const checkoutResult = await withRetry(
        () =>
          jobAPI.checkout(job.id, {
            status: stato as "completato" | "da_completare",
            eventDate: toDbDate(new Date()),
            reportNotes,
            ...(() => {
              const merged = mergeJobNotesAtCheckout(
                job.notes,
                finalConclusion,
                checkoutClosedAtLabel
              );
              return merged.trim() ? { notes: merged } : {};
            })(),
            payments: paymentPayload,
            attachDocumentIds: selectedDocIds,
            ...(checkoutDigitalEnabled && signatureDataUrl
              ? {
                  signature: {
                    signerName,
                    imageDataUrl: signatureDataUrl,
                  },
                }
              : {}),
            ...(checkoutDigitalEnabled
              ? {
                  checkoutDigital: {
                    form: {
                      ...checkoutForm,
                      clienteSignerName: signerName,
                    },
                    context: {
                      orderCode,
                      orderDate,
                      customerName: customerName ?? job.customer?.name,
                      customerPhone: resolvedCustomerPhone || null,
                      destination: job.location?.address,
                      performingTechnicianName,
                      crewOnSiteNames: technicianNames,
                    },
                  },
                }
              : {}),
          }),
        { label: "checkout" }
      );

      if (checkoutResult.checkoutEmailSent) {
        footnotes.push({
          id: "checkout-email",
          text: "Email modulo fine lavori inviata al cliente",
        });
      } else if (checkoutResult.checkoutEmailSkippedReason) {
        footnotes.push({
          id: "checkout-email-skip",
          text: `Email modulo non inviata: ${checkoutResult.checkoutEmailSkippedReason}`,
        });
      }

      setPayments(checkoutPayments);
      setCheckoutPayments(checkoutPayments);

      // 3) Se completato e recensione richiesta = sì
      if (reviewRequestOffered && stato === "completato" && requestReview === "si") {
        try {
          const reviewResult = await reviewAPI.submitForJob(job.id);
          if (reviewResult.channel === "email_app") {
            if (reviewResult.emailSent) {
              footnotes.push({
                id: "review",
                text: "Email richiesta recensione inviata al cliente",
              });
            } else {
              footnotes.push({
                id: "review-skip",
                text: `Recensione non inviata per email: ${reviewResult.emailSkippedReason ?? "configurazione incompleta"}`,
              });
            }
          } else {
            footnotes.push({
              id: "review",
              text: "Richiesta recensione registrata (foglio Google)",
            });
          }
        } catch (reviewErr: unknown) {
          console.error("Errore invio richiesta recensione:", reviewErr);
          toast.error(
            parseHttpErrorMessage(reviewErr, "Errore invio richiesta recensione")
          );
        }
      }

      // 4) Refresh UI e schermata celebrazione (profilo fresco per frase/foto personalizzate)
      await loadData?.();
      const me = await refreshUser();
      if (me) {
        setCelebrationPrefs({
          customMessage: me.checkoutCelebrationMessage,
          backgroundImageUrl: me.checkoutCelebrationImageUrl,
          workerName: me.name ?? "Operatore",
        });
      }
      setCelebration({
        outcome: stato as CheckoutOutcome,
        footnotes,
      });
    } catch (err: unknown) {
      console.error("Errore nel checkout:", err);
      toast.error(parseHttpErrorMessage(err, "Errore durante il checkout"));
    } finally {
      setCheckingOut(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
      <div
        className={`${modalPanelClass} flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[min(95dvh,920px)] sm:max-w-3xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
      >
        {!celebration ? (
          <>
            <header className="shrink-0 border-b border-slate-200/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <h2
                  id="checkout-modal-title"
                  className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                >
                  {checkoutDigitalEnabled
                    ? `Checkout digitale #${sessionIndex}`
                    : `Checkout manuale #${sessionIndex}`}
                </h2>
                <Button
                  type="button"
                  variant="neutral"
                  className="min-h-10 shrink-0 px-3 py-2 text-sm"
                  onClick={() => setCheckoutOpen(false)}
                  disabled={checkingOut}
                >
                  Chiudi
                </Button>
              </div>

              {checkoutDigitalEnabled ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                  {checkoutSteps.map((key, idx) => (
                    <span
                      key={key}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        checkoutStep === key
                          ? "bg-brand text-white"
                          : idx < checkoutStepIndex
                            ? "bg-slate-200 text-slate-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {idx + 1}. {CHECKOUT_STEP_LABELS[key]}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            <div
              ref={scrollBodyRef}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6"
            >
            {tenantCheckoutDigitalEnabled && checkoutStep === "dati" && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                  checked={forceManualCheckout}
                  onChange={(e) =>
                    e.target.checked ? requestManualCheckout() : requestDigitalCheckout()
                  }
                />
                <span>
                  {forceManualCheckout ? (
                    <>
                      Checkout <strong>manuale</strong> (cartaceo). Deseleziona per tornare al{" "}
                      <strong>modulo digitale</strong> con firma e PDF.
                    </>
                  ) : (
                    <>
                      Usa <strong>checkout manuale</strong> per questa sessione (cartaceo), senza
                      modulo PDF digitale.
                    </>
                  )}
                </span>
              </label>
            )}

            {checkoutDigitalEnabled ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Compila il <strong>modulo fine lavori</strong> e raccogli la firma del cliente:
                al termine viene generato il PDF. Nel passo <strong>Allegati</strong> seleziona le
                foto da associare a questa chiusura.
              </p>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Registra pagamenti ed esito, poi il <strong>cartaceo di fine cantiere</strong>.
                Le foto già caricate in cantiere puoi collegarle solo se ti serve.
              </p>
            )}

            {lastCheckout && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Ultimo checkout:{" "}
                <strong>
                  {lastCheckout.type === "check_out_da_completare"
                    ? "da completare"
                    : "completato"}
                </strong>{" "}
                del {formatDateTime(lastCheckout.date || lastCheckout.createdAt)}.
                {lastCheckout.type === "check_out_da_completare"
                  ? " Questa sessione è un nuovo passaggio."
                  : ""}
              </p>
            )}

            {/* Cliente & Location */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700">
              <p>
                <strong>Cliente:</strong> {job.customer?.name || "-"}
              </p>
              <p>
                <strong>Indirizzo:</strong> {job.location?.address || "N/D"}
              </p>
            </div>

            {/* Tecnico che effettua il checkout (modulo / PDF) */}
            <div>
              <h3 className="font-medium mb-2">👷 Tecnico</h3>
              <p className="text-sm font-medium text-slate-900">
                {performingTechnicianName}
              </p>
              {technicianNames.length > 0 &&
                !technicianNames.every(
                  (n) => n.trim() === performingTechnicianName
                ) && (
                  <p className="mt-1 text-xs text-slate-500">
                    Squadra in cantiere: {technicianNames.join(", ")}
                  </p>
                )}
            </div>

            {checkoutStep === "dati" && (
            <>
            {/* Pagamenti */}
            <div>
              <h3 className="mb-1 font-medium">💰 Pagamenti in cantiere</h3>
              <p className="mb-3 text-xs text-slate-500">
                Segna cosa hai incassato: verrà salvato insieme alla conferma del checkout.
              </p>
              <CheckoutPaymentsEditor
                payments={checkoutPayments}
                onChange={setCheckoutPayments}
                disabled={checkingOut}
              />
            </div>

            {checkoutDigitalEnabled && (
              <div className="rounded-xl border border-slate-200 p-3">
                <h3 className="font-medium mb-2">Modulo fine lavori</h3>
                <p className="mb-3 text-xs text-slate-500">
                  Dati per il PDF firmato dal cliente al termine del checkout.
                </p>
                <CheckoutDigitalForm
                  value={checkoutForm}
                  onChange={setCheckoutForm}
                  disabled={checkingOut}
                  mountingStartReadOnly={priorCheckouts.length > 0}
                />
              </div>
            )}

            {job.notes?.trim() && (
              <details className="rounded-xl border border-slate-200 bg-slate-50/80 text-sm">
                <summary className="cursor-pointer px-3 py-2 font-medium text-slate-700">
                  Note cantiere (solo consultazione)
                </summary>
                <pre className="whitespace-pre-wrap border-t border-slate-200 px-3 py-2 text-slate-600">
                  {job.notes}
                </pre>
              </details>
            )}

            {/* Esito */}
            <div className="space-y-2">
              <h3 className="font-medium mb-2">Esito intervento</h3>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm active:bg-slate-50">
                <input
                  type="radio"
                  value="si"
                  checked={ultimato === "si"}
                  onChange={() => setUltimato("si")}
                  className="h-5 w-5 shrink-0 accent-brand"
                />
                Completato
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm active:bg-slate-50">
                <input
                  type="radio"
                  value="no"
                  checked={ultimato === "no"}
                  onChange={() => setUltimato("no")}
                  className="h-5 w-5 shrink-0 accent-brand"
                />
                Da completare
              </label>
            </div>

            {reviewRequestOffered && ultimato === "si" && (
              <div className="mt-3">
                <h3 className="font-medium mb-2">
                  Vuoi chiedere la recensione al cliente?
                </h3>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:bg-slate-50">
                    <input
                      type="radio"
                      value="si"
                      checked={requestReview === "si"}
                      onChange={() => setRequestReview("si")}
                      className="h-5 w-5 shrink-0 accent-brand"
                    />
                    Sì
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:bg-slate-50">
                    <input
                      type="radio"
                      value="no"
                      checked={requestReview === "no"}
                      onChange={() => setRequestReview("no")}
                      className="h-5 w-5 shrink-0 accent-brand"
                    />
                    No
                  </label>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-medium mb-2">📝 Nota di chiusura (opzionale)</h3>
              <p className="mb-2 text-xs text-slate-500">
                Uso interno in scheda intervento: si <strong>aggiunge in coda</strong> alle note
                cantiere (non sostituisce il diario).
                {checkoutDigitalEnabled
                  ? " Non compare sul PDF — per il cliente usa «Note montatore» nel modulo."
                  : " Per il cartaceo di fine cantiere usa la sezione dedicata in fondo al modulo."}
              </p>
              <textarea
                value={finalConclusion}
                onChange={(e) => setFinalConclusion(e.target.value)}
                className={modalInputFieldClass + " min-h-[88px]"}
                rows={3}
                placeholder={
                  checkoutDigitalEnabled
                    ? "Es. da rientrare per silicone, chiavi consegne…"
                    : "Es. follow-up ufficio, materiale da ordinare…"
                }
              />
            </div>

            {!checkoutDigitalEnabled && (
              <ManualCheckoutSections
                pendingDocs={pendingDocs}
                selectedDocIds={selectedDocIds}
                onToggle={toggleDocSelection}
                paperFiles={paperFiles}
                checkoutIndex={checkoutIndex}
                paperPhotoName={manualCheckoutPaperPhotoName}
                onPaperUpload={handlePaperFileUpload}
                onRemovePaper={removePaperFile}
                disabled={checkingOut}
              />
            )}
            </>
            )}

            {checkoutDigitalEnabled && checkoutStep === "allegati" && (
            <DigitalCheckoutAttachmentsStep
              pendingDocs={pendingDocs}
              selectedDocIds={selectedDocIds}
              onToggle={toggleDocSelection}
              files={files}
              onFileUpload={handleFileUpload}
              onRemoveFile={removeFile}
            />
            )}

            {(checkoutDigitalEnabled ? checkoutStep === "firma" : false) && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  La firma del cliente viene inserita nel PDF di fine lavori, non tra gli
                  allegati del cantiere.
                </p>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Nome e cognome cliente (firma)
                  </span>
                  <input
                    className={modalInputFieldClass}
                    value={checkoutForm.clienteSignerName}
                    disabled={checkingOut}
                    onChange={(e) =>
                      setCheckoutForm((f) => ({
                        ...f,
                        clienteSignerName: e.target.value,
                      }))
                    }
                    placeholder={customerName ?? "Cliente"}
                  />
                </label>
                <SignaturePad
                  onChange={setSignatureDataUrl}
                  disabled={checkingOut}
                />
              </div>
            )}

            {(checkoutDigitalEnabled ? checkoutStep === "anteprima" : false) && (
              <CheckoutFormPreview
                form={{
                  ...checkoutForm,
                  clienteSignerName:
                    checkoutForm.clienteSignerName ||
                    customerName ||
                    "",
                }}
                context={{
                  orderCode,
                  orderDate,
                  customerName: customerName ?? job.customer?.name,
                  customerPhone: resolvedCustomerPhone || null,
                  destination: job.location?.address,
                  performingTechnicianName,
                  crewOnSiteNames: technicianNames,
                }}
                branding={branding}
                signatureDataUrl={signatureDataUrl}
              />
            )}

            {uploadProgress && uploadProgress.total > 0 && (
              <UploadProgressBar
                completed={uploadProgress.done}
                total={uploadProgress.total}
                label={uploadProgress.name}
              />
            )}
            </div>

            <footer className="shrink-0 border-t border-slate-200/90 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {checkoutStepIndex > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={checkingOut}
                    onClick={goToPrevCheckoutStep}
                    className="min-h-12 w-full font-semibold sm:w-auto"
                  >
                    Indietro
                  </Button>
                )}
                {!isLastCheckoutStep ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={checkingOut}
                    onClick={goToNextCheckoutStep}
                    className="min-h-12 w-full font-semibold sm:w-auto"
                  >
                    Avanti
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={confirmCheckout}
                    disabled={checkingOut}
                    className="min-h-12 w-full font-semibold sm:w-auto"
                  >
                    {checkingOut ? "⏳ Conferma..." : "Conferma checkout"}
                  </Button>
                )}
              </div>
            </footer>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <CheckoutCelebration
            outcome={celebration.outcome}
            workerName={celebrationPrefs?.workerName ?? user?.name ?? "Operatore"}
            customMessage={
              celebrationPrefs?.customMessage ?? user?.checkoutCelebrationMessage
            }
            backgroundImageUrl={
              celebrationPrefs?.backgroundImageUrl ?? user?.checkoutCelebrationImageUrl
            }
            jobTitle={job.title}
            orderCode={orderCode}
            customerName={customerName ?? job.customer?.name}
            footnotes={celebration.footnotes}
            onClose={() => setCheckoutOpen(false)}
          />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={modeSwitchConfirm === "to-manual"}
        setOpen={(open) => {
          if (!open) setModeSwitchConfirm(null);
        }}
        title="Passare al checkout manuale?"
        description={
          <>
            I dati già inseriti nel modulo digitale non verranno salvati nel PDF.
            Pagamenti, esito e note di chiusura restano. Procedi solo se userai il
            foglio cartaceo firmato dal cliente.
          </>
        }
        confirmText="Sì, usa cartaceo"
        cancelText="Annulla"
        onConfirm={applyManualCheckout}
      />

      <ConfirmDialog
        open={modeSwitchConfirm === "to-digital"}
        setOpen={(open) => {
          if (!open) setModeSwitchConfirm(null);
        }}
        title="Tornare al checkout digitale?"
        description={
          <>
            Le foto del cartaceo già selezionate in questo passaggio non verranno usate
            per il PDF digitale. Pagamenti, esito e note di chiusura restano. Dovrai
            compilare modulo e firma sul dispositivo.
          </>
        }
        confirmText="Sì, usa digitale"
        cancelText="Annulla"
        onConfirm={applyDigitalCheckout}
      />
    </div>
  );
}
