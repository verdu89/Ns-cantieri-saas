import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  FileText,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  SkipForward,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  libroneImportAPI,
  type LibroneImportPreview,
  type LibroneImportPreviewRow,
} from "@/api/libroneImport";
import {
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  modalSafeFooterClass,
  surfaceCardClass,
} from "@/components/layout/PageChrome";

type LibroneImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "sky" | "amber" | "zinc" | "violet";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
  };

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-center ${tones[tone]}`}
    >
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </div>
    </div>
  );
}

function PreviewRowItem({
  row,
  variant,
  checked,
  onToggle,
}: {
  row: LibroneImportPreviewRow;
  variant: "create" | "update";
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
        aria-label={`Importa ${row.code}`}
      />
      <span
        className={`mt-0.5 inline-flex h-6 shrink-0 items-center rounded-md px-2 font-mono text-xs font-bold ${
          variant === "create"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-sky-100 text-sky-800"
        }`}
      >
        {row.code}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {row.displayName}
        </p>
        {variant === "update" && row.changes.length > 0 && (
          <p className="mt-0.5 text-xs text-slate-500">
            {row.changes.map((c) => c.label).join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}

export default function LibroneImportDialog({
  open,
  onClose,
  onApplied,
}: LibroneImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LibroneImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [selectedReconcileIds, setSelectedReconcileIds] = useState<Set<string>>(
    new Set()
  );

  const initSelection = (result: LibroneImportPreview) => {
    setSelectedCodes(
      new Set(
        result.rows
          .filter((r) => r.action === "create" || r.action === "update")
          .map((r) => r.code)
      )
    );
    setSelectedReconcileIds(
      new Set(result.reconcileRows.map((r) => r.orderId))
    );
  };

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setDragOver(false);
    setSelectedCodes(new Set());
    setSelectedReconcileIds(new Set());
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const loadPreview = async (picked: File) => {
    if (!picked.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Seleziona un file PDF del librone");
      return;
    }
    setFile(picked);
    setPreview(null);
    setLoading(true);
    try {
      const result = await libroneImportAPI.previewPdf(picked);
      setPreview(result);
      initSelection(result);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Errore lettura PDF librone"
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setLoading(false);
    }
  };

  const handlePick = (picked: File | null) => {
    if (!picked) return;
    void loadPreview(picked);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void loadPreview(dropped);
  };

  const handleApply = async () => {
    if (!file || !preview) return;
    setApplying(true);
    try {
      const result = await libroneImportAPI.applyPdf(file, {
        codes: Array.from(selectedCodes),
        reconcileOrderIds: Array.from(selectedReconcileIds),
      });
      toast.success(
        `Import completato: ${result.created} nuove, ${result.updated} aggiornate, ${result.reconciled} ricalibrate fuori PDF, ${result.unchanged} invariate`
      );
      onApplied();
      handleClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Errore durante l'import librone"
      );
    } finally {
      setApplying(false);
    }
  };

  const creates = preview?.rows.filter((r) => r.action === "create") ?? [];
  const updates = preview?.rows.filter((r) => r.action === "update") ?? [];
  const reconciles = preview?.reconcileRows ?? [];
  const selectedApplyCount =
    creates.filter((r) => selectedCodes.has(r.code)).length +
    updates.filter((r) => selectedCodes.has(r.code)).length +
    reconciles.filter((r) => selectedReconcileIds.has(r.orderId)).length;
  const canApply =
    Boolean(preview) && !loading && !applying && selectedApplyCount > 0;

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleReconcile = (orderId: string) => {
    setSelectedReconcileIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const setCodesSelection = (codes: string[], selected: boolean) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (selected) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  };

  const selectAllApplyable = () => {
    if (!preview) return;
    initSelection(preview);
  };

  const deselectAllApplyable = () => {
    setSelectedCodes(new Set());
    setSelectedReconcileIds(new Set());
  };

  return (
    <div className={modalBackdropClass} onClick={handleClose}>
      <div
        className={`${modalPanelClass} flex max-h-[min(92dvh,100%)] w-full max-w-3xl flex-col sm:max-h-[min(90vh,900px)]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="librone-import-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-slate-900 p-2.5 text-white shadow-sm">
              <FileText size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h2
                id="librone-import-title"
                className="text-lg font-bold tracking-tight text-slate-900"
              >
                Import librone PDF
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Sincronizza commesse attive da Access
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div className={`${surfaceCardClass} space-y-2 p-4 text-sm text-slate-600`}>
            <p className="font-medium text-slate-800">Cosa viene importato</p>
            <ul className="space-y-1.5 text-xs leading-relaxed sm:text-sm">
              <li className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  Dopo l&apos;anteprima puoi <strong>selezionare</strong> quali
                  nuove commesse, aggiornamenti e ricalibrazioni applicare
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  Sezioni <strong>1–5</strong>: nuove commesse e aggiornamento campi
                  librone (codice <code className="rounded bg-slate-100 px-1">6-058</code>{" "}
                  → <code className="rounded bg-slate-100 px-1">26-058</code>)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  Sezione <strong>6</strong> (montaggi): solo note ufficio sulle
                  commesse già in programma
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  Commesse <strong>già in app</strong> (anche create a mano): se
                  compaiono nel PDF, sync completa come Access (settimana, note,
                  stato, C/M…)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  Commesse <strong>fuori dal PDF</strong>: ricalibrazione automatica
                  (terminate se cantiere e pagamenti ok; in cantiere se ancora aperti)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>
                  Sezione <strong>8</strong> (terminate storiche) ignorata · flag{" "}
                  <strong>C/M</strong> assenti = no
                </span>
              </li>
            </ul>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            disabled={loading || applying}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`group w-full rounded-2xl border-2 border-dashed p-6 text-left transition ${
              dragOver
                ? "border-sky-400 bg-sky-50"
                : file
                  ? "border-emerald-300 bg-emerald-50/50"
                  : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-50"
            } ${loading || applying ? "pointer-events-none opacity-70" : ""}`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  file ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500 shadow-sm"
                }`}
              >
                {loading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <FileUp size={24} strokeWidth={1.75} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                {loading ? (
                  <p className="font-medium text-slate-800">
                    Lettura PDF e checkbox C/M con AI…
                  </p>
                ) : file ? (
                  <>
                    <p className="truncate font-semibold text-slate-900">{file.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {(file.size / 1024).toFixed(0)} KB · clicca per cambiare file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-900">
                      Trascina il PDF qui o clicca per scegliere
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      File «Elenco GENERALE» esportato da Access
                    </p>
                  </>
                )}
              </div>
            </div>
          </button>

          {preview && !loading && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <StatCard label="Nel PDF" value={preview.parsedCount} tone="slate" />
                <StatCard label="Nuove" value={preview.createCount} tone="emerald" />
                <StatCard label="Aggiornate" value={preview.updateCount} tone="sky" />
                <StatCard
                  label="Ricalibrate"
                  value={preview.reconcileCount}
                  tone="violet"
                />
                <StatCard label="Invariate" value={preview.unchangedCount} tone="zinc" />
                {preview.skipCount > 0 && (
                  <StatCard label="Saltate" value={preview.skipCount} tone="amber" />
                )}
              </div>

              {preview.aiReview?.enabled && preview.aiReview.authError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
                  <p className="font-semibold">Lettura checkbox C/M non riuscita</p>
                  <p className="mt-1 text-red-900">
                    {preview.aiReview.warnings[0] ??
                      "Chiave API non valida. L'import usa solo il parser locale."}
                  </p>
                  <p className="mt-2 text-xs text-red-800">
                    Genera una nuova chiave su platform.openai.com/api-keys, mettila in{" "}
                    <code className="rounded bg-red-100 px-1">backend/.env</code> e riavvia il
                    backend.
                  </p>
                </div>
              )}

              {preview.aiReview?.enabled && preview.aiReview.ok && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
                  <p className="font-semibold">Checkbox C/M verificate con AI</p>
                  <p className="mt-1 text-violet-900">
                    {preview.aiReview.correctionCount > 0
                      ? `${preview.aiReview.correctionCount} checkbox C/M aggiornate su ${preview.aiReview.visionPages} pagine.`
                      : `Checkbox C/M verificate su ${preview.aiReview.visionPages} pagine, nessuna modifica.`}
                  </p>
                  {preview.aiReview.warnings.length > 0 && (
                    <p className="mt-2 text-xs text-amber-800">
                      {preview.aiReview.warnings.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>
              )}

              {preview.createCount + preview.updateCount + preview.reconcileCount === 0 && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  Nessuna modifica da applicare: tutte le commesse sono già allineate.
                </div>
              )}

              {preview.createCount + preview.updateCount + preview.reconcileCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  <span className="font-medium text-slate-700">
                    Seleziona cosa importare ({selectedApplyCount} di{" "}
                    {preview.createCount +
                      preview.updateCount +
                      preview.reconcileCount}
                    )
                  </span>
                  <div className="flex gap-3 text-xs font-medium">
                    <button
                      type="button"
                      onClick={selectAllApplyable}
                      className="text-sky-700 hover:text-sky-900"
                    >
                      Tutte
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllApplyable}
                      className="text-slate-500 hover:text-slate-800"
                    >
                      Nessuna
                    </button>
                  </div>
                </div>
              )}

              {reconciles.length > 0 && (
                <section className="overflow-hidden rounded-xl border border-violet-200/80 bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/80 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className="text-violet-700" />
                      <h3 className="text-sm font-semibold text-violet-900">
                        Ricalibrazione fuori PDF ({reconciles.length})
                      </h3>
                    </div>
                    <div className="flex gap-2 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReconcileIds(
                            new Set(reconciles.map((r) => r.orderId))
                          )
                        }
                        className="text-violet-700 hover:text-violet-900"
                      >
                        Tutte
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedReconcileIds(new Set())}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        Nessuna
                      </button>
                    </div>
                  </div>
                  <ul className="max-h-44 overflow-y-auto">
                    {reconciles.map((r) => (
                      <li
                        key={r.orderId}
                        className="flex items-start gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedReconcileIds.has(r.orderId)}
                          onChange={() => toggleReconcile(r.orderId)}
                          className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-700 focus:ring-violet-400"
                          aria-label={`Ricalibra ${r.code}`}
                        />
                        <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-md bg-violet-100 px-2 font-mono text-xs font-bold text-violet-800">
                          {r.code}
                        </span>
                        <p className="text-sm text-slate-700">
                          Stato ufficio →{" "}
                          <strong>
                            {r.to === "conclusa_insoluta"
                              ? "Terminate insolute"
                              : "Terminate e consegnate"}
                          </strong>
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-violet-100 bg-violet-50/40 px-3 py-2 text-xs text-violet-800">
                    Commesse non nel PDF: chiusura solo se cantiere e pagamenti sono
                    già a posto.
                  </p>
                </section>
              )}

              {creates.length > 0 && (
                <section className="overflow-hidden rounded-xl border border-emerald-200/80 bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Plus size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-semibold text-emerald-900">
                        Nuove commesse ({creates.length})
                      </h3>
                    </div>
                    <div className="flex gap-2 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          setCodesSelection(
                            creates.map((r) => r.code),
                            true
                          )
                        }
                        className="text-emerald-700 hover:text-emerald-900"
                      >
                        Tutte
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCodesSelection(
                            creates.map((r) => r.code),
                            false
                          )
                        }
                        className="text-slate-500 hover:text-slate-800"
                      >
                        Nessuna
                      </button>
                    </div>
                  </div>
                  <ul className="max-h-44 overflow-y-auto">
                    {creates.map((r) => (
                      <PreviewRowItem
                        key={r.code}
                        row={r}
                        variant="create"
                        checked={selectedCodes.has(r.code)}
                        onToggle={() => toggleCode(r.code)}
                      />
                    ))}
                  </ul>
                  <p className="border-t border-emerald-100 bg-emerald-50/40 px-3 py-2 text-xs text-emerald-800">
                    Dopo l&apos;import: completa telefono e anagrafica da «Nuove
                    commesse da completare».
                  </p>
                </section>
              )}

              {updates.length > 0 && (
                <section className="overflow-hidden rounded-xl border border-sky-200/80 bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-sky-100 bg-sky-50/80 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className="text-sky-700" />
                      <h3 className="text-sm font-semibold text-sky-900">
                        Aggiornamenti ({updates.length})
                      </h3>
                    </div>
                    <div className="flex gap-2 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          setCodesSelection(
                            updates.map((r) => r.code),
                            true
                          )
                        }
                        className="text-sky-700 hover:text-sky-900"
                      >
                        Tutte
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCodesSelection(
                            updates.map((r) => r.code),
                            false
                          )
                        }
                        className="text-slate-500 hover:text-slate-800"
                      >
                        Nessuna
                      </button>
                    </div>
                  </div>
                  <ul className="max-h-52 overflow-y-auto">
                    {updates.map((r) => (
                      <PreviewRowItem
                        key={r.code}
                        row={r}
                        variant="update"
                        checked={selectedCodes.has(r.code)}
                        onToggle={() => toggleCode(r.code)}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {preview.skipCount > 0 && (
                <p className="flex items-center gap-2 text-xs text-amber-800">
                  <SkipForward size={14} />
                  {preview.skipCount} montaggi nel PDF non presenti in programma —
                  gestiti dal cantiere, non creati da import.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={`border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6 ${modalSafeFooterClass}`}
        >
          <div className={modalActionsClass}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={applying}
              className="py-2.5"
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleApply()}
              disabled={!canApply}
              className="inline-flex items-center justify-center gap-2 py-2.5 font-semibold"
            >
              {applying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Import in corso…
                </>
              ) : (
                <>
                  <Check size={16} />
                  Applica import
                  {preview && selectedApplyCount > 0 && (
                    <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-bold">
                      {selectedApplyCount}
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
