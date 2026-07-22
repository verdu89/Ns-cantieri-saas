import { describe, expect, it, vi, afterEach } from "vitest";
import { appendCheckoutFormToReport } from "@/utils/checkoutFormReport";
import {
  buildCheckoutFormDefaults,
  resolveMountingStartDate,
} from "./checkoutForm";
import type { Job, JobEvent } from "@/types";

function checkoutEvent(
  id: string,
  date: string,
  notes: string
): JobEvent {
  return {
    id,
    jobId: "j1",
    type: "check_out_da_completare",
    timestamp: date,
    date,
    notes,
    createdBy: "w1",
  };
}

function jobWithCheckouts(
  events: JobEvent[],
  plannedDate: string | null = "2026-05-20T08:00:00"
): Job {
  return {
    id: "j1",
    jobOrderId: "o1",
    createdAt: "2026-01-01T00:00:00",
    plannedDate,
    title: "consegna_montaggio",
    status: "da_completare",
    assignedWorkers: [],
    customer: { id: "c1", name: "Cliente", phone: "" },
    team: [],
    payments: [],
    docs: [],
    files: [],
    events,
  };
}

describe("resolveMountingStartDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses today when there are no prior checkouts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T10:00:00"));
    const job = jobWithCheckouts([]);
    expect(resolveMountingStartDate(job)).toBe("2026-05-28");
  });

  it("keeps the start date from the first checkout module", () => {
    const firstNotes = appendCheckoutFormToReport("Report", {
      dataInizioMontaggio: "2026-05-05",
      dataFineMontaggio: "2026-05-05",
      serramentiControllo: null,
      vetriIntegri: null,
      siliconeAcrilico: null,
      noteMontatore: "",
      noteCliente: "",
      clienteSignerName: "Mario",
    });
    const job = jobWithCheckouts([
      checkoutEvent("e1", "2026-05-05T18:00:00", firstNotes),
      checkoutEvent(
        "e2",
        "2026-05-12T18:00:00",
        appendCheckoutFormToReport("Report", {
          dataInizioMontaggio: "2026-05-12",
          dataFineMontaggio: "2026-05-12",
          serramentiControllo: null,
          vetriIntegri: null,
          siliconeAcrilico: null,
          noteMontatore: "",
          noteCliente: "",
          clienteSignerName: "Mario",
        })
      ),
    ]);
    expect(resolveMountingStartDate(job)).toBe("2026-05-05");
  });

  it("buildCheckoutFormDefaults sets fine montaggio to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T10:00:00"));
    const firstNotes = appendCheckoutFormToReport("Report", {
      dataInizioMontaggio: "2026-05-05",
      dataFineMontaggio: "2026-05-05",
      serramentiControllo: null,
      vetriIntegri: null,
      siliconeAcrilico: null,
      noteMontatore: "",
      noteCliente: "",
      clienteSignerName: "Mario",
    });
    const job = jobWithCheckouts([
      checkoutEvent("e1", "2026-05-05T18:00:00", firstNotes),
    ]);
    const form = buildCheckoutFormDefaults(job);
    expect(form.dataInizioMontaggio).toBe("2026-05-05");
    expect(form.dataFineMontaggio).toBe("2026-05-28");
  });
});
