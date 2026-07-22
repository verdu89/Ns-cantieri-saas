import {
  normalizeCheckoutBrandColor,
  normalizeCheckoutHeaderLayout,
  type CheckoutHeaderLayout,
} from "@/config/checkoutHeaderLayout";

type Props = {
  companyName: string;
  subtitle: string;
  logoSrc: string | null;
  headerLayout: CheckoutHeaderLayout | string | null | undefined;
  brandColor: string | null | undefined;
};

export function CheckoutPreviewHeader({
  companyName,
  subtitle,
  logoSrc,
  headerLayout: layoutRaw,
  brandColor,
}: Props) {
  const layout = normalizeCheckoutHeaderLayout(layoutRaw);
  const brand = normalizeCheckoutBrandColor(brandColor);
  const company = companyName.trim() || "Azienda";
  const sub = subtitle.trim() || "Modulo fine lavori";

  const logo = logoSrc ? (
    <img src={logoSrc} alt="" className="max-h-10 max-w-[120px] object-contain" />
  ) : (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
      style={{ backgroundColor: brand }}
    >
      {company.charAt(0) || "A"}
    </div>
  );

  if (layout === "logo_only") {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            className="mx-auto max-h-16 w-full max-w-full object-contain object-center"
          />
        ) : (
          <p className="py-4 text-center text-sm font-bold text-slate-700">{company}</p>
        )}
        <div className="mt-3 h-0.5 w-full rounded" style={{ backgroundColor: brand }} />
      </div>
    );
  }

  if (layout === "centered") {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-4 text-center">
        <div className="flex justify-center">{logo}</div>
        <div className="mt-2 text-base font-bold text-slate-900">{company}</div>
        <div className="text-[11px] text-slate-600">{sub}</div>
        <div className="mx-auto mt-3 h-0.5 w-full max-w-xs rounded" style={{ backgroundColor: brand }} />
      </div>
    );
  }

  if (layout === "clean") {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {logo}
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-slate-900">{company}</div>
            <div className="text-[11px] text-slate-600">{sub}</div>
          </div>
        </div>
        <div className="mt-3 h-0.5 w-full rounded" style={{ backgroundColor: brand }} />
      </div>
    );
  }

  return (
    <div className="px-4 py-3 text-white" style={{ backgroundColor: brand }}>
      <div className="flex items-center gap-3">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            className="h-10 w-10 rounded-md bg-white object-contain p-0.5"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/20 text-sm font-bold">
            {company.charAt(0) || "A"}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{company}</div>
          <div className="text-[11px] opacity-90">{sub}</div>
        </div>
      </div>
    </div>
  );
}
