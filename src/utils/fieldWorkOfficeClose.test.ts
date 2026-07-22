import { describe, expect, it } from "vitest";
import type { Job, JobOrder } from "@/types";
import {
  fieldWorkAllowsOfficeClose,
  isMontaggioPendingAfterDelivery,
} from "./fieldWorkOfficeClose";

function order(partial: Partial<JobOrder> = {}): JobOrder {
  return {
    id: "o1",
    code: "25-001",
    customerId: "c1",
    location: {},
    createdAt: "2026-01-01",
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
    status: "completato",
    persistedStatus: "completato",
    events: [],
    customer: { id: "c1", name: "Test" },
    team: [],
    payments: [],
    docs: [],
    files: [],
    ...partial,
  } as Job;
}

describe("fieldWorkAllowsOfficeClose", () => {
  it("does not close with only controcasse completata", () => {
    expect(
      fieldWorkAllowsOfficeClose(order(), [
        job({ id: "j1", title: "consegna_controcasse" }),
      ])
    ).toBe(false);
  });

  it("does not close consegna infissi when montaggio (M) is expected", () => {
    expect(
      fieldWorkAllowsOfficeClose(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna" }),
      ])
    ).toBe(false);
  });

  it("closes consegna infissi when montaggio (M) is not expected", () => {
    expect(
      fieldWorkAllowsOfficeClose(order({ hasMontaggio: false }), [
        job({ id: "j1", title: "consegna" }),
      ])
    ).toBe(true);
  });

  it("closes consegna e montaggio when M is expected", () => {
    expect(
      fieldWorkAllowsOfficeClose(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna_montaggio" }),
      ])
    ).toBe(true);
  });

  it("closes after consegna and montaggio separati with M", () => {
    expect(
      fieldWorkAllowsOfficeClose(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna" }),
        job({ id: "j2", title: "montaggio" }),
      ])
    ).toBe(true);
  });

  it("does not close controcasse + consegna when M still expected", () => {
    expect(
      fieldWorkAllowsOfficeClose(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna_controcasse" }),
        job({ id: "j2", title: "consegna" }),
      ])
    ).toBe(false);
  });
});

describe("isMontaggioPendingAfterDelivery", () => {
  it("is true after consegna completata when M is expected", () => {
    expect(
      isMontaggioPendingAfterDelivery(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna", status: "completato" }),
      ])
    ).toBe(true);
  });

  it("is false without M flag", () => {
    expect(
      isMontaggioPendingAfterDelivery(order({ hasMontaggio: false }), [
        job({ id: "j1", title: "consegna", status: "completato" }),
      ])
    ).toBe(false);
  });

  it("is false while montaggio is still open", () => {
    expect(
      isMontaggioPendingAfterDelivery(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna", status: "completato" }),
        job({ id: "j2", title: "montaggio", status: "assegnato" }),
      ])
    ).toBe(false);
  });

  it("is false when montaggio is already completato", () => {
    expect(
      isMontaggioPendingAfterDelivery(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna", status: "completato" }),
        job({ id: "j2", title: "montaggio", status: "completato" }),
      ])
    ).toBe(false);
  });
});
