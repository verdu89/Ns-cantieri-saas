import { ClipboardList, Loader2, X } from "lucide-react";
import type { JobOrder } from "@/types";
import { Button } from "@/components/ui/Button";
import {
  inputFieldClass,
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  modalSafeFooterClass,
} from "@/components/layout/PageChrome";

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function FormField({ label, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export type JobOrderQuickEditForm = {
  code?: string;
  contactName?: string;
  destinationCity?: string;
  location?: { address?: string; mapsUrl?: string };
  notes?: string;
  notesBackoffice?: string;
};

export type JobOrderQuickEditModalProps = {
  open: boolean;
  form: JobOrderQuickEditForm;
  officeWorkflowEnabled?: boolean;
  saving?: boolean;
  onChange: (patch: JobOrderQuickEditForm) => void;
  onClose: () => void;
  onSave: () => void;
};

export function jobOrderToQuickEditForm(order: JobOrder): JobOrderQuickEditForm {
  return {
    code: order.code,
    contactName: order.contactName ?? "",
    destinationCity: order.destinationCity ?? "",
    location: {
      address: order.location?.address ?? "",
      mapsUrl: order.location?.mapsUrl ?? "",
    },
    notes: order.notes ?? "",
    notesBackoffice: order.notesBackoffice ?? "",
  };
}

export default function JobOrderQuickEditModal({
  open,
  form,
  officeWorkflowEnabled = false,
  saving = false,
  onChange,
  onClose,
  onSave,
}: JobOrderQuickEditModalProps) {
  if (!open) return null;

  const setLocation = (patch: { address?: string; mapsUrl?: string }) => {
    onChange({
      ...form,
      location: { ...(form.location ?? {}), ...patch },
    });
  };

  return (
    <div className={modalBackdropClass} onClick={onClose}>
      <div
        className={`${modalPanelClass} flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="order-edit-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-slate-900 p-2.5 text-white shadow-sm">
              <ClipboardList size={20} strokeWidth={1.75} />
            </span>
            <div>
              <h2
                id="order-edit-title"
                className="text-lg font-bold tracking-tight text-slate-900"
              >
                Modifica commessa
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Dati identificativi e indirizzo cantiere
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <FormField label="Numero commessa *">
            <input
              value={form.code ?? ""}
              onChange={(e) => onChange({ ...form, code: e.target.value })}
              className={inputFieldClass}
              placeholder="Es. 26-058"
            />
          </FormField>

          {officeWorkflowEnabled && (
            <>
              <FormField label="Nome (elenco ufficio)">
                <input
                  value={form.contactName ?? ""}
                  onChange={(e) =>
                    onChange({ ...form, contactName: e.target.value })
                  }
                  className={inputFieldClass}
                />
              </FormField>
              <FormField label="Destinazione / comune">
                <input
                  value={form.destinationCity ?? ""}
                  onChange={(e) =>
                    onChange({ ...form, destinationCity: e.target.value })
                  }
                  className={inputFieldClass}
                />
              </FormField>
            </>
          )}

          <FormField label="Indirizzo cantiere">
            <input
              value={form.location?.address ?? ""}
              onChange={(e) => setLocation({ address: e.target.value })}
              className={inputFieldClass}
            />
          </FormField>
          <FormField label="Link Google Maps">
            <input
              type="url"
              value={form.location?.mapsUrl ?? ""}
              onChange={(e) => setLocation({ mapsUrl: e.target.value })}
              className={inputFieldClass}
              placeholder="https://maps.google.com/…"
            />
          </FormField>

          {officeWorkflowEnabled ? (
            <FormField label="Note ufficio">
              <textarea
                value={form.notesBackoffice ?? ""}
                onChange={(e) =>
                  onChange({ ...form, notesBackoffice: e.target.value })
                }
                className={inputFieldClass}
                rows={3}
              />
            </FormField>
          ) : null}

          <FormField label="Note commessa (cantiere)">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              className={inputFieldClass}
              rows={3}
            />
          </FormField>
        </div>

        <div
          className={`border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6 ${modalSafeFooterClass}`}
        >
          <div className={modalActionsClass}>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving || !form.code?.trim()}
              className="inline-flex items-center gap-2 font-semibold"
              onClick={onSave}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvataggio…
                </>
              ) : (
                "Salva commessa"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
