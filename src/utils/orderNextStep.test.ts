import { describe, expect, it } from "vitest";
import type { Job, JobOrder } from "@/types";
import { getOrderNextStep } from "./orderNextStep";

function order(partial: Partial<JobOrder> = {}): JobOrder {
  return {
    id: "o1",
    code: "25-001",
    customerId: "c1",
    location: {},
    createdAt: "2026-01-01",
    officeStatus: "pronte_da_consegnare",
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
    persistedStatus: "assegnato",
    events: [],
    customer: { id: "c1", name: "Luca Verdura" },
    team: [],
    payments: [],
    docs: [],
    files: [],
    ...partial,
  } as Job;
}

describe("getOrderNextStep open field jobs", () => {
  it("counts all four open scheduled interventions", () => {
    const jobs = ["j1", "j2", "j3", "j4"].map((id) =>
      job({ id, status: "assegnato", persistedStatus: "assegnato" })
    );
    const step = getOrderNextStep(order(), jobs);
    expect(step?.title).toBe("4 interventi aperti in cantiere");
  });

  it("includes da_completare in the open total", () => {
    const jobs = [
      job({ id: "j1", status: "da_completare", persistedStatus: "da_completare" }),
      job({ id: "j2", status: "assegnato", persistedStatus: "assegnato" }),
      job({ id: "j3", status: "in_corso", persistedStatus: "in_corso" }),
      job({ id: "j4", status: "assegnato", persistedStatus: "assegnato" }),
    ];
    const step = getOrderNextStep(order(), jobs);
    expect(step?.title).toBe("4 interventi aperti (1 da completare)");
  });

  it("excludes completed jobs from open count but mentions them", () => {
    const jobs = [
      job({ id: "j1", status: "completato", persistedStatus: "completato" }),
      job({ id: "j2", status: "assegnato", persistedStatus: "assegnato" }),
      job({ id: "j3", status: "assegnato", persistedStatus: "assegnato" }),
      job({ id: "j4", status: "assegnato", persistedStatus: "assegnato" }),
    ];
    const step = getOrderNextStep(order(), jobs);
    expect(step?.title).toBe("3 interventi aperti in cantiere");
    expect(step?.description).toContain("1 intervento già concluso");
  });

  it("excludes assistenza from open count and explains why", () => {
    const jobs = [
      job({ id: "j1", title: "assistenza", status: "in_corso", persistedStatus: "in_corso" }),
      job({ id: "j2", status: "assegnato", persistedStatus: "assegnato" }),
      job({ id: "j3", status: "assegnato", persistedStatus: "assegnato" }),
      job({ id: "j4", status: "assegnato", persistedStatus: "assegnato" }),
    ];
    const step = getOrderNextStep(order(), jobs);
    expect(step?.title).toBe("3 interventi aperti in cantiere");
    expect(step?.description).toContain("assistenza post-vendita");
  });
});

describe("getOrderNextStep office pipeline", () => {
  it("points in_lavorazione to ufficio when no field jobs", () => {
    const step = getOrderNextStep(
      order({ officeStatus: "in_lavorazione" }),
      []
    );
    expect(step?.tab).toBe("ufficio");
    expect(step?.action).toBe("go_office");
    expect(step?.title).toContain("Pronte da consegnare");
    expect(step?.description).toContain("Cantiere");
  });

  it("suggests controcasse in cantiere when flagged and not yet created", () => {
    const step = getOrderNextStep(
      order({
        officeStatus: "da_mandare_in_lavorazione",
        clientConfirmedAt: "2026-06-01",
        hasControcasse: true,
      }),
      []
    );
    expect(step?.tab).toBe("cantiere");
    expect(step?.action).toBe("create_job");
    expect(step?.title).toContain("controcasse");
  });

  it("suggests office advance when da mandare without pending controcasse", () => {
    const step = getOrderNextStep(
      order({
        officeStatus: "da_mandare_in_lavorazione",
        clientConfirmedAt: "2026-06-01",
      }),
      []
    );
    expect(step?.tab).toBe("ufficio");
    expect(step?.description).toContain("Cantiere");
  });

  it("suggests montaggio after consegna when M is expected", () => {
    const step = getOrderNextStep(
      order({ officeStatus: "pronte_da_consegnare", hasMontaggio: true }),
      [job({ id: "j1", title: "consegna", status: "completato", persistedStatus: "completato" })]
    );
    expect(step?.tab).toBe("cantiere");
    expect(step?.action).toBe("create_job");
    expect(step?.title).toContain("Montaggio");
  });

  it("hides next step for closed settled orders", () => {
    expect(
      getOrderNextStep(order({ officeStatus: "conclusa_ufficio" }), [])
    ).toBeNull();
  });
});
