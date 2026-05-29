// OrderDetail.tsx
// Pagina dettaglio commessa — stile allineato con Customers/Orders (2025-10)
// - Intestazione pulita con cliente e località
// - Box Note con salva (bottoni coerenti con Customers, icone Lucide)
// - Allegati in card semplici con upload su Supabase Storage
// - Pagamenti lasciati "as-is" (scelta A)
// - Interventi: card mobile + tabella desktop, righe cliccabili, azioni icone (Edit/Trash)
// - Nuovo intervento: inserimento + evidenziazione pulse blu per 10s (coerenza con nuove logiche)
// - Emoji solo nei TITOLI sezione; nelle celle/bottoni usiamo icone Lucide o testo

import { Button } from "@/components/ui/Button";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { jobOrderAPI } from "../../api/jobOrders";
import { customerAPI } from "../../api/customers";
import { jobAPI } from "../../api/jobs";
import { workerAPI } from "../../api/workers";
import { documentAPI, resolveDocumentUrl } from "../../api/documentAPI";
import { uploadDocumentsToOrder } from "@/utils/uploadDocuments";

import type {
  JobOrder,
  Customer,
  Job,
  Documento,
  Payment,
  Worker,
} from "../../types";
import { formatDocumento } from "../../utils/documenti";
import { STATUS_CONFIG, getJobDisplayStatus } from "@/config/statusConfig";
import { useJobsListRefresh } from "@/hooks/useJobsListRefresh";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import toast from "react-hot-toast";
import { formatDateTime, toDbDate } from "@/utils/date";
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
import StorageUsageBanner from "@/components/StorageUsageBanner";
import { parseHttpErrorMessage } from "@/utils/httpError";
import UploadProgressBar from "@/components/ui/UploadProgressBar";
import { useUploadQueue } from "@/context/UploadQueueContext";

// Lucide icons (azioni e dettagli)
import {
  Plus,
  Save,
  X,
  Edit,
  Trash2,
  Calendar,
  Users,
  MapPin,
  FileText,
  Link as LinkIcon,
} from "lucide-react";

// 🔹 Tipologia payload per creazione job
type JobCreate = Omit<
  Job,
  "id" | "events" | "customer" | "team" | "payments" | "docs"
>;

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ===== Stato base pagina =====
  const [order, setOrder] = useState<JobOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [notes, setNotes] = useState("");

  // ===== UI: modale nuovo/modifica job =====
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Job>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // ===== UI: conferma eliminazione =====
  const [openConfirm, setOpenConfirm] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  // ===== UI: stato allegati =====
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    name?: string;
  } | null>(null);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);
  const { notifyQueued, refreshPendingCount } = useUploadQueue();

  // ===== UI: evidenziazione ultimo intervento creato =====
  const [lastCreatedJobId, setLastCreatedJobId] = useState<string | null>(null);

  // ==============================
  // Caricamento dati
  // ==============================
  useEffect(() => {
    if (!id) return;

    async function loadData() {
      try {
        const o = await jobOrderAPI.getById(id ?? "");
        if (!o) return;
        setOrder(o);
        setNotes(o.notes ?? "");

        const c = await customerAPI.getById(o.customerId);
        setCustomer(c ?? null);

        const j = await jobAPI.listByOrder(o.id, { includePayments: true });
        setJobs(j ?? []);

        const docs = await documentAPI.listByOrder(o.id);
        setDocumenti(docs ?? []);
      } catch (err) {
        console.error("Errore caricamento dettaglio commessa:", err);
        toast.error("Errore nel caricamento della commessa ❌");
      }
    }

    loadData();
  }, [id]);

  const reloadJobs = useCallback(async () => {
    if (!id) return;
    const fresh = await jobAPI.listByOrder(id, { includePayments: true });
    setJobs(fresh ?? []);
  }, [id]);

  useJobsListRefresh(() => {
    void reloadJobs();
  });

  // Workers (una tantum)
  useEffect(() => {
    workerAPI.list().then((w) => setWorkers(w ?? []));
  }, []);

  if (order === null) {
    return <div className="p-4 text-gray-500">⏳ Caricamento commessa...</div>;
  }

  // Pagamenti aggregati (come da tua versione)
  const allPayments: Payment[] = jobs.flatMap((j) =>
    (j.payments ?? []).map((p) => ({ ...p, jobId: j.id }))
  );
  const totalExpected = allPayments.reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0
  );
  const totalCollected = allPayments.reduce((sum, p) => {
    if (p.collected) return sum + (p.amount ?? 0);
    if (p.partial) return sum + (p.collectedAmount ?? 0);
    return sum;
  }, 0);
  const totalPending = totalExpected - totalCollected;

  // Ordinamento jobs: per createdAt desc, con precedenza al job appena creato (senza useMemo)
  const sortedJobs = [...jobs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .sort((a, b) => {
      if (lastCreatedJobId === a.id) return -1;
      if (lastCreatedJobId === b.id) return 1;
      return 0;
    });

  // ==============================
  // Azioni: note commessa
  // ==============================
  const handleSaveNotes = async () => {
    if (!order) return;
    try {
      const updated = await jobOrderAPI.update(order.id, { notes });
      setOrder(updated);
      toast.success("Note commessa aggiornate ✅");
    } catch (err) {
      console.error("Errore aggiornamento note:", err);
      toast.error("Errore durante l'aggiornamento delle note ❌");
    }
  };

  // ==============================
  // Azioni: interventi (jobs)
  // ==============================
  const handleSaveJob = async () => {
    if (!formData.title) {
      return toast.error("La tipologia intervento è obbligatoria ❌");
    }

    try {
      if (editingId) {
        // Update job esistente
        const payload: Partial<Job> = {
          title: formData.title as Job["title"],
          plannedDate: (formData.plannedDate as string | null) ?? null,
          assignedWorkers: formData.assignedWorkers ?? [],
          notes: formData.notes ?? "",
        };
        if (typeof formData.status === "string") {
          payload.status = formData.status as Job["status"];
        }

        const updated = await jobAPI.update(editingId, payload);
        if (updated) {
          toast.success("Intervento aggiornato ✅");
          await reloadJobs();
        }
      } else {
        // Creazione job nuovo
        const newJobPayload: JobCreate = {
          jobOrderId: order.id,
          createdAt: toDbDate(new Date()),
          title: formData.title as Job["title"],
          notes: formData.notes ?? "",
          status: "in_attesa_programmazione",
          files: [],
          location: order.location ?? {},
          customer: customer ?? { id: "", name: "" },
          team: [],
          payments: [],
          docs: [],
          events: [],
        } as unknown as JobCreate;

        const created = await jobAPI.create(newJobPayload);
        if (!created) {
          toast.error("Errore durante il salvataggio dell'intervento ❌");
          return;
        }

        // Evidenzia in cima per 10s
        setLastCreatedJobId(created.id);
        setTimeout(() => setLastCreatedJobId(null), 10000);

        toast.success("Intervento creato ✅");
        await reloadJobs();
      }

      // Reset form
      setFormData({});
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error("Errore salvataggio intervento:", err);
      toast.error("Errore durante il salvataggio dell'intervento ❌");
    }
  };

  const handleEdit = (job: Job) => {
    setFormData({
      ...job,
      status: job.persistedStatus ?? job.status,
    });
    setEditingId(job.id);
    setShowForm(true);
  };

  const handleDelete = (jobId: string) => {
    setJobToDelete(jobId);
    setOpenConfirm(true);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;
    try {
      await jobAPI.remove(jobToDelete);
      toast.success("Intervento eliminato ✅");
      await reloadJobs();
    } catch (err) {
      console.error("Errore eliminazione intervento:", err);
      toast.error("Errore durante l'eliminazione dell'intervento ❌");
    } finally {
      setJobToDelete(null);
    }
  };

  // ==============================
  // Azioni: allegati (Supabase Storage)
  // ==============================
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !order) return;
    const files = Array.from(e.target.files);

    setLoadingDocs(true);
    try {
      const result = await uploadDocumentsToOrder(
        order.id,
        files.map((file) => ({ file })),
        {
          allowPartial: true,
          onStorageChange: () => setStorageRefreshKey((k) => k + 1),
          onProgress: (done, total, name) =>
            setUploadProgress({ done, total, name }),
        }
      );

      if (result.queued.length > 0) notifyQueued(result.queued.length);
      void refreshPendingCount();

      const docs = await documentAPI.listByOrder(order.id);
      setDocumenti(docs);

      if (result.succeeded.length === 0 && result.queued.length === 0) {
        toast.error(
          parseHttpErrorMessage(
            new Error(result.failed[0]?.error),
            "Errore durante il caricamento dei file ❌"
          )
        );
      } else if (result.queued.length > 0 && result.succeeded.length === 0) {
        toast.success(`${result.queued.length} file in coda per il caricamento`);
      } else if (result.failed.length > 0 || result.queued.length > 0) {
        const parts = [`${result.succeeded.length} caricati`];
        if (result.queued.length > 0) parts.push(`${result.queued.length} in coda`);
        if (result.failed.length > 0) parts.push(`${result.failed.length} non riusciti`);
        toast.success(parts.join(", "));
      } else {
        toast.success(`Caricati ${result.succeeded.length} file ✅`);
      }
    } catch (err) {
      console.error("Errore upload file:", err);
      toast.error(
        parseHttpErrorMessage(err, "Errore durante il caricamento dei file ❌")
      );
    } finally {
      setLoadingDocs(false);
      setUploadProgress(null);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (docId: string) => {
    if (!order) return;
    setLoadingDocs(true);
    try {
      await documentAPI.deleteFromOrder(docId);

      const docs = await documentAPI.listByOrder(order.id);
      setDocumenti(docs);
      toast.success("File eliminato ✅");
      setStorageRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Errore eliminazione file:", err);
      toast.error("Errore durante l'eliminazione del file ❌");
    } finally {
      setLoadingDocs(false);
    }
  };

  // ==============================
  // Render
  // ==============================
  return (
    <div className="space-y-5">
      {/* ===== Intestazione commessa ===== */}
      <div className={`p-4 md:p-6 ${surfaceCardClass}`}>
        <h1 className="mb-2 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          Commessa {order.code}
        </h1>

        <p className="text-sm md:text-base flex items-center gap-2">
          <span className="font-semibold">Cliente:</span>
          {customer ? (
            <Link
              to={`/backoffice/customers/${customer.id}`}
              className="text-blue-600 underline hover:text-blue-700"
            >
              {customer.name}
            </Link>
          ) : (
            "N/D"
          )}
        </p>

        <p className="text-sm md:text-base mt-1 flex items-center gap-2">
          <span className="font-semibold">Località:</span>
          {order.location?.address ? (
            <>
              <MapPin size={16} className="opacity-70" />
              <span>{order.location.address}</span>
            </>
          ) : (
            <span>-</span>
          )}
          {order.location?.mapsUrl && (
            <a
              href={order.location.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700 flex items-center gap-1 ml-2"
            >
              <LinkIcon size={16} /> Apri in Maps
            </a>
          )}
        </p>
      </div>

      {/* ===== Box Note Commessa ===== */}
      <div className="bg-white shadow rounded-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-2">📝 Note commessa</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Annota qui informazioni utili..."
          className="w-full p-2 border rounded-lg mb-3"
          rows={4}
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNotes(order?.notes ?? "");
            }}
            title="Annulla modifiche"
            className="gap-2 py-2.5 font-medium"
          >
            <X size={16} />
            Annulla
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveNotes}
            className="gap-2 py-2.5 font-semibold"
          >
            <Save size={16} />
            Salva Note
          </Button>
        </div>
      </div>

      {/* ===== Allegati ===== */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">📎 Allegati commessa</h2>

        <StorageUsageBanner refreshKey={storageRefreshKey} className="mb-4" />

        <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 text-gray-500 cursor-pointer hover:border-blue-500 hover:text-blue-500 transition">
          <input
            key={documenti.length}
            type="file"
            multiple
            onChange={handleUploadFiles}
            className="hidden"
            disabled={loadingDocs}
          />
          <span className="text-sm">
            {loadingDocs
              ? "⏳ Caricamento in corso..."
              : "Trascina file o clicca per caricare"}
          </span>
        </label>

        {uploadProgress && uploadProgress.total > 0 && (
          <UploadProgressBar
            className="mt-3"
            completed={uploadProgress.done}
            total={uploadProgress.total}
            label={uploadProgress.name}
          />
        )}

        {documenti.length === 0 ? (
          <p className="text-gray-500 mt-4">Nessun documento caricato</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-200">
            {documenti.map((doc) => {
              const d = formatDocumento(doc);
              return (
                <li
                  key={d.id}
                  className="flex justify-between items-center py-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText size={22} className="opacity-70" />
                    <div>
                      <a
                        href={resolveDocumentUrl(d.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline hover:text-blue-700"
                      >
                        {d.fileName}
                      </a>
                      <div className="text-xs text-gray-400">
                        {d.formattedDate}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(d.id)}
                    className="p-2 hover:text-red-600"
                    title="Elimina file"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ===== Riepilogo Pagamenti (A: as-is) ===== */}
      <div className="bg-white shadow rounded-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-2">
          💰 Riepilogo pagamenti
        </h2>
        {allPayments.length === 0 ? (
          <p className="text-gray-500">Nessun pagamento registrato</p>
        ) : (
          <>
            <ul className="space-y-2 mb-4">
              {allPayments.map((p) => {
                const job = jobs.find((j) => j.id === p.jobId);
                return (
                  <li
                    key={p.id}
                    className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 border p-2 rounded-lg"
                  >
                    <span className="text-sm md:text-base">
                      {p.label} — {p.amount.toFixed(2)} € —{" "}
                      <span
                        className={
                          p.collected ? "text-green-600" : "text-red-600"
                        }
                      >
                        {p.collected ? "Incassato" : "Da incassare"}
                      </span>{" "}
                      {job && (
                        <span className="text-gray-500 ml-0 md:ml-2 block md:inline">
                          (Intervento: {jobTitleDisplay(job.title)})
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="border-t pt-3 text-sm md:text-base space-y-1">
              <div>
                <strong>Totale previsto:</strong> {totalExpected.toFixed(2)} €
              </div>
              <div className="text-green-600">
                <strong>Totale incassato:</strong> {totalCollected.toFixed(2)} €
              </div>
              <div
                className={
                  totalPending > 0
                    ? "text-red-700 font-bold"
                    : "text-green-700 font-bold"
                }
              >
                <strong>Residuo:</strong> {totalPending.toFixed(2)} €
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== Interventi (Jobs) ===== */}
      <div className="bg-white shadow rounded-lg p-4 md:p-6">
        {/* Header lista interventi */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
          <h2 className="text-lg md:text-xl font-bold">
            👷 Interventi ({sortedJobs.length})
          </h2>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setFormData({});
              setEditingId(null);
              setShowForm(true);
            }}
            className="w-full gap-2 py-2.5 font-semibold md:w-auto"
          >
            <Plus size={16} />
            Nuovo Intervento
          </Button>
        </div>

        {/* Mobile: card compatte */}
        <div className="md:hidden space-y-2">
          {sortedJobs.length === 0 ? (
            <p className="text-gray-500">Nessun intervento presente</p>
          ) : (
            sortedJobs.map((j) => {
              const st = getJobDisplayStatus(j.persistedStatus ?? j.status, j.plannedDate);
              const cfg = STATUS_CONFIG[st];
              const isLateRow = j.plannedDate && st === "in_ritardo";
              const highlight = lastCreatedJobId === j.id;

              return (
                <div
                  key={j.id}
                  className={`bg-white border rounded-xl p-3 shadow-sm cursor-pointer transition flex flex-col gap-1
            ${
              highlight
                ? "bg-green-100 animate-pulse"
                : "active:bg-gray-100 hover:bg-gray-50"
            }
            ${isLateRow ? "ring-1 ring-red-300" : ""}`}
                  onClick={() => navigate(`/backoffice/jobs/${j.id}`)}
                >
                  {/* Data + Tipo */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2 text-gray-700">
                      <Calendar size={14} className="opacity-70" />
                      {j.plannedDate ? formatDateTime(j.plannedDate) : "-"}
                    </div>
                    <div className="font-semibold text-sm">
                      {jobTitleDisplay(j.title)}
                    </div>
                  </div>

                  {/* Squadra */}
                  <div className="text-xs text-gray-600 flex items-center gap-2">
                    <Users size={14} className="opacity-70" />
                    {j.assignedWorkers?.length
                      ? j.assignedWorkers
                          .map((wid) => workers.find((w) => w.id === wid)?.name)
                          .join(", ")
                      : "-"}
                  </div>

                  {/* Stato */}
                  <div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        cfg?.color ?? "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {cfg?.icon} {cfg?.label ?? st}
                    </span>
                  </div>

                  {/* Notes */}
                  {j.notes && (
                    <div className="text-xs text-gray-600 truncate">
                      📝 {j.notes}
                    </div>
                  )}

                  {/* Azioni */}
                  <div className="flex gap-1 mt-1 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(j);
                      }}
                      className="p-1 rounded-md hover:bg-yellow-100 text-yellow-600"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(j.id);
                      }}
                      className="p-1 rounded-md hover:bg-red-100 text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: tabella */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full border-collapse bg-white shadow-sm rounded-lg overflow-hidden text-sm">
            <thead className="bg-gray-100 text-left text-gray-600 uppercase text-xs font-semibold tracking-wider">
              <tr>
                <th className="p-3">Data programmata</th>
                <th className="p-3">Tipologia</th>
                <th className="p-3">Squadra</th>
                <th className="p-3">Stato</th>
                <th className="p-3">Note</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((j) => {
                const st = getJobDisplayStatus(j.persistedStatus ?? j.status, j.plannedDate);
                const cfg = STATUS_CONFIG[st];
                const isLateRow = j.plannedDate && st === "in_ritardo";
                const highlight = lastCreatedJobId === j.id;

                return (
                  <tr
                    key={j.id}
                    className={`border-t cursor-pointer transition-colors ${
                      highlight
                        ? "bg-green-100 animate-pulse"
                        : "hover:bg-gray-50"
                    } ${isLateRow ? "bg-red-50" : ""}`}
                    onClick={() => navigate(`/backoffice/jobs/${j.id}`)}
                  >
                    {/* Data */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="opacity-70" />
                        <span>
                          {j.plannedDate ? formatDateTime(j.plannedDate) : "-"}
                        </span>
                      </div>
                    </td>

                    {/* Tipologia con emoji inline */}
                    <td className="p-3">{jobTitleDisplay(j.title)}</td>

                    {/* Squadra */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="opacity-70" />
                        <span>
                          {j.assignedWorkers?.length
                            ? j.assignedWorkers
                                .map(
                                  (wid) =>
                                    workers.find((w) => w.id === wid)?.name
                                )
                                .join(", ")
                            : "-"}
                        </span>
                      </div>
                    </td>

                    {/* Stato */}
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          cfg?.color ?? "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {cfg?.icon} {cfg?.label ?? st}
                      </span>
                    </td>

                    {/* Note */}
                    <td className="p-3 text-gray-600 truncate max-w-[260px]">
                      {j.notes || "-"}
                    </td>

                    {/* Azioni */}
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          title="Modifica"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(j);
                          }}
                          className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          title="Elimina"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(j.id);
                          }}
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedJobs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center p-4 text-gray-500 italic"
                  >
                    Nessun intervento presente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Modale Nuovo/Modifica Intervento ===== */}
      {showForm && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-md space-y-3 p-5 sm:p-6`}>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">
              {editingId ? "Modifica intervento" : "Nuovo intervento"}
            </h2>

            {/* Tipologia */}
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tipologia *
            </label>
            <select
              name="type"
              value={formData.title ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  title: e.target.value as Job["title"],
                })
              }
              className={`${selectFieldClass} mb-1 w-full`}
            >
              <option value="">Seleziona tipo *</option>
              {JOB_TITLE_SELECT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* Note */}
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note
            </label>
            <textarea
              name="notes"
              placeholder="Note interne"
              value={formData.notes ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className={inputFieldClass}
              rows={3}
            />

            <div className="flex flex-col gap-2 pt-1 md:flex-row md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setFormData({});
                  setEditingId(null);
                }}
                className="inline-flex w-full gap-2 py-2.5 font-medium md:w-auto"
              >
                <X size={16} />
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveJob}
                className="inline-flex w-full gap-2 py-2.5 font-semibold md:w-auto"
              >
                <Save size={16} />
                Salva
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Conferma eliminazione intervento ===== */}
      <ConfirmDialog
        open={openConfirm}
        setOpen={setOpenConfirm}
        title="Elimina intervento"
        description="Sei sicuro di voler eliminare questo intervento? L'azione non può essere annullata."
        confirmText="Elimina"
        cancelText="Annulla"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
