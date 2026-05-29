import { Button } from "@/components/ui/Button";
// File: pages/backoffice/DocumentiPage.tsx
import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, Download, Search } from "lucide-react";
import { jobOrderAPI } from "../../api/jobOrders";
import { documentAPI, resolveDocumentUrl } from "../../api/documentAPI";
import { jobAPI } from "../../api/jobs";
import type { JobOrder, Documento } from "../../types";
import { formatDocumento } from "../../utils/documenti";
import { uploadDocumentsToOrder } from "@/utils/uploadDocuments";
import toast, { Toaster } from "react-hot-toast";
import {
  PageHeader,
  filterBarClass,
  selectFieldClass,
  inputFieldClass,
  surfaceCardClass,
  modalBackdropClass,
  modalPanelClass,
} from "@/components/layout/PageChrome";
import StorageUsageBanner from "@/components/StorageUsageBanner";
import { parseHttpErrorMessage } from "@/utils/httpError";
import UploadProgressBar from "@/components/ui/UploadProgressBar";
import { useUploadQueue } from "@/context/UploadQueueContext";

interface DocumentoExtended extends Documento {
  source: "commessa" | "job";
  commessaCode?: string;
}

export default function DocumentiPage() {
  const [commesse, setCommesse] = useState<JobOrder[]>([]);
  const [documenti, setDocumenti] = useState<DocumentoExtended[]>([]);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCommessa, setUploadCommessa] = useState<string>("");

  // Ref per resettare input file
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    name?: string;
  } | null>(null);
  const { notifyQueued, refreshPendingCount } = useUploadQueue();

  // 🔎 Filtri
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  // 🔹 Modale eliminazione
  const [confirmDelete, setConfirmDelete] = useState<DocumentoExtended | null>(
    null
  );

  // 🔹 Carico commesse e documenti
  useEffect(() => {
    async function loadData() {
      const c = await jobOrderAPI.list();
      setCommesse(c);

      const docsOrder = await Promise.all(
        c.map(async (commessa) => {
          const d = await documentAPI.listByOrder(commessa.id);
          return d.map((doc) => ({
            ...doc,
            source: "commessa" as const,
            commessaCode: commessa.code,
          }));
        })
      );

      const docsJob = await Promise.all(
        c.map(async (commessa) => {
          const jobs = await jobAPI.listByOrder(commessa.id);
          const allDocs: DocumentoExtended[] = [];
          for (const job of jobs) {
            const d = await documentAPI.listByJob(job.id);
            allDocs.push(
              ...d.map((doc) => ({
                ...doc,
                source: "job" as const,
                commessaCode: commessa.code,
              }))
            );
          }
          return allDocs;
        })
      );

      // 🔹 Rimuovo duplicati
      setDocumenti(
        [...docsOrder.flat(), ...docsJob.flat()].filter(
          (doc, index, self) =>
            index ===
            self.findIndex((d) => d.id === doc.id && d.source === doc.source)
        )
      );
    }

    loadData();
  }, []);

  // 🔹 Upload documento su commessa
  async function handleUpload() {
    if (!uploadFile || !uploadCommessa) {
      toast.error("Seleziona una commessa e un file ❌");
      return;
    }

    const commessa = commesse.find((c) => c.id === uploadCommessa);
    if (!commessa) {
      toast.error("Commessa non valida ❌");
      return;
    }

    setUploading(true);
    try {
      const uploadResult = await uploadDocumentsToOrder(commessa.id, [
        { file: uploadFile },
      ], {
        onStorageChange: () => setStorageRefreshKey((k) => k + 1),
        onProgress: (done, total, name) =>
          setUploadProgress({ done, total, name }),
      });

      if (uploadResult.queued.length > 0) notifyQueued(uploadResult.queued.length);
      void refreshPendingCount();

      if (uploadResult.succeeded.length === 0 && uploadResult.queued.length === 0) {
        throw new Error(uploadResult.failed[0]?.error ?? "Upload fallito");
      }

      const docs = await documentAPI.listByOrder(commessa.id);

      // 🔹 Aggiungo e deduplico
      setDocumenti((prev) => {
        const nuoviDocs = docs.map((doc) => ({
          ...doc,
          source: "commessa" as const,
          commessaCode: commessa.code,
        }));

        const unione = [...prev, ...nuoviDocs];

        return unione.filter(
          (doc, index, self) =>
            index ===
            self.findIndex((d) => d.id === doc.id && d.source === doc.source)
        );
      });

      // 🔹 Reset commessa e file
      setUploadCommessa("");
      setUploadFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (uploadResult.queued.length > 0 && uploadResult.succeeded.length === 0) {
        toast.success("Documento in coda: verrà caricato appena possibile");
      } else {
        toast.success("Documento caricato con successo ✅");
      }
    } catch (err) {
      console.error("Errore durante upload:", err);
      toast.error(parseHttpErrorMessage(err, "Errore durante il caricamento ❌"));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  // 🔹 Conferma eliminazione
  async function confirmDeleteDoc(doc: DocumentoExtended) {
    try {
      if (doc.source === "commessa") {
        await documentAPI.deleteFromOrder(doc.id);
      } else {
        await documentAPI.deleteFromJob(doc.id);
      }

      setDocumenti((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Documento eliminato ✅");
    } catch (err) {
      console.error("Errore eliminazione:", err);
      toast.error("Errore durante eliminazione ❌");
    } finally {
      setConfirmDelete(null);
    }
  }

  // 🔎 Applico filtri
  const documentiFiltrati = documenti.filter((doc) => {
    const d = formatDocumento(doc);
    return (
      (!filterTipo || doc.source === filterTipo) &&
      (!search ||
        d.fileName.toLowerCase().includes(search.toLowerCase()) ||
        (doc.commessaCode ?? "").toLowerCase().includes(search.toLowerCase()))
    );
  });

  // 🔹 Recupero codice commessa selezionata
  const commessaSelezionata = commesse.find((c) => c.id === uploadCommessa);

  return (
    <main className="space-y-5">
      <Toaster position="top-right" />

      <PageHeader
        title="Archivio documenti"
        description="Allegati per commessa e intervento."
        actions={
          <div className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-900/5 md:w-80">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca documento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        }
      />

      <StorageUsageBanner refreshKey={storageRefreshKey} />

      {/* Filtro tipo documento */}
      <div className={filterBarClass}>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className={`${selectFieldClass} w-full md:w-48`}
        >
          <option value="">Tutti i tipi</option>
          <option value="commessa">Commessa</option>
          <option value="job">Intervento</option>
        </select>
      </div>

      {/* Form caricamento */}
      <div className={`space-y-3 p-4 sm:p-5 ${surfaceCardClass}`}>
        <h2 className="font-semibold">Carica nuovo documento su commessa</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 🔹 Campo ricerca commessa */}
          <div className="relative">
            <input
              type="text"
              value={commessaSelezionata?.code || uploadCommessa}
              onChange={(e) => setUploadCommessa(e.target.value)}
              placeholder="Inserisci codice commessa..."
              className={inputFieldClass}
            />
            {uploadCommessa.length > 0 && !commessaSelezionata && (
              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-900/5">
                {commesse
                  .filter((c) =>
                    c.code.toLowerCase().includes(uploadCommessa.toLowerCase())
                  )
                  .map((c) => (
                    <div
                      key={c.id}
                      className="cursor-pointer px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setUploadCommessa(c.id)}
                    >
                      {c.code}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <input
            key={documenti.length} // 👈 forza reset dell’input dopo upload
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className={inputFieldClass}
          />

          <Button
            onClick={handleUpload}
            variant="primary"
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 py-2.5 font-semibold md:w-auto"
          >
            <Upload className="w-5 h-5" /> {uploading ? "Caricamento…" : "Carica"}
          </Button>
          {uploadProgress && uploadProgress.total > 0 && (
            <UploadProgressBar
              className="md:col-span-2"
              completed={uploadProgress.done}
              total={uploadProgress.total}
              label={uploadProgress.name}
            />
          )}
        </div>
      </div>

      {/* Lista Documenti */}
      <div className={surfaceCardClass}>
        {/* Desktop */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="p-3">Nome file</th>
                <th className="p-3">Commessa</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Caricato da</th>
                <th className="p-3">Data</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {documentiFiltrati.map((doc) => {
                const d = formatDocumento(doc);
                return (
                  <tr
                    key={`desktop-${doc.source}-${d.id}`}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/80"
                  >
                    <td className="p-3 flex items-center gap-2">
                      {d.icon} {d.fileName}
                    </td>
                    <td className="p-3">{doc.commessaCode ?? "-"}</td>
                    <td className="p-3">
                      {doc.source === "commessa" ? "Commessa" : "Intervento"}
                    </td>
                    <td className="p-3">{d.uploadedBy}</td>
                    <td className="p-3">{d.formattedDate}</td>
                    <td className="p-3 text-right flex gap-2 justify-end">
                      <a
                        href={resolveDocumentUrl(d.fileUrl)}
                        download
                        className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50"
                        title="Scarica"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmDelete(doc)}
                        className="p-2 text-red-600 transition hover:bg-red-50"
                        title="Elimina"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {documentiFiltrati.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    Nessun documento trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y">
          {documentiFiltrati.map((doc) => {
            const d = formatDocumento(doc);
            return (
              <div
                key={`mobile-${doc.source}-${d.id}`}
                className="p-4 flex flex-col space-y-2"
              >
                <div className="flex items-center gap-2">
                  {d.icon} <span className="font-medium">{d.fileName}</span>
                </div>
                <p className="text-sm text-slate-600">
                  <strong>Commessa:</strong> {doc.commessaCode ?? "-"}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Tipo:</strong>{" "}
                  {doc.source === "commessa" ? "Commessa" : "Intervento"}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Caricato da:</strong> {d.uploadedBy}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Data:</strong> {d.formattedDate}
                </p>
                <div className="flex gap-2 mt-3">
                  <a
                    href={resolveDocumentUrl(d.fileUrl)}
                    download
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    ⬇️ Scarica
                  </a>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setConfirmDelete(doc)}
                    className="flex-1 py-2.5 text-sm font-semibold"
                  >
                    🗑️ Elimina
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modale conferma */}
      {confirmDelete && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-md space-y-4 p-6`}>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Conferma eliminazione
            </h2>
            <p className="text-sm text-slate-600">
              Sei sicuro di voler eliminare{" "}
              <span className="font-medium text-slate-900">
                {confirmDelete.fileName}
              </span>
              ?
            </p>
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                className="py-2.5 font-medium"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => confirmDeleteDoc(confirmDelete)}
                className="py-2.5 font-semibold"
              >
                Elimina
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
