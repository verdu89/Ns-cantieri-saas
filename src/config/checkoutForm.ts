/** Dati modulo fine lavori (allineato al foglio cartaceo Saverplast). */

import type { Job } from "@/types";
import { firstCheckoutEvent } from "@/lib/checkoutSession";
import { parseCheckoutFormFromReport } from "@/utils/checkoutFormReport";
import { parseDate, toLocalISODate } from "@/utils/date";

export type SerramentiControllo = "si_completo" | "no_parziale" | null;

export type CheckoutFormData = {
  dataInizioMontaggio: string;
  dataFineMontaggio: string;
  serramentiControllo: SerramentiControllo;
  vetriIntegri: boolean | null;
  siliconeAcrilico: boolean | null;
  noteMontatore: string;
  noteCliente: string;
  clienteSignerName: string;
};

export const DEFAULT_CHECKOUT_LEGAL_TEXT = `Il sottoscritto dichiara di avere controllato attentamente i lavori di posa in opera e di averli visti eseguiti a regola d'arte.
Il sottoscritto approva le prove di funzionamento senza riserva ed è consapevole che ogni ulteriore intervento tecnico non previsto da garanzia sarà a suo carico.
Il sottoscritto ha 8 giorni di tempo dalla data di fine lavori per segnalare eventuali difetti per iscritto.`;

/** Nota informativa su verniciatura post-sigillatura (tono neutro). */
export const SILICONE_ACRILICO_CUSTOMER_NOTICE =
  "Su finiture interne, per le parti sigillate con silicone acrilico — se presenti — si consiglia di verniciare nel breve periodo; l’intervento è a cura del committente.";

export const SILICONE_ACRILICO_FIELD_LABEL =
  "Sigillature in silicone acrilico su finiture interne eseguite?";

export function todayIsoDate(): string {
  return toLocalISODate(new Date());
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Data inizio montaggio per un nuovo checkout:
 * - se esistono checkout precedenti → quella del **primo** passaggio (modulo o data evento);
 * - altrimenti → oggi (primo checkout del cantiere).
 * Non usa `plannedDate`: con riassegnazioni successive cambierebbe.
 */
export function resolveMountingStartDate(job: Job): string {
  const first = firstCheckoutEvent(job);
  if (first) {
    const parsed = parseCheckoutFormFromReport(first.notes);
    const fromForm = parsed?.dataInizioMontaggio?.trim();
    if (fromForm && ISO_DATE_RE.test(fromForm)) {
      return fromForm;
    }
    const d = parseDate(first.date || first.createdAt || "");
    if (Number.isFinite(d.getTime())) {
      return toLocalISODate(d);
    }
  }
  return todayIsoDate();
}

export function buildCheckoutFormDefaults(job: Job): CheckoutFormData {
  const today = todayIsoDate();
  return {
    ...emptyCheckoutFormData(),
    dataInizioMontaggio: resolveMountingStartDate(job),
    dataFineMontaggio: today,
  };
}

export function emptyCheckoutFormData(): CheckoutFormData {
  const today = todayIsoDate();
  return {
    dataInizioMontaggio: today,
    dataFineMontaggio: today,
    serramentiControllo: null,
    vetriIntegri: null,
    siliconeAcrilico: null,
    noteMontatore: "",
    noteCliente: "",
    clienteSignerName: "",
  };
}

export function formatSerramentiControllo(value: SerramentiControllo): string {
  if (value === "si_completo") {
    return "Sì, nulla da rilevare — tutti i serramenti funzionali e privi di difetti";
  }
  if (value === "no_parziale") {
    return "No, controllo non completo di tutti i serramenti (vedi note)";
  }
  return "—";
}

export function formatSiNo(value: boolean | null): string {
  if (value === true) return "Sì";
  if (value === false) return "No";
  return "—";
}
