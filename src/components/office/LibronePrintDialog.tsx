import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileDown, Loader2, X } from "lucide-react";
import {
  libroneExportAPI,
  type LibroneExportDefaults,
} from "@/api/libroneExport";
import { Button } from "@/components/ui/Button";
import {
  inputFieldClass,
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  modalSafeFooterClass,
} from "@/components/layout/PageChrome";
import type { OfficeElencoSectionId } from "@/utils/officeElenco";

type Props = {
  open: boolean;
  onClose: () => void;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LibronePrintDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [defaults, setDefaults] = useState<LibroneExportDefaults | null>(null);
  const [weekLabel, setWeekLabel] = useState("");
  const [lastCommessaCode, setLastCommessaCode] = useState("");
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void libroneExportAPI
      .defaults()
      .then((data) => {
        setDefaults(data);
        setWeekLabel(data.weekLabel);
        setLastCommessaCode(data.lastCommessaCode);
        const map: Record<string, boolean> = {};
        for (const section of data.sections) {
          map[section.id] = section.defaultExcluded;
        }
        setExcluded(map);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Errore caricamento opzioni stampa");
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, onClose]);

  const includedCount = useMemo(() => {
    if (!defaults) return 0;
    return defaults.sections.reduce((n, section) => {
      if (excluded[section.id]) return n;
      return n + section.rowCount;
    }, 0);
  }, [defaults, excluded]);

  const toggleExcluded = (id: OfficeElencoSectionId) => {
    setExcluded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerate = async () => {
    if (!weekLabel.trim()) {
      toast.error("Inserisci la settimana in copertina");
      return;
    }
    if (!lastCommessaCode.trim()) {
      toast.error("Inserisci il testo dopo «fino alla» in copertina");
      return;
    }

    const excludeSections = Object.entries(excluded)
      .filter(([, value]) => value)
      .map(([id]) => id as OfficeElencoSectionId);

    setGenerating(true);
    try {
      const blob = await libroneExportAPI.downloadPdf({
        excludeSections,
        coverWeekLabel: weekLabel.trim(),
        coverLastCommessa: lastCommessaCode.trim(),
      });
      downloadBlob(blob, `Elenco-GENERALE-${weekLabel.trim()}.pdf`);
      toast.success("PDF librone generato");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Errore generazione PDF");
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div className={modalBackdropClass} onClick={onClose}>
      <div
        className={`${modalPanelClass} flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col sm:max-h-[min(90vh,880px)]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="librone-print-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="librone-print-title" className="text-lg font-semibold text-slate-900">
              Stampa librone PDF
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Layout come il PDF Access. Scegli cosa escludere e i dati di copertina.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {loading || !defaults ? (
          <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-slate-600">
            <Loader2 className="animate-spin" size={20} />
            Caricamento…
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Settimana librone
                  </span>
                  <input
                    type="text"
                    value={weekLabel}
                    onChange={(e) => setWeekLabel(e.target.value)}
                    placeholder="25-2026"
                    className={inputFieldClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Di default la settimana precedente (stampa del lunedì).
                  </span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Testo copertina «fino alla»
                  </span>
                  <input
                    type="text"
                    value={lastCommessaCode}
                    onChange={(e) => setLastCommessaCode(e.target.value)}
                    placeholder="6-115"
                    className={inputFieldClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Testo libero in copertina (es. 6-115 o altro riferimento).
                  </span>
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Escludi categorie dalla stampa
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  {defaults.sections.map((section) => (
                    <label
                      key={section.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(excluded[section.id])}
                        onChange={() => toggleExcluded(section.id)}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-slate-800">
                          {section.pdfNumber}) {section.title}
                        </span>
                        <span className="ml-2 text-slate-500">({section.rowCount})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-sm text-slate-600">
                Commesse incluse: <strong>{includedCount}</strong>
              </p>
            </div>

            <div
              className={`shrink-0 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6 ${modalSafeFooterClass}`}
            >
              <div className={modalActionsClass}>
                <Button type="button" variant="outline" onClick={onClose}>
                  Annulla
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating || includedCount === 0}
                  className="inline-flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileDown size={16} />
                  )}
                  Genera PDF
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
