/** Macro-categorie economiche (allineate al backend). */
export type PaymentCategoryId =
  | "acconto"
  | "alla_consegna"
  | "fine_montaggio"
  | "altro";

export const PAYMENT_CATEGORY_ORDER: PaymentCategoryId[] = [
  "acconto",
  "alla_consegna",
  "fine_montaggio",
  "altro",
];

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategoryId, string> = {
  acconto: "Acconto",
  alla_consegna: "Alla consegna",
  fine_montaggio: "Fine montaggio",
  altro: "Altro",
};
