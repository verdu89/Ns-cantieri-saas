import type { Documento } from "@/types";
import { resolveDocumentUrl } from "@/api/documentAPI";

type Props = {
  docs: Documento[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
};

export function CheckoutPendingAttachments({
  docs,
  selectedIds,
  onToggle,
  disabled,
  emptyMessage,
}: Props) {
  if (docs.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {emptyMessage ??
          "Nessuna foto in documenti intervento da associare. Puoi caricarle dalla scheda intervento."}
      </p>
    );
  }

  return (
    <ul className="max-h-56 space-y-2 overflow-y-auto sm:max-h-48">
      {docs.map((d) => {
        const img = /\.(jpg|jpeg|png|gif|webp)$/i.test(d.fileName);
        const checked = selectedIds.includes(d.id);
        return (
          <li key={d.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToggle(d.id)}
              className={`flex w-full min-h-12 items-center gap-3 rounded-xl border p-3 text-left transition ${
                checked
                  ? "border-brand/40 bg-brand/5 ring-1 ring-brand/20"
                  : "border-slate-200 bg-slate-50/80 active:bg-slate-100"
              } disabled:opacity-60`}
            >
              <input
                type="checkbox"
                className="pointer-events-none h-5 w-5 shrink-0 accent-brand"
                checked={checked}
                readOnly
                tabIndex={-1}
                aria-hidden
              />
              {img && (
                <img
                  src={resolveDocumentUrl(d.fileUrl)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                />
              )}
              <span className="min-w-0 flex-1 text-sm leading-snug text-slate-800">
                {d.fileName}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
