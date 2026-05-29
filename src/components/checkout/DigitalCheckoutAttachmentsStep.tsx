import { Button } from "@/components/ui/Button";
import type { Documento } from "@/types";
import { CheckoutPendingAttachments } from "@/components/checkout/CheckoutPendingAttachments";

type Props = {
  pendingDocs: Documento[];
  selectedDocIds: string[];
  onToggle: (id: string) => void;
  files: File[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (name: string) => void;
};

export function DigitalCheckoutAttachmentsStep({
  pendingDocs,
  selectedDocIds,
  onToggle,
  files,
  onFileUpload,
  onRemoveFile,
}: Props) {
  return (
    <>
      <div>
        <h3 className="font-medium mb-2">📷 Foto in cantiere (documenti intervento)</h3>
        <p className="mb-2 text-xs text-slate-500">
          Spunta le foto da legare a questo checkout. Le altre restano documentazione
          generale del cantiere.
        </p>
        <CheckoutPendingAttachments
          docs={pendingDocs}
          selectedIds={selectedDocIds}
          onToggle={onToggle}
          emptyMessage="Nessuna foto in documenti intervento. Caricale dalla scheda intervento o aggiungile sotto."
        />
      </div>

      <div>
        <h3 className="font-medium mb-2">📎 Nuove foto</h3>
        <p className="mb-2 text-xs text-slate-500">
          Foto caricate qui vengono associate subito a questo checkout.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark sm:flex-none">
            📷 Scatta foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileUpload}
              className="hidden"
            />
          </label>
          <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-200 sm:flex-none">
            📎 Allega file
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={onFileUpload}
              className="hidden"
            />
          </label>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 text-sm space-y-1">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex justify-between items-center border p-2 rounded-md bg-slate-50"
              >
                <div className="truncate max-w-[70%]">
                  {f.name}
                  <span className="ml-2 text-xs text-slate-500">
                    {(f.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => onRemoveFile(f.name)}
                  className="px-3 py-1 text-xs font-semibold"
                >
                  🗑️
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
