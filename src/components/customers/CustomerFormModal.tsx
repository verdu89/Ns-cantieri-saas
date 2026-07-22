import { Loader2, User, X } from "lucide-react";
import type { Customer } from "@/types";
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
  hint?: string;
  children: React.ReactNode;
};

function FormField({ label, hint, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export type CustomerFormModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  form: Partial<Customer>;
  saving?: boolean;
  onChange: (patch: Partial<Customer>) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function CustomerFormModal({
  open,
  title = "Anagrafica cliente",
  description = "Telefono, email e indirizzo per cantiere e solleciti.",
  form,
  saving = false,
  onChange,
  onClose,
  onSave,
}: CustomerFormModalProps) {
  if (!open) return null;

  return (
    <div className={modalBackdropClass} onClick={onClose}>
      <div
        className={`${modalPanelClass} flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="customer-form-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-slate-900 p-2.5 text-white shadow-sm">
              <User size={20} strokeWidth={1.75} />
            </span>
            <div>
              <h2
                id="customer-form-title"
                className="text-lg font-bold tracking-tight text-slate-900"
              >
                {title}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
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
          <FormField label="Nome / ragione sociale *">
            <input
              name="name"
              value={form.name ?? ""}
              onChange={(e) => onChange({ name: e.target.value })}
              className={inputFieldClass}
              autoFocus
            />
          </FormField>
          <FormField label="Telefono" hint="Utile per montatori e solleciti">
            <input
              name="phone"
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              className={inputFieldClass}
              placeholder="Es. 333 1234567"
            />
          </FormField>
          <FormField label="Email">
            <input
              name="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => onChange({ email: e.target.value })}
              className={inputFieldClass}
              placeholder="nome@email.it"
            />
          </FormField>
          <FormField label="Indirizzo">
            <textarea
              name="address"
              value={form.address ?? ""}
              onChange={(e) => onChange({ address: e.target.value })}
              className={inputFieldClass}
              rows={2}
              placeholder="Via, CAP, comune"
            />
          </FormField>
          <FormField label="Note anagrafica">
            <textarea
              name="notes"
              value={form.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              className={inputFieldClass}
              rows={2}
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
              disabled={saving || !form.name?.trim()}
              className="inline-flex items-center gap-2 font-semibold"
              onClick={onSave}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvataggio…
                </>
              ) : (
                "Salva anagrafica"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
