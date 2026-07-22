import { FileText } from "lucide-react";
import type { Documento } from "@/types";
import { resolveDocumentUrl } from "@/api/documentAPI";
import { formatDocumento, isOrderDocumentHiddenOnField } from "@/utils/documenti";
import { surfaceCardClass } from "@/components/layout/PageChrome";

type Props = {
  documents: Documento[];
  onToggleHideOnField: (doc: Documento, hideOnField: boolean) => void;
};

export default function OrderDocumentVisibilityPanel({
  documents,
  onToggleHideOnField,
}: Props) {
  return (
    <div className={`space-y-3 p-4 md:p-6 ${surfaceCardClass}`}>
      <div>
        <h2 className="text-lg font-bold text-slate-900 md:text-xl">
          Visibilità documenti in cantiere
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Gli allegati commessa sono visibili in cantiere di default. Spunta
          &quot;Nascondi in cantiere&quot; solo per documenti riservati all&apos;ufficio.
        </p>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">Nessun allegato sulla commessa.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {documents.map((doc) => {
            const d = formatDocumento(doc);
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <FileText size={20} className="mt-0.5 shrink-0 opacity-70" />
                  <div className="min-w-0">
                    <a
                      href={resolveDocumentUrl(d.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {d.fileName}
                    </a>
                    <div className="text-xs text-slate-400">{d.formattedDate}</div>
                  </div>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isOrderDocumentHiddenOnField(doc)}
                    onChange={(e) => onToggleHideOnField(doc, e.target.checked)}
                  />
                  Nascondi in cantiere
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
