import { describe, expect, it } from "vitest";
import { jobMatchesListSearch } from "./listSearch";
import type { Customer, Job, JobOrder } from "@/types";

const order: JobOrder = {
  id: "o1",
  code: "2025-001",
  customerId: "c1",
  location: {},
  createdAt: "2025-01-01",
};

const customer: Customer = {
  id: "c1",
  name: "Rossi Srl",
  phone: "333",
};

const job: Job = {
  id: "j1",
  jobOrderId: "o1",
  createdAt: "2025-01-01",
  plannedDate: null,
  title: "montaggio",
  status: "assegnato",
  assignedWorkers: ["w1"],
  customer,
  team: [],
  payments: [],
  docs: [],
  events: [],
  files: [],
};

describe("jobMatchesListSearch", () => {
  it("matches montatore name from workers list", () => {
    expect(
      jobMatchesListSearch(job, order, customer, "mauro", [
        { id: "w1", name: "Mauro Cuccu" },
      ])
    ).toBe(true);
  });

  it("matches montatore name from job.team", () => {
    expect(
      jobMatchesListSearch(
        {
          ...job,
          assignedWorkers: [],
          team: [{ id: "w1", name: "Luca Bianchi", userId: "u1" }],
        },
        order,
        customer,
        "luca"
      )
    ).toBe(true);
  });

  it("does not match unrelated query", () => {
    expect(
      jobMatchesListSearch(job, order, customer, "verdi", [
        { id: "w1", name: "Mauro Cuccu" },
      ])
    ).toBe(false);
  });
});
