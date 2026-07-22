import { Trash2, FileText } from "lucide-react";
import type { Customer, Documento, Job, JobOrder, OrderPayment } from "@/types";
import OfficeWorkflowPanel from "@/components/office/OfficeWorkflowPanel";
import OrderPaymentsPanel from "@/components/office/OrderPaymentsPanel";
import StorageUsageBanner from "@/components/StorageUsageBanner";
import UploadProgressBar from "@/components/ui/UploadProgressBar";
import { resolveDocumentUrl } from "@/api/documentAPI";
import { formatDocumento, isOrderDocumentHiddenOnField } from "@/utils/documenti";
import { surfaceCardClass } from "@/components/layout/PageChrome";

type Props = {
  order: JobOrder;
  jobs: Job[];
  customer: Customer | null;
  documenti: Documento[];
  orderPayments: OrderPayment[];
  loadingDocs: boolean;
  uploadProgress: { done: number; total: number; name?: string } | null;
  storageRefreshKey: number;
  showWorkflow?: boolean;
  onOrderUpdated: (order: JobOrder) => void;
  onPaymentsChange: (payments: OrderPayment[]) => void;
  onUploadFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (docId: string) => void;
  onToggleHideOnField: (doc: Documento, hide: boolean) => void;
};

export default function OrderOfficeTab({
  order,
  jobs,
  customer,
  documenti,
  orderPayments,
  loadingDocs,
  uploadProgress,
  storageRefreshKey,
  onOrderUpdated,
  onPaymentsChange,
  onUploadFiles,
  onDeleteFile,
  onToggleHideOnField,
  showWorkflow = true,
}: Props) {
  return (
    <div className="space-y-5">
      {showWorkflow && (
        <OfficeWorkflowPanel
          order={order}
          jobs={jobs}
          customer={customer}
          onUpdated={onOrderUpdated}
        />
      )}

      <div className={`${surfaceCardClass} p-4 md:p-6`}>
        <h2 className="mb-1 text-lg font-bold text-slate-900">Pagamenti commessa</h2>
        <p className="mb-4 text-sm text-slate-600">
          Piano incassi solo ufficio. All&apos;intervento scegli cosa far vedere al
          montatore; restano sulla commessa anche prima di creare consegna o montaggio.
        </p>
        <OrderPaymentsPanel
          orderId={order.id}
          payments={orderPayments}
          onChange={onPaymentsChange}
        />
      </div>

      <div className={`${surfaceCardClass} p-4 md:p-6`}>
        <h2 className="mb-1 text-lg font-bold text-slate-900">Allegati commessa</h2>
        <p className="mb-4 text-sm text-slate-600">
          Carica documenti qui. Di default sono visibili in cantiere; spunta
          &quot;Nascondi in cantiere&quot; solo per allegati riservati all&apos;ufficio.
        </p>

        <StorageUsageBanner refreshKey={storageRefreshKey} className="mb-4" />

        <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-slate-500 transition hover:border-sky-500 hover:text-sky-600">
          <input
            key={documenti.length}
            type="file"
            multiple
            onChange={onUploadFiles}
            className="hidden"
            disabled={loadingDocs}
          />
          <span className="text-sm">
            {loadingDocs ? "Caricamento…" : "Trascina file o clicca per caricare"}
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
          <p className="mt-4 text-sm text-slate-500">Nessun documento</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {documenti.map((doc) => {
              const d = formatDocumento(doc);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText size={20} className="mt-0.5 shrink-0 opacity-70" />
                    <div>
                      <a
                        href={resolveDocumentUrl(d.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {d.fileName}
                      </a>
                      <div className="text-xs text-slate-400">{d.formattedDate}</div>
                      <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={isOrderDocumentHiddenOnField(doc)}
                          onChange={(e) =>
                            void onToggleHideOnField(doc, e.target.checked)
                          }
                        />
                        Nascondi in cantiere
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDeleteFile(d.id)}
                    className="p-2 text-slate-400 hover:text-red-600"
                    title="Elimina"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
