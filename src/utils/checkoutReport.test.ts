import { describe, expect, it } from "vitest";
import {
  buildCheckoutReportNotes,
  buildCheckoutReportPrintDocument,
  formatCheckoutPerformer,
  formatPaymentLine,
  mergeJobNotesAtCheckout,
  parseCheckoutReport,
} from "./checkoutReport";
import type { Payment } from "@/types";

describe("checkoutReport", () => {
  it("formats performer with name only when name is set", () => {
    expect(formatCheckoutPerformer("Mario Rossi", "mario@test.it")).toBe("Mario Rossi");
    expect(formatCheckoutPerformer("prova", "prova@local.test")).toBe("prova");
  });

  it("builds readable report without empty note sections", () => {
    const notes = buildCheckoutReportNotes({
      performedByName: "prova",
      performedByEmail: "prova@local.test",
      datetimeLabel: "16/05/2026, 20:20",
      stato: "da_completare",
      technicianNames: ["prova", "Mauro Cuccu"],
      payments: [
        { id: "1", jobId: "j", label: "Acconto", amount: 100, collected: false, partial: false, collectedAmount: 0 },
      ] as Payment[],
      jobNotes: "",
      finalConclusion: "",
      requestReviewFeatureEnabled: true,
      requestReview: "no",
    });

    expect(notes).toContain("Checkout effettuato da: prova");
    expect(notes).toContain("Esito: Da completare");
    expect(notes).toContain("Tecnici in cantiere: prova, Mauro Cuccu");
    expect(notes).toContain("Recensione al cliente: No");
    expect(notes).not.toContain("--- CHECKOUT");
    expect(notes).not.toContain("Note sull'intervento");
    expect(notes).not.toContain("Note di chiusura");
  });

  it("parses new and legacy reports", () => {
    const legacy = `--- CHECKOUT REPORT ---
Checkout effettuato da: prova
Data: 16/05/2026, 20:20
Esito: DA_COMPLETARE
 Tecnici: prova, Mauro Cuccu
`;
    const parsed = parseCheckoutReport(legacy);
    expect(parsed.performer).toBe("prova");
    expect(parsed.outcome).toBe("Da completare");
    expect(parsed.team).toBe("prova, Mauro Cuccu");
  });

  it("appends closure note to existing job notes", () => {
    const merged = mergeJobNotesAtCheckout(
      "Giorno 1: posa finestre",
      "Da tornare per silicone",
      "20/05/2026"
    );
    expect(merged).toContain("Giorno 1: posa finestre");
    expect(merged).toContain("--- Chiusura checkout 20/05/2026 ---");
    expect(merged).toContain("Da tornare per silicone");
  });

  it("formats payment in euros", () => {
    const line = formatPaymentLine({
      id: "1",
      jobId: "j",
      label: "Acconto",
      amount: 250,
      collected: true,
      partial: false,
      collectedAmount: 250,
    } as Payment);
    expect(line).toContain("Acconto");
    expect(line).toContain("incassato");
    expect(line).toMatch(/250/);
  });

  it("builds full HTML document for print", () => {
    const report = parseCheckoutReport(
      buildCheckoutReportNotes({
        performedByName: "Mario",
        performedByEmail: "m@test.it",
        datetimeLabel: "01/01/2026, 10:00",
        stato: "completato",
        technicianNames: ["Mario"],
        payments: [],
        jobNotes: "",
        finalConclusion: "",
        requestReviewFeatureEnabled: false,
        requestReview: "no",
      })
    );
    const html = buildCheckoutReportPrintDocument(report, {
      customerName: "Rossi",
      orderCode: "25-100",
      performedBy: "Mario",
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Rossi");
    expect(html).toContain("25-100");
    expect(html).toContain("Mario");
  });
});
