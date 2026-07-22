import { useState } from "react";
import type { Job, JobPriority } from "@/types";
import { assistenzaAPI } from "@/api/assistenza";
import { JOB_PRIORITY_CONFIG } from "@/config/assistenzaConfig";
import { Button } from "@/components/ui/Button";
import {
  inputFieldClass,
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  modalSafeFooterClass,
  selectFieldClass,
} from "@/components/layout/PageChrome";
import toast from "react-hot-toast";

type Props = {
  job: Job;
  open: boolean;
  onClose: () => void;
  onSaved: (patch: Pick<Job, "priority" | "followUpCount" | "lastFollowUpAt">) => void;
};

export function RegisterFollowUpModal({ job, open, onClose, onSaved }: Props) {
  const [note, setNote] = useState("");
  const [markUrgent, setMarkUrgent] = useState(job.priority === "urgente");
  const [priority, setPriority] = useState<JobPriority>(job.priority ?? "normale");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const result = await assistenzaAPI.registerFollowUp(job.id, {
        note: note.trim() || undefined,
        markUrgent,
        ...(markUrgent ? {} : { priority }),
      });
      toast.success("Sollecito registrato");
      setNote("");
      onSaved({
        priority: result.job.priority,
        followUpCount: result.job.followUpCount,
        lastFollowUpAt: result.job.lastFollowUpAt,
      });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Errore durante la registrazione del sollecito");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={modalBackdropClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-up-title"
    >
      <div
        className={`${modalPanelClass} ${modalSafeFooterClass} w-full max-w-md space-y-4 p-5 sm:p-6`}
      >
        <h2 id="follow-up-title" className="text-lg font-bold text-slate-900">
          Registra sollecito
        </h2>
        <p className="text-sm text-slate-600">
          {job.customer?.name ?? "Cliente"} — commessa {job.orderCode ?? "—"}
        </p>

        <div className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
            <input
              type="checkbox"
              checked={markUrgent}
              onChange={(e) => setMarkUrgent(e.target.checked)}
              className="h-5 w-5 shrink-0 rounded border-slate-300 accent-brand"
            />
            <span className="font-medium text-red-800">Intervento urgente</span>
          </label>

          {!markUrgent && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Priorità
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JobPriority)}
                className={selectFieldClass}
              >
                {(Object.keys(JOB_PRIORITY_CONFIG) as JobPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {JOB_PRIORITY_CONFIG[p].label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Nota chiamata (opzionale)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Es. terza telefonata, cliente in attesa da una settimana"
              className={inputFieldClass + " min-h-[88px]"}
            />
          </div>
        </div>

        <div className={modalActionsClass}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Salvataggio…" : "Salva sollecito"}
          </Button>
        </div>
      </div>
    </div>
  );
}
