import type { CheckoutFormData } from "@/config/checkoutForm";
import {
  formatSiNo,
  formatSerramentiControllo,
  SILICONE_ACRILICO_CUSTOMER_NOTICE,
} from "@/config/checkoutForm";

const MARKER_START = "--- MODULO FINE LAVORI ---";
const MARKER_END = "--- FINE MODULO FINE LAVORI ---";

export function appendCheckoutFormToReport(
  reportNotes: string,
  form: CheckoutFormData
): string {
  const block = [
    MARKER_START,
    `Data inizio montaggio: ${form.dataInizioMontaggio || "—"}`,
    `Data fine montaggio: ${form.dataFineMontaggio || "—"}`,
    `Controllo serramenti: ${formatSerramentiControllo(form.serramentiControllo)}`,
    `Vetri integri: ${formatSiNo(form.vetriIntegri)}`,
    `Sigillature silicone acrilico (finiture interne): ${formatSiNo(form.siliconeAcrilico)}`,
    `Nota verniciatura silicone: ${SILICONE_ACRILICO_CUSTOMER_NOTICE}`,
    `Note montatore: ${form.noteMontatore.trim() || "—"}`,
    `Note cliente: ${form.noteCliente.trim() || "—"}`,
    `Firma cliente (nome): ${form.clienteSignerName.trim() || "—"}`,
    MARKER_END,
  ].join("\n");

  return `${reportNotes.trimEnd()}\n\n${block}`;
}

export function parseCheckoutFormFromReport(
  notes?: string | null
): CheckoutFormData | null {
  if (!notes || !notes.includes(MARKER_START)) return null;
  const block = notes.split(MARKER_START)[1]?.split(MARKER_END)[0] ?? "";
  const line = (key: string) =>
    block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";

  const serramentiRaw = line("Controllo serramenti");
  let serramentiControllo: CheckoutFormData["serramentiControllo"] = null;
  if (serramentiRaw.startsWith("Sì, nulla")) serramentiControllo = "si_completo";
  else if (serramentiRaw.startsWith("No,")) serramentiControllo = "no_parziale";

  const parseBool = (raw: string): boolean | null => {
    if (raw === "Sì") return true;
    if (raw === "No") return false;
    return null;
  };

  return {
    dataInizioMontaggio: line("Data inizio montaggio"),
    dataFineMontaggio: line("Data fine montaggio"),
    serramentiControllo,
    vetriIntegri: parseBool(line("Vetri integri")),
    siliconeAcrilico:
      parseBool(line("Sigillature silicone acrilico (finiture interne)")) ??
      parseBool(line("Silicone acrilico finiture interne")),
    noteMontatore: line("Note montatore"),
    noteCliente: line("Note cliente"),
    clienteSignerName: line("Firma cliente (nome)"),
  };
}
