import type { CheckoutFormData } from "@/config/checkoutForm";
import {
  DEFAULT_CHECKOUT_LEGAL_TEXT,
  formatSiNo,
  formatSerramentiControllo,
  SILICONE_ACRILICO_CUSTOMER_NOTICE,
  SILICONE_ACRILICO_FIELD_LABEL,
} from "@/config/checkoutForm";
import { normalizeCheckoutBrandColor } from "@/config/checkoutHeaderLayout";
import { resolveDocumentUrl } from "@/api/documentAPI";
import { formatDate } from "@/utils/date";
import { CheckoutPreviewHeader } from "@/components/checkout/CheckoutPreviewHeader";

export type CheckoutPreviewContext = {
  orderCode?: string | null;
  orderDate?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  destination?: string | null;
  performingTechnicianName: string;
  crewOnSiteNames: string[];
};

export type Branding = {
  companyName: string;
  subtitle: string;
  legalText: string;
  footerWebsite: string;
  logoUrl?: string | null;
  headerLayout?: string | null;
  brandColor?: string | null;
};

type Props = {
  form: CheckoutFormData;
  context: CheckoutPreviewContext;
  branding: Branding;
  signatureDataUrl?: string | null;
};

export function CheckoutFormPreview({
  form,
  context,
  branding,
  signatureDataUrl,
}: Props) {
  const logoSrc = branding.logoUrl ? resolveDocumentUrl(branding.logoUrl) : null;
  const legalText = branding.legalText || DEFAULT_CHECKOUT_LEGAL_TEXT;
  const brandColor = normalizeCheckoutBrandColor(branding.brandColor);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-900 shadow-inner">
      <CheckoutPreviewHeader
        companyName={branding.companyName}
        subtitle={branding.subtitle}
        logoSrc={logoSrc}
        headerLayout={branding.headerLayout}
        brandColor={brandColor}
      />

      <div className="space-y-3 bg-white p-4">

        <div className="grid grid-cols-1 gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Ordine
            </div>
            <div className="font-medium">{context.orderCode ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Data ordine
            </div>
            <div>{context.orderDate ? formatDate(context.orderDate) : "—"}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Cliente
            </div>
            <div>{context.customerName ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Telefono
            </div>
            <div>{context.customerPhone ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Destinazione
            </div>
            <div className="line-clamp-2">{context.destination ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Inizio montaggio
            </div>
            <div>
              {form.dataInizioMontaggio ? formatDate(form.dataInizioMontaggio) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Fine montaggio
            </div>
            <div>{form.dataFineMontaggio ? formatDate(form.dataFineMontaggio) : "—"}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Squadra in cantiere
            </div>
            <div>
              {context.crewOnSiteNames.length > 0
                ? context.crewOnSiteNames.join(", ")
                : "—"}
            </div>
          </div>
        </div>

        <div
          className="space-y-2 rounded-lg border p-3"
          style={{
            borderColor: `${brandColor}33`,
            backgroundColor: `${brandColor}0d`,
          }}
        >
          <div
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: brandColor }}
          >
            Controllo lavori
          </div>
          <p>
            <span className="font-semibold text-slate-600">Controllo serramenti:</span>{" "}
            {formatSerramentiControllo(form.serramentiControllo)}
          </p>
          <p>
            <span className="font-semibold text-slate-600">Vetri integri:</span>{" "}
            {formatSiNo(form.vetriIntegri)}
          </p>
          <p>
            <span className="font-semibold text-slate-600">
              {SILICONE_ACRILICO_FIELD_LABEL.replace("?", "")}:
            </span>{" "}
            {formatSiNo(form.siliconeAcrilico)}
          </p>
          <p className="text-[10px] leading-snug text-slate-600">
            {SILICONE_ACRILICO_CUSTOMER_NOTICE}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-2 min-h-[48px]">
            <div
              className="mb-1 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: brandColor }}
            >
              Note montatore
            </div>
            <p className="whitespace-pre-wrap text-slate-800">{form.noteMontatore || "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-2 min-h-[40px]">
            <div
              className="mb-1 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: brandColor }}
            >
              Note cliente
            </div>
            <p className="whitespace-pre-wrap text-slate-800">{form.noteCliente || "—"}</p>
          </div>
        </div>

        <div>
          <div
            className="mb-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: brandColor }}
          >
            Approvazione lavori
          </div>
          <div
            className="rounded-lg border border-slate-200 border-l-[3px] bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-700"
            style={{ borderLeftColor: brandColor }}
          >
            {legalText}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex min-h-[100px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-3 text-center">
            <p className="text-sm font-bold text-slate-900">{branding.companyName}</p>
            <p className="mt-2 text-[10px] font-semibold text-slate-600">Il tecnico</p>
            <p className="mt-0.5 text-[10px] text-slate-800">
              {context.performingTechnicianName || "—"}
            </p>
          </div>
          <div className="flex min-h-[100px] flex-col rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex flex-1 items-center justify-center">
              {signatureDataUrl ? (
                <img
                  src={signatureDataUrl}
                  alt="Firma cliente"
                  className="max-h-14 w-full object-contain"
                />
              ) : null}
            </div>
            <div
              className="border-t-2 pt-1.5 text-center text-[10px] font-semibold text-slate-600"
              style={{ borderColor: `${brandColor}80` }}
            >
              Il cliente
            </div>
            <p className="mt-0.5 text-center text-[10px] text-slate-800">
              {form.clienteSignerName || "—"}
            </p>
          </div>
        </div>

        {branding.footerWebsite && (
          <p
            className="border-t border-slate-200 pt-2 text-center text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: brandColor }}
          >
            {branding.footerWebsite}
          </p>
        )}
      </div>
    </div>
  );
}
