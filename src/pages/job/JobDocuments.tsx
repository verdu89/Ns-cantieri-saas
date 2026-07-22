import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import type { Documento } from "@/types";
import { documentAPI, resolveDocumentUrl } from "@/api/documentAPI";
import { uploadDocumentsToJob } from "@/utils/uploadDocuments";
import UploadProgressBar from "@/components/ui/UploadProgressBar";
import { useUploadQueue } from "@/context/UploadQueueContext";
import { toast } from "react-hot-toast";
import { modalBackdropClass, modalPanelClass } from "@/components/layout/PageChrome";
import { parseHttpErrorMessage } from "@/utils/httpError";
import { isVisibleJobAttachment, isOrderSourcedDocument } from "@/lib/checkoutDocuments";

interface JobDocumentsProps {
  docs: Documento[];
  setDocs: (v: Documento[]) => void;
  jobId: string;
  canEdit?: boolean;
  onStorageChange?: () => void;
}

export default function JobDocuments({
  docs,
  setDocs,
  jobId,
  canEdit = false,
  onStorageChange,
}: JobDocumentsProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    name?: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Documento | null>(null);
  const { notifyQueued, refreshPendingCount } = useUploadQueue();

  const isImage = (fileName: string) =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

  // Upload multiplo
  const handleUploadDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return; // 🔒 blocco in sola lettura
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const fileList = Array.from(files);
      const result = await uploadDocumentsToJob(
        jobId,
        fileList.map((file) => ({ file })),
        {
          allowPartial: true,
          onStorageChange,
          onProgress: (done, total, name) =>
            setUploadProgress({ done, total, name }),
        }
      );

      if (result.queued.length > 0) notifyQueued(result.queued.length);
      void refreshPendingCount();

      if (result.succeeded.length > 0) {
        setDocs([...docs, ...result.succeeded.map((s) => s.doc)]);
      }

      if (result.succeeded.length === 0 && result.queued.length === 0) {
        toast.error(
          parseHttpErrorMessage(
            new Error(result.failed[0]?.error),
            "Errore durante il caricamento dei file"
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
        toast.success(`📤 Caricati ${result.succeeded.length} file correttamente`);
      }
    } catch (err) {
      console.error("Upload documenti job fallito:", err);
      toast.error(
        parseHttpErrorMessage(err, "Errore durante il caricamento dei file")
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = ""; // reset input
    }
  };

  // Eliminazione documento
  const handleDeleteDoc = async (doc: Documento) => {
    if (!canEdit) return; // 🔒 blocco in sola lettura
    setDeletingId(doc.id);
    try {
      await documentAPI.deleteFromJob(doc.id);
      setDocs(docs.filter((d) => d.id !== doc.id));

      toast.success("🗑️ Documento eliminato");
      onStorageChange?.();
    } catch (err) {
      console.error("Eliminazione documento job fallita:", err);
      toast.error("Errore durante l'eliminazione");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <Card className="scroll-on-open">
        <CardHeader>
          <CardTitle>📂 Documenti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Allegati dell&apos;intervento e documenti commessa visibili in cantiere
            (caricati in ufficio salvo «Nascondi in cantiere»). Quelli commessa si
            aggiornano su tutti gli interventi senza ricaricarli.
          </p>

          <div>
            <div className="font-medium mb-2">Documenti</div>

            {docs?.filter(isVisibleJobAttachment).length ? (
              <ul className="mt-2 text-sm divide-y">
                {docs.filter(isVisibleJobAttachment).map((d) => {
                  const fromOrder = isOrderSourcedDocument(d);
                  const isFineLavoro =
                    !fromOrder &&
                    (d.checkoutIndex != null ||
                      d.fileName?.startsWith("fine_lavoro_") ||
                      d.fileName?.startsWith("checkout_"));
                  const img = isImage(d.fileName);

                  return (
                    <li
                      key={`${d.source ?? "job"}-${d.id}`}
                      className="flex flex-col md:flex-row md:justify-between md:items-center py-2 gap-2"
                    >
                      <div className="flex items-center gap-3 max-w-full">
                        {img && (
                          <img
                            src={resolveDocumentUrl(d.fileUrl)}
                            alt={d.fileName}
                            className="w-10 h-10 object-cover rounded border"
                          />
                        )}
                        <div className="flex flex-col min-w-0">
                          <a
                            href={resolveDocumentUrl(d.fileUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={d.fileName}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="truncate break-all text-brand hover:underline"
                          >
                            {d.fileName}
                          </a>
                          {fromOrder && (
                            <span className="mt-1 inline-block text-xs px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full w-fit">
                              Commessa
                            </span>
                          )}
                          {isFineLavoro && (
                            <span className="mt-1 inline-block text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full w-fit">
                              {d.checkoutIndex
                                ? `Checkout #${d.checkoutIndex}`
                                : "Fine lavoro"}
                            </span>
                          )}
                        </div>
                      </div>

                      {canEdit && !fromOrder && (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => setConfirmDelete(d)}
                          disabled={deletingId === d.id}
                          className="w-full font-semibold sm:w-auto"
                        >
                          {deletingId === d.id
                            ? "⏳ Eliminazione..."
                            : "🗑️ Elimina"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">
                Nessun documento per l’intervento.
              </div>
            )}

            {canEdit && (
              <div className="mt-6">
                <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 text-slate-500 cursor-pointer hover:border-brand hover:text-brand transition text-center text-sm">
                  <input
                    key={docs.length} // forza il reset dell’input
                    type="file"
                    multiple
                    onChange={handleUploadDocs}
                    disabled={uploading}
                    className="hidden"
                  />

                  {uploading
                    ? "⏳ Caricamento in corso..."
                    : "📤 Trascina file o clicca per caricare"}
                </label>
                {uploadProgress && uploadProgress.total > 0 && (
                  <UploadProgressBar
                    className="mt-3"
                    completed={uploadProgress.done}
                    total={uploadProgress.total}
                    label={uploadProgress.name}
                  />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modale conferma eliminazione */}
      {confirmDelete && canEdit && (
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
            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                className="w-full py-2.5 text-sm font-medium sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => handleDeleteDoc(confirmDelete)}
                className="w-full py-2.5 text-sm font-semibold sm:w-auto"
              >
                Elimina
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
