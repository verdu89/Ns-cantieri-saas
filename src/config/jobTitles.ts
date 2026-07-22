import type { JobTitle } from "../types";

/** Etichette operative per il personale (codice DB invariato). */
export const JOB_TITLE_LABELS: Record<JobTitle, string> = {
  consegna: "Consegna infissi / altro",
  montaggio: "Montaggio / installazione",
  consegna_montaggio: "Consegna e montaggio",
  assistenza: "Assistenza / post-vendita",
  altro: "Altro",
  consegna_controcasse: "Consegna controcasse",
  ritiro_vecchi_infissi: "Ritiro vecchi infissi",
};

/** Emoji allineate alle liste / form precedenti (🚚 consegna, 🔧 montaggio, …). */
const JOB_TITLE_ICONS: Record<JobTitle, string> = {
  consegna: "🚚",
  montaggio: "🔧",
  consegna_montaggio: "🚚🔧",
  assistenza: "🛠️",
  altro: "📝",
  consegna_controcasse: "📦",
  ritiro_vecchi_infissi: "📤",
};

const JOB_TITLE_ORDER: JobTitle[] = [
  "consegna",
  "consegna_controcasse",
  "consegna_montaggio",
  "montaggio",
  "ritiro_vecchi_infissi",
  "assistenza",
  "altro",
];

export function jobTitleLabel(title: string | null | undefined): string {
  if (!title) return "—";
  return JOB_TITLE_LABELS[title as JobTitle] ?? title;
}

/** Etichetta con icona (liste backoffice / mobile / select). */
export function jobTitleDisplay(title: string | null | undefined): string {
  if (!title) return "—";
  const icon = JOB_TITLE_ICONS[title as JobTitle];
  const label = JOB_TITLE_LABELS[title as JobTitle] ?? title;
  return icon ? `${icon} ${label}` : label;
}

export const JOB_TITLE_SELECT_OPTIONS: { value: JobTitle; label: string }[] =
  JOB_TITLE_ORDER.map((value) => ({
    value,
    label: jobTitleDisplay(value),
  }));

/**
 * Tipologie in cui il lavoro non è considerato concluso dal punto di vista commerciale
 * (es. controcasse prima di consegna/montaggio infissi): niente richiesta recensione al checkout.
 */
const JOB_TITLES_WITHOUT_REVIEW_REQUEST = new Set<JobTitle>([
  "consegna_controcasse",
]);

export function canOfferReviewRequestAtCheckout(
  title: string | null | undefined
): boolean {
  if (!title) return true;
  return !JOB_TITLES_WITHOUT_REVIEW_REQUEST.has(title as JobTitle);
}
