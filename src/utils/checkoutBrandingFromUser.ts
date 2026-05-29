import type { User } from "@/types";
import { DEFAULT_CHECKOUT_LEGAL_TEXT } from "@/config/checkoutForm";
import {
  normalizeCheckoutBrandColor,
  normalizeCheckoutHeaderLayout,
} from "@/config/checkoutHeaderLayout";
import type { Branding } from "@/components/checkout/CheckoutFormPreview";

export function brandingFromUser(user: User | null): Branding {
  const b = user?.checkoutBranding;
  return {
    companyName: b?.companyName?.trim() || "Azienda",
    subtitle: b?.subtitle?.trim() || "Fine lavori",
    legalText: b?.legalText?.trim() || DEFAULT_CHECKOUT_LEGAL_TEXT,
    footerWebsite: b?.footerWebsite?.trim() || "",
    logoUrl: b?.logoUrl,
    headerLayout: normalizeCheckoutHeaderLayout(b?.headerLayout),
    brandColor: normalizeCheckoutBrandColor(b?.brandColor),
  };
}
