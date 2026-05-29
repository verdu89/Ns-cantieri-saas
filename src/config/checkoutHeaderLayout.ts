export const CHECKOUT_HEADER_LAYOUTS = ["band", "clean", "centered", "logo_only"] as const;

export type CheckoutHeaderLayout = (typeof CHECKOUT_HEADER_LAYOUTS)[number];

export const DEFAULT_CHECKOUT_HEADER_LAYOUT: CheckoutHeaderLayout = "band";
export const DEFAULT_CHECKOUT_BRAND_COLOR = "#ea580c";

export const CHECKOUT_HEADER_LAYOUT_OPTIONS: Array<{
  id: CheckoutHeaderLayout;
  label: string;
  description: string;
}> = [
  {
    id: "band",
    label: "Fascia colorata",
    description: "Logo a sinistra sulla fascia brand",
  },
  {
    id: "clean",
    label: "Pulito bianco",
    description: "Sfondo bianco, logo a colori",
  },
  {
    id: "centered",
    label: "Centrato",
    description: "Logo e testi centrati",
  },
  {
    id: "logo_only",
    label: "Solo logo",
    description: "Intestazione già nel file logo (banner orizzontale)",
  },
];

export function normalizeCheckoutHeaderLayout(
  value: string | null | undefined
): CheckoutHeaderLayout {
  if (
    value === "band" ||
    value === "clean" ||
    value === "centered" ||
    value === "logo_only"
  ) {
    return value;
  }
  return DEFAULT_CHECKOUT_HEADER_LAYOUT;
}

export function normalizeCheckoutBrandColor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  return DEFAULT_CHECKOUT_BRAND_COLOR;
}
