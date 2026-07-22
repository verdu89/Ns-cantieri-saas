import { describe, expect, it } from "vitest";
import type { JobOrder } from "@/types";
import type { Job } from "@/types";
import {
  checkOfficeCloseTransition,
  checkOfficeStatusTransition,
  isMeasurementsAwaitingDefinition,
  isMeasurementsRevisionPending,
  nextPipelineStatus,
  previousPipelineStatus,
} from "./officeStatusTransition";

function order(partial: Partial<JobOrder> = {}): JobOrder {
  return {
    id: "o1",
    code: "25-001",
    customerId: "c1",
    location: {},
    createdAt: "2026-01-01",
    officeStatus: "da_mandare_in_lavorazione",
    ...partial,
  };
}

function job(partial: Partial<Job> & { id: string }): Job {
  return {
    jobOrderId: "o1",
    createdAt: "2026-01-01",
    plannedDate: null,
    title: "montaggio",
    assignedWorkers: [],
    status: "assegnato",
    events: [],
    customer: { id: "c1", name: "Test" },
    team: [],
    payments: [],
    docs: [],
    files: [],
    ...partial,
  } as Job;
}

describe("officeStatusTransition", () => {
  it("advances along pipeline", () => {
    expect(nextPipelineStatus("da_definire")).toBe("da_mandare_in_lavorazione");
    expect(nextPipelineStatus("da_mandare_in_lavorazione")).toBe("in_lavorazione");
    expect(nextPipelineStatus("pronte_da_consegnare")).toBeNull();
  });

  it("goes back along pipeline", () => {
    expect(previousPipelineStatus("in_lavorazione")).toBe("da_mandare_in_lavorazione");
    expect(previousPipelineStatus("da_definire")).toBeNull();
  });

  it("warns when sending to in_lavorazione without client confirm", () => {
    const check = checkOfficeStatusTransition(order(), "in_lavorazione");
    expect(check.warning).toBe("missing_client_confirm");
  });

  it("allows in_lavorazione when client confirmed", () => {
    const check = checkOfficeStatusTransition(
      order({ clientConfirmedAt: "2026-06-01T10:00:00.000Z" }),
      "in_lavorazione"
    );
    expect(check.warning).toBeUndefined();
  });

  it("detects revision pending vs awaiting definition", () => {
    expect(
      isMeasurementsAwaitingDefinition(order({ officeStatus: "da_definire" }))
    ).toBe(true);
    expect(
      isMeasurementsRevisionPending(
        order({ officeStatus: "da_mandare_in_lavorazione" })
      )
    ).toBe(true);
    expect(
      isMeasurementsRevisionPending(
        order({
          officeStatus: "da_mandare_in_lavorazione",
          clientConfirmedAt: "2026-06-01T10:00:00.000Z",
        })
      )
    ).toBe(false);
  });

  it("blocks office close when field jobs are still open", () => {
    const check = checkOfficeCloseTransition(
      [job({ id: "j1", status: "assegnato" })],
      "o1"
    );
    expect(check.allowed).toBe(false);
    expect(check.openJobs).toHaveLength(1);
  });

  it("allows office close when all field jobs are completato or annullato", () => {
    expect(
      checkOfficeCloseTransition(
        [job({ id: "j1", status: "completato" })],
        "o1"
      ).allowed
    ).toBe(true);
    expect(
      checkOfficeCloseTransition(
        [job({ id: "j1", status: "annullato" })],
        "o1"
      ).allowed
    ).toBe(true);
  });
});
