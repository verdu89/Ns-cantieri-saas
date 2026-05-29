import {
  CHECKOUT_HEADER_LAYOUT_OPTIONS,
  DEFAULT_CHECKOUT_BRAND_COLOR,
  normalizeCheckoutBrandColor,
  type CheckoutHeaderLayout,
} from "@/config/checkoutHeaderLayout";
import { CheckoutPreviewHeader } from "@/components/checkout/CheckoutPreviewHeader";

type Props = {
  layout: CheckoutHeaderLayout;
  brandColor: string;
  companyName: string;
  subtitle: string;
  logoPreviewUrl: string | null;
  onLayoutChange: (layout: CheckoutHeaderLayout) => void;
  onBrandColorChange: (color: string) => void;
  disabled?: boolean;
};

export function CheckoutHeaderLayoutPicker({
  layout,
  brandColor,
  companyName,
  subtitle,
  logoPreviewUrl,
  onLayoutChange,
  onBrandColorChange,
  disabled,
}: Props) {
  const brand = normalizeCheckoutBrandColor(brandColor);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-slate-600">Colore brand (PDF)</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={brand}
            disabled={disabled}
            onChange={(e) => onBrandColorChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:opacity-50"
          />
          <input
            type="text"
            value={brandColor.trim() || brand}
            disabled={disabled}
            onChange={(e) => onBrandColorChange(e.target.value)}
            placeholder={DEFAULT_CHECKOUT_BRAND_COLOR}
            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBrandColorChange(DEFAULT_CHECKOUT_BRAND_COLOR)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Default
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-600">Layout intestazione PDF</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {CHECKOUT_HEADER_LAYOUT_OPTIONS.map((opt) => {
            const selected = layout === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onLayoutChange(opt.id)}
                className={`overflow-hidden rounded-xl border text-left transition ${
                  selected
                    ? "border-violet-500 ring-2 ring-violet-200"
                    : "border-slate-200 hover:border-slate-300"
                } disabled:opacity-50`}
              >
                <div className="pointer-events-none scale-[0.85] origin-top">
                  <CheckoutPreviewHeader
                    companyName={companyName || "Azienda"}
                    subtitle={subtitle || "Modulo fine lavori"}
                    logoSrc={logoPreviewUrl}
                    headerLayout={opt.id}
                    brandColor={brand}
                  />
                </div>
                <div className="border-t border-slate-100 bg-white px-2 py-1.5">
                  <p className="text-xs font-semibold text-slate-800">{opt.label}</p>
                  <p className="text-[10px] text-slate-500">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
