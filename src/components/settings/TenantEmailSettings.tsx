import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { inputFieldClass } from "@/components/layout/PageChrome";
import {
  emailSettingsAPI,
  type EmailSettings,
  type EmailSettingsUpdate,
} from "@/api/emailSettings";
import { parseHttpErrorMessage } from "@/utils/httpError";

type FormState = {
  emailFromName: string;
  emailReplyTo: string;
  reviewLinkUrl: string;
  reviewEmailSubject: string;
  reviewEmailBody: string;
  checkoutEmailSubject: string;
  checkoutEmailBody: string;
};

function toFormState(data: EmailSettings): FormState {
  return {
    emailFromName: data.emailFromName ?? "",
    emailReplyTo: data.emailReplyTo ?? "",
    reviewLinkUrl: data.reviewLinkUrl ?? "",
    reviewEmailSubject: data.reviewEmailSubject ?? "",
    reviewEmailBody: data.reviewEmailBody ?? "",
    checkoutEmailSubject: data.checkoutEmailSubject ?? "",
    checkoutEmailBody: data.checkoutEmailBody ?? "",
  };
}

function toPayload(form: FormState): EmailSettingsUpdate {
  return {
    emailFromName: form.emailFromName.trim() || null,
    emailReplyTo: form.emailReplyTo.trim() || null,
    reviewLinkUrl: form.reviewLinkUrl.trim() || null,
    reviewEmailSubject: form.reviewEmailSubject.trim() || null,
    reviewEmailBody: form.reviewEmailBody.trim() || null,
    checkoutEmailSubject: form.checkoutEmailSubject.trim() || null,
    checkoutEmailBody: form.checkoutEmailBody.trim() || null,
  };
}

export function TenantEmailSettings() {
  const [meta, setMeta] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState<FormState>({
    emailFromName: "",
    emailReplyTo: "",
    reviewLinkUrl: "",
    reviewEmailSubject: "",
    reviewEmailBody: "",
    checkoutEmailSubject: "",
    checkoutEmailBody: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailSettingsAPI.get();
      setMeta(data);
      setForm(toFormState(data));
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore caricamento impostazioni email"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await emailSettingsAPI.update(toPayload(form));
      setMeta(updated);
      setForm(toFormState(updated));
      toast.success("Impostazioni email salvate");
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore salvataggio"));
    } finally {
      setSaving(false);
    }
  }

  function fillReviewDefaults() {
    if (!meta) return;
    setForm((f) => ({
      ...f,
      reviewEmailSubject: meta.defaults.reviewEmailSubject,
      reviewEmailBody: meta.defaults.reviewEmailBody,
    }));
  }

  function fillCheckoutDefaults() {
    if (!meta) return;
    setForm((f) => ({
      ...f,
      checkoutEmailSubject: meta.defaults.checkoutEmailSubject,
      checkoutEmailBody: meta.defaults.checkoutEmailBody,
    }));
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Caricamento impostazioni email…</p>;
  }

  if (!meta) {
    return <p className="text-sm text-red-600">Impossibile caricare le impostazioni email.</p>;
  }

  const showForm = meta.canEditReviewEmail || meta.canEditCheckoutEmail;

  if (!showForm) {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>
          Per questo account non è attivo l&apos;invio email dall&apos;app (recensioni via foglio
          Google e/o checkout senza email al cliente).
        </p>
        <p className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs">
          {meta.platformEmail.hint}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
          meta.platformEmail.sendingReady
            ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
            : "border-amber-200 bg-amber-50/60 text-amber-950"
        }`}
      >
        <p className="font-semibold">
          {meta.platformEmail.sendingReady
            ? "Invio email piattaforma attivo"
            : "Invio email non ancora attivo sul server"}
        </p>
        <p className="mt-1">{meta.platformEmail.hint}</p>
        {!meta.platformEmail.sendingReady && (
          <p className="mt-2">
            Puoi già salvare testi e indirizzi: le email partiranno automaticamente quando il
            referente piattaforma configurerà dominio e variabili nel backend.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Nome mittente (visualizzato)
          </label>
          <input
            className={inputFieldClass}
            value={form.emailFromName}
            onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))}
            placeholder={meta.displayName}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Email per le risposte (Reply-To) *
          </label>
          <input
            type="email"
            className={inputFieldClass}
            value={form.emailReplyTo}
            onChange={(e) => setForm((f) => ({ ...f, emailReplyTo: e.target.value }))}
            placeholder="info@azienda.it"
          />
        </div>
      </div>

      {meta.canEditReviewEmail && (
        <section className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Email richiesta recensione</h4>
            <Button type="button" variant="neutral" className="text-xs" onClick={fillReviewDefaults}>
              Testo predefinito
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Segnaposto: {"{{customerName}}"}, {"{{companyName}}"}, {"{{reviewLink}}"}
          </p>
          <input
            className={inputFieldClass}
            value={form.reviewLinkUrl}
            onChange={(e) => setForm((f) => ({ ...f, reviewLinkUrl: e.target.value }))}
            placeholder="https://g.page/… (link recensione Google)"
          />
          <input
            className={inputFieldClass}
            value={form.reviewEmailSubject}
            onChange={(e) => setForm((f) => ({ ...f, reviewEmailSubject: e.target.value }))}
            placeholder={meta.defaults.reviewEmailSubject}
          />
          <textarea
            className={inputFieldClass + " min-h-[120px]"}
            value={form.reviewEmailBody}
            onChange={(e) => setForm((f) => ({ ...f, reviewEmailBody: e.target.value }))}
            placeholder={meta.defaults.reviewEmailBody}
          />
        </section>
      )}

      {meta.canEditCheckoutEmail && (
        <section className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Email modulo fine lavori</h4>
            <Button type="button" variant="neutral" className="text-xs" onClick={fillCheckoutDefaults}>
              Testo predefinito
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Segnaposto: {"{{customerName}}"}, {"{{companyName}}"}, {"{{destination}}"} — il PDF viene
            allegato automaticamente quando l&apos;invio è attivo.
          </p>
          <input
            className={inputFieldClass}
            value={form.checkoutEmailSubject}
            onChange={(e) => setForm((f) => ({ ...f, checkoutEmailSubject: e.target.value }))}
            placeholder={meta.defaults.checkoutEmailSubject}
          />
          <textarea
            className={inputFieldClass + " min-h-[120px]"}
            value={form.checkoutEmailBody}
            onChange={(e) => setForm((f) => ({ ...f, checkoutEmailBody: e.target.value }))}
            placeholder={meta.defaults.checkoutEmailBody}
          />
        </section>
      )}

      <Button
        type="button"
        variant="primary"
        disabled={saving}
        className="w-full sm:w-auto"
        onClick={() => void handleSave()}
      >
        {saving ? "Salvataggio…" : "Salva impostazioni email"}
      </Button>
    </div>
  );
}
