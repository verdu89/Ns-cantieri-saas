import { Button } from "@/components/ui/Button";
import type { Documento } from "@/types";
import { CheckoutPendingAttachments } from "@/components/checkout/CheckoutPendingAttachments";

type Props = {
  pendingDocs: Documento[];
  selectedDocIds: string[];
  onToggle: (id: string) => void;
  paperFiles: File[];
  checkoutIndex: number;
  paperPhotoName: (checkoutIndex: number, file: File, fileIndex: number) => string;
  onPaperUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePaper: (name: string) => void;
  disabled?: boolean;
};

export function ManualCheckoutSections({
  pendingDocs,
  selectedDocIds,
  onToggle,
  paperFiles,
  checkoutIndex,
  paperPhotoName,
  onPaperUpload,
  onRemovePaper,
  disabled,
}: Props) {
  return (
    <>
      <details
        className="rounded-xl border border-slate-200 bg-slate-50/50"
        open={selectedDocIds.length > 0}
      >
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-slate-700 select-none">
          📷 Collega foto già scattate in cantiere (opzionale)
          {selectedDocIds.length > 0 ? (
            <span className="ml-2 text-xs font-normal text-brand">
              {selectedDocIds.length} selezionat
              {selectedDocIds.length === 1 ? "a" : "e"}
            </span>
          ) : null}
        </summary>
        <div className="space-y-2 border-t border-slate-200 px-3 py-3">
          <p className="text-xs text-slate-500">
            Spunta le foto da legare a questo checkout. Le altre restano documentazione
            generale del cantiere.
          </p>
          <CheckoutPendingAttachments
            docs={pendingDocs}
            selectedIds={selectedDocIds}
            onToggle={onToggle}
            disabled={disabled}
            emptyMessage="Nessuna foto in documenti intervento. Caricale dalla scheda intervento prima del checkout."
          />
        </div>
      </details>

      <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
        <h3 className="font-medium mb-2">📄 Cartaceo di fine cantiere</h3>
        <p className="mb-2 text-xs text-slate-600">Foto del modulo cartaceo di fine cantiere</p>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark sm:flex-none">
            📷 Scatta foto foglio
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPaperUpload}
              className="hidden"
              disabled={disabled}
            />
          </label>
          <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 sm:flex-none">
            📎 Allega foto foglio
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={onPaperUpload}
              className="hidden"
              disabled={disabled}
            />
          </label>
        </div>
        {paperFiles.length > 0 && (
          <ul className="mt-2 text-sm space-y-1">
            {paperFiles.map((f, fileIndex) => {
              const displayName = paperPhotoName(checkoutIndex, f, fileIndex);
              return (
                <li
                  key={`${f.name}-${fileIndex}`}
                  className="flex justify-between items-center border border-brand/20 bg-white p-2 rounded-md"
                >
                  <div className="truncate max-w-[70%]">
                    {displayName}
                    <span className="ml-2 text-xs text-slate-500">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => onRemovePaper(f.name)}
                    disabled={disabled}
                    className="px-3 py-1 text-xs font-semibold"
                  >
                    🗑️
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
