import type { Payment } from "@/types";

export const CHECKOUT_PERFORMER_LINE_PREFIX = "Checkout effettuato da:";
export const CHECKOUT_TECHNICIANS_LINE_PREFIX = "Tecnici in cantiere:";

export type ParsedCheckoutReport = {
  performer: string | null;
  datetime: string | null;
  outcome: string | null;
  team: string | null;
  review: string | null;
  payments: string[];
  jobNotes: string | null;
  finalNotes: string | null;
  /** Testo non strutturato (report vecchi). */
  legacyBody: string | null;
};

const OUTCOME_IT: Record<string, string> = {
  completato: "Completato",
  da_completare: "Da completare",
};

export function formatCheckoutPerformer(name?: string | null, email?: string | null): string {
  const n = name?.trim();
  if (n) return n;
  const e = email?.trim();
  return e || "Utente non identificato";
}

export function formatCheckoutOutcome(stato: string): string {
  const key = stato.trim().toLowerCase().replace(/\s+/g, "_");
  return OUTCOME_IT[key] ?? stato.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEuro(amount: number): string {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function paymentLabel(p: Payment): string {
  const label = p.label?.trim();
  if (label && label !== "Nuovo pagamento") return label;
  return "Pagamento";
}

export function formatPaymentLine(p: Payment): string {
  const label = paymentLabel(p);
  if (p.collected) {
    return `${label} — incassato ${formatEuro(p.amount)}`;
  }
  if (p.partial && p.collectedAmount > 0 && !p.collected) {
    const residuo = p.amount - p.collectedAmount;
    return `${label} — incassato ${formatEuro(p.collectedAmount)} su ${formatEuro(p.amount)} (residuo ${formatEuro(residuo)})`;
  }
  return `${label} — da incassare ${formatEuro(p.amount)}`;
}

function parseTechniciansLine(text: string): string | null {
  const raw =
    text.match(/^\s*Tecnici in cantiere:\s*(.+)$/m)?.[1]?.trim() ??
    text.match(/^\s*Tecnici:\s*(.+)$/m)?.[1]?.trim() ??
    text.match(/^\s*Squadra:\s*(.+)$/m)?.[1]?.trim() ??
    null;
  if (!raw || raw === "—" || raw === "-") return null;
  return raw;
}

function hasText(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = value.trim();
  return t.length > 0 && t !== "-";
}

export type BuildCheckoutReportInput = {
  performedByName: string;
  performedByEmail: string;
  datetimeLabel: string;
  stato: string;
  technicianNames: string[];
  payments: Payment[];
  jobNotes?: string | null;
  finalConclusion?: string | null;
  requestReviewFeatureEnabled: boolean;
  requestReview: "si" | "no";
};

/** Testo salvato nell'evento checkout (leggibile in stampa e in app). */
export function buildCheckoutReportNotes(input: BuildCheckoutReportInput): string {
  const performer = formatCheckoutPerformer(input.performedByName, input.performedByEmail);
  const lines: string[] = [
    CHECKOUT_PERFORMER_LINE_PREFIX + " " + performer,
    "",
    `Data e ora: ${input.datetimeLabel}`,
    `Esito: ${formatCheckoutOutcome(input.stato)}`,
    `${CHECKOUT_TECHNICIANS_LINE_PREFIX} ${input.technicianNames.length > 0 ? input.technicianNames.join(", ") : "—"}`,
  ];

  if (input.requestReviewFeatureEnabled) {
    lines.push(`Recensione al cliente: ${input.requestReview === "si" ? "Sì" : "No"}`);
  }

  lines.push("", "Pagamenti");
  if (input.payments.length === 0) {
    lines.push("  Nessun pagamento registrato");
  } else {
    for (const p of input.payments) {
      lines.push(`  • ${formatPaymentLine(p)}`);
    }
  }

  if (hasText(input.jobNotes)) {
    lines.push("", "Note sull'intervento", input.jobNotes!.trim());
  }

  if (hasText(input.finalConclusion)) {
    lines.push("", "Note di chiusura", input.finalConclusion!.trim());
  }

  return lines.join("\n").trimEnd();
}

/** Aggiunge la nota di chiusura checkout senza cancellare il diario cantiere esistente. */
export function mergeJobNotesAtCheckout(
  existingNotes: string | null | undefined,
  closureNote: string,
  closedAtLabel: string
): string {
  const addition = closureNote.trim();
  if (!addition) return existingNotes?.trim() ?? "";
  const base = existingNotes?.trim() ?? "";
  if (!base) return addition;
  return `${base}\n\n--- Chiusura checkout ${closedAtLabel} ---\n${addition}`;
}

export function parseCheckoutPerformerFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/^Checkout effettuato da:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

/** @deprecated Usare parseCheckoutReport */
export function stripCheckoutPerformerLine(notes?: string | null): string {
  const parsed = parseCheckoutReport(notes);
  if (parsed.legacyBody) return parsed.legacyBody;
  return notes?.replace(/^Checkout effettuato da:\s*.+\n?/m, "").trimStart() ?? "";
}

function parseLegacyReport(notes: string): ParsedCheckoutReport {
  const performer = parseCheckoutPerformerFromNotes(notes);
  let body = notes;
  if (performer) {
    body = body.replace(/^Checkout effettuato da:\s*.+\n?/m, "");
  }
  body = body.replace(/^--- CHECKOUT REPORT ---\n?/m, "").trim();

  const datetime = body.match(/^Data:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const outcomeRaw = body.match(/^Esito:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const outcome = outcomeRaw ? formatCheckoutOutcome(outcomeRaw) : null;
  const team = parseTechniciansLine(body);
  const review =
    body.match(/^Recensione richiesta:\s*(.+)$/m)?.[1]?.trim() ??
    body.match(/^Recensione al cliente:\s*(.+)$/m)?.[1]?.trim() ??
    null;

  const paymentsBlock = body.match(/💰 Pagamenti:\n([\s\S]*?)(?=\n\nNote|\n-{3,}|$)/)?.[1];
  const paymentsFromBlock = body.match(/^Pagamenti\n([\s\S]*?)(?=\n\nNote|$)/)?.[1];
  const paymentsRaw = paymentsBlock ?? paymentsFromBlock ?? "";
  const payments = paymentsRaw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== "Nessun pagamento registrato")
    .map((l) => l.replace(/^[✅🟨⬜]\s*/u, ""));

  const jobNotes =
    body.match(/Note intervento:\n([\s\S]*?)(?=\n\nNote finali|$)/)?.[1]?.trim() ??
    body.match(/Note sull'intervento\n([\s\S]*?)(?=\n\nNote di chiusura|$)/)?.[1]?.trim() ??
    null;
  const finalNotes =
    body.match(/Note finali:\n([\s\S]*?)(?=\n-{3,}|$)/)?.[1]?.trim() ??
    body.match(/Note di chiusura\n([\s\S]*?)$/m)?.[1]?.trim() ??
    null;

  return {
    performer,
    datetime,
    outcome,
    team: team && team !== "-" ? team : null,
    review,
    payments,
    jobNotes: hasText(jobNotes) ? jobNotes : null,
    finalNotes: hasText(finalNotes) ? finalNotes : null,
    legacyBody: body.includes("---") || body.includes("💰") ? body : null,
  };
}

function parseStructuredReport(notes: string): ParsedCheckoutReport | null {
  if (!notes.includes("Data e ora:") && !notes.includes("Data:")) {
    return null;
  }
  const performer = parseCheckoutPerformerFromNotes(notes);
  const datetime =
    notes.match(/^Data e ora:\s*(.+)$/m)?.[1]?.trim() ??
    notes.match(/^Data:\s*(.+)$/m)?.[1]?.trim() ??
    null;
  const outcome = notes.match(/^Esito:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const team = parseTechniciansLine(notes);
  const review =
    notes.match(/^Recensione al cliente:\s*(.+)$/m)?.[1]?.trim() ??
    notes.match(/^Recensione richiesta:\s*(.+)$/m)?.[1]?.trim() ??
    null;

  const paymentsSection = notes.match(/^Pagamenti\n([\s\S]*?)(?=\n\nNote|$)/m)?.[1] ?? "";
  const payments = paymentsSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("•"))
    .map((l) => l.replace(/^•\s*/, ""));

  const jobNotes = notes.match(/Note sull'intervento\n([\s\S]*?)(?=\n\nNote di chiusura|$)/)?.[1]?.trim() ?? null;
  const finalNotes = notes.match(/Note di chiusura\n([\s\S]*?)$/m)?.[1]?.trim() ?? null;

  return {
    performer,
    datetime,
    outcome,
    team: team && team !== "—" ? team : null,
    review,
    payments,
    jobNotes: hasText(jobNotes) ? jobNotes : null,
    finalNotes: hasText(finalNotes) ? finalNotes : null,
    legacyBody: null,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type CheckoutPrintDocumentMeta = {
  customerName: string;
  orderCode: string;
  performedBy?: string | null;
};

/** Documento HTML completo per stampa report checkout. */
export function buildCheckoutReportPrintDocument(
  report: ParsedCheckoutReport,
  meta: CheckoutPrintDocumentMeta
): string {
  const performedByBlock = meta.performedBy
    ? `<p><strong>Checkout effettuato da:</strong> ${escapeHtml(meta.performedBy)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>Stampa checkout</title>
  <style>
    body { font-family: sans-serif; padding: 20px; font-size: 14px; color: #0f172a; }
    h2, h3 { margin: 0.75em 0 0.35em; }
    table.meta { border-collapse: collapse; margin: 1em 0; width: 100%; max-width: 32rem; }
    table.meta th { text-align: left; padding: 4px 12px 4px 0; color: #475569; font-weight: 600; vertical-align: top; }
    table.meta td { padding: 4px 0; }
    ul { margin: 0.25em 0; padding-left: 1.25em; }
    pre { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <h2>Report checkout</h2>
  <p><strong>Cliente:</strong> ${escapeHtml(meta.customerName || "—")}</p>
  <p><strong>Commessa:</strong> ${escapeHtml(meta.orderCode || "—")}</p>
  ${performedByBlock}
  ${buildCheckoutPrintHtml(report)}
</body>
</html>`;
}

/** HTML per stampa report checkout. */
export function buildCheckoutPrintHtml(report: ParsedCheckoutReport): string {
  if (report.legacyBody && !report.outcome) {
    return `<pre>${escapeHtml(report.legacyBody)}</pre>`;
  }
  const rows: string[] = [];
  if (report.datetime) rows.push(`<tr><th>Data e ora</th><td>${escapeHtml(report.datetime)}</td></tr>`);
  if (report.outcome) rows.push(`<tr><th>Esito</th><td>${escapeHtml(report.outcome)}</td></tr>`);
  rows.push(
    `<tr><th>Tecnici in cantiere</th><td>${escapeHtml(report.team ?? "—")}</td></tr>`
  );
  if (report.review) rows.push(`<tr><th>Recensione</th><td>${escapeHtml(report.review)}</td></tr>`);

  const payments =
    report.payments.length === 0
      ? "<p>Nessun pagamento registrato</p>"
      : `<ul>${report.payments.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;

  const notes = [
    report.jobNotes
      ? `<h3>Note sull'intervento</h3><p>${escapeHtml(report.jobNotes).replace(/\n/g, "<br>")}</p>`
      : "",
    report.finalNotes
      ? `<h3>Note di chiusura</h3><p>${escapeHtml(report.finalNotes).replace(/\n/g, "<br>")}</p>`
      : "",
  ].join("");

  return `
    <table class="meta">${rows.join("")}</table>
    <h3>Pagamenti</h3>
    ${payments}
    ${notes}
  `;
}

export function parseCheckoutReport(notes?: string | null): ParsedCheckoutReport {
  const empty: ParsedCheckoutReport = {
    performer: null,
    datetime: null,
    outcome: null,
    team: null,
    review: null,
    payments: [],
    jobNotes: null,
    finalNotes: null,
    legacyBody: null,
  };
  if (!notes?.trim()) return empty;

  if (notes.includes("--- CHECKOUT REPORT ---") || notes.includes("💰 Pagamenti:")) {
    return parseLegacyReport(notes);
  }

  const structured = parseStructuredReport(notes);
  if (structured) return structured;

  return { ...empty, legacyBody: notes };
}
