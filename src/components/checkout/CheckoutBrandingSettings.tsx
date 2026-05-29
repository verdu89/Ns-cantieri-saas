import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { inputFieldClass } from "@/components/layout/PageChrome";
import { CheckoutHeaderLayoutPicker } from "@/components/checkout/CheckoutHeaderLayoutPicker";
import {
  checkoutSettingsAPI,
  type CheckoutSettings,
} from "@/api/checkoutSettings";
import { resolveDocumentUrl } from "@/api/documentAPI";
import { fileToDataUrl } from "@/utils/file";
import {
  DEFAULT_CHECKOUT_BRAND_COLOR,
  DEFAULT_CHECKOUT_HEADER_LAYOUT,
  normalizeCheckoutBrandColor,
  normalizeCheckoutHeaderLayout,
  type CheckoutHeaderLayout,
} from "@/config/checkoutHeaderLayout";
import { DEFAULT_CHECKOUT_LEGAL_TEXT } from "@/config/checkoutForm";
import { parseHttpErrorMessage } from "@/utils/httpError";

type FormState = {
  companyName: string;
  subtitle: string;
  legalText: string;
  footerWebsite: string;
  headerLayout: CheckoutHeaderLayout;
  brandColor: string;
};

function toFormState(data: CheckoutSettings): FormState {
  return {
    companyName: data.companyName ?? "",
    subtitle: data.subtitle ?? "",
    legalText: data.legalText ?? "",
    footerWebsite: data.footerWebsite ?? "",
    headerLayout: normalizeCheckoutHeaderLayout(data.headerLayout),
    brandColor: normalizeCheckoutBrandColor(data.brandColor),
  };
}

function toPayload(form: FormState) {
  const brand = form.brandColor.trim();
  return {
    companyName: form.companyName.trim() || null,
    subtitle: form.subtitle.trim() || null,
    legalText: form.legalText.trim() || null,
    footerWebsite: form.footerWebsite.trim() || null,
    headerLayout: form.headerLayout,
    brandColor: /^#[0-9A-Fa-f]{6}$/.test(brand) ? brand : null,
  };
}

type Props = {
  onSaved?: () => void | Promise<void>;
};

export function CheckoutBrandingSettings({ onSaved }: Props) {
  const [form, setForm] = useState<FormState>({
    companyName: "",
    subtitle: "",
    legalText: DEFAULT_CHECKOUT_LEGAL_TEXT,
    footerWebsite: "",
    headerLayout: DEFAULT_CHECKOUT_HEADER_LAYOUT,
    brandColor: DEFAULT_CHECKOUT_BRAND_COLOR,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await checkoutSettingsAPI.get();
      setForm(toFormState(data));
      setLogoPreview(data.logoUrl ? resolveDocumentUrl(data.logoUrl) : null);
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore caricamento impostazioni checkout"));
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
      const updated = await checkoutSettingsAPI.update(toPayload(form));
      setForm(toFormState(updated));
      setLogoPreview(updated.logoUrl ? resolveDocumentUrl(updated.logoUrl) : null);
      toast.success("Impostazioni modulo fine lavori salvate");
      await onSaved?.();
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore salvataggio"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const updated = await checkoutSettingsAPI.uploadLogo(imageDataUrl);
      setForm(toFormState(updated));
      setLogoPreview(updated.logoUrl ? resolveDocumentUrl(updated.logoUrl) : null);
      toast.success("Logo caricato");
      await onSaved?.();
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore caricamento logo"));
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleRemoveLogo() {
    setLogoUploading(true);
    try {
      const updated = await checkoutSettingsAPI.deleteLogo();
      setForm(toFormState(updated));
      setLogoPreview(null);
      toast.success("Logo rimosso");
      await onSaved?.();
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore rimozione logo"));
    } finally {
      setLogoUploading(false);
    }
  }

  async function handlePreviewPdf() {
    setPdfPreviewLoading(true);
    try {
      const blob = await checkoutSettingsAPI.previewPdf(toPayload(form));
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore anteprima PDF"));
    } finally {
      setPdfPreviewLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Caricamento impostazioni checkout…</p>;
  }

  const busy = saving || logoUploading || pdfPreviewLoading;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Personalizza il modulo PDF e il checkout digitale per la tua azienda: logo, colori e
        testi legali.
      </p>

      <input
        className={inputFieldClass}
        placeholder="Ragione sociale"
        value={form.companyName}
        disabled={busy}
        onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
      />
      <input
        className={inputFieldClass}
        placeholder="Sottotitolo (es. Industria Serramenti in PVC)"
        value={form.subtitle}
        disabled={busy}
        onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
      />

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600">Logo / intestazione</p>
        {logoPreview ? (
          <img
            src={logoPreview}
            alt="Logo checkout"
            className="h-14 w-auto max-w-[240px] rounded border border-slate-200 bg-white object-contain p-1"
          />
        ) : (
          <p className="text-xs text-slate-500">Nessun logo caricato</p>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <span className="inline-flex rounded-lg border border-brand/40 bg-white px-3 py-1.5 text-xs font-medium text-brand-dark hover:bg-orange-50">
              {logoUploading ? "Caricamento…" : "Carica immagine"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleUploadLogo(file);
              }}
            />
          </label>
          {logoPreview && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRemoveLogo()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Rimuovi logo
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          PNG o JPG (max 2 MB). Per «Solo logo» usa un banner orizzontale già pronto.
        </p>
      </div>

      <CheckoutHeaderLayoutPicker
        layout={form.headerLayout}
        brandColor={form.brandColor}
        companyName={form.companyName}
        subtitle={form.subtitle}
        logoPreviewUrl={logoPreview}
        disabled={busy}
        onLayoutChange={(headerLayout) => setForm((p) => ({ ...p, headerLayout }))}
        onBrandColorChange={(brandColor) => setForm((p) => ({ ...p, brandColor }))}
      />

      <input
        className={inputFieldClass}
        placeholder="Sito web (footer PDF)"
        value={form.footerWebsite}
        disabled={busy}
        onChange={(e) => setForm((p) => ({ ...p, footerWebsite: e.target.value }))}
      />
      <textarea
        className={inputFieldClass + " min-h-[100px]"}
        placeholder="Testo legale (dichiarazione cliente)"
        value={form.legalText}
        disabled={busy}
        onChange={(e) => setForm((p) => ({ ...p, legalText: e.target.value }))}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="primary" disabled={busy} onClick={() => void handleSave()}>
          {saving ? "Salvataggio…" : "Salva impostazioni"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void handlePreviewPdf()}
        >
          {pdfPreviewLoading ? "Generazione PDF…" : "Anteprima PDF esempio"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        L&apos;anteprima usa dati di esempio con layout e testi attuali (anche non ancora salvati).
      </p>
    </div>
  );
}
