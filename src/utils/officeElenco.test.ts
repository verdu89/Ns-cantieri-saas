import { describe, expect, it } from "vitest";
import type { Job, JobOrder } from "@/types";
import {
  classifyOfficeElencoSection,
  inferLegacyElencoSection,
  officeNotesPreview,
  getCurrentDeliveryWeek,
  formatDeliveryWeekInput,
  deliveryWeekFromDate,
  dateInputFromDeliveryWeek,
  getDeliveryDeadlineSummary,
  contractExpiryLabel,
  latestDeliveryShiftNote,
  formatDeliveryHistoryShift,
} from "./officeElenco";

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

describe("officeNotesPreview", () => {
  it("shows only notesBackoffice, not open items", () => {
    expect(
      officeNotesPreview(
        order({
          notesBackoffice: "VETRO DA DEFINIRE",
          openItems: [{ id: "1", text: "Pannello", createdAt: "2026-01-01" }],
        })
      )
    ).toBe("VETRO DA DEFINIRE");
  });
});

describe("deliveryWeekPresetRange", () => {
  it("formats this week from current date", () => {
    const now = getCurrentDeliveryWeek(new Date("2026-06-11"));
    expect(formatDeliveryWeekInput(now.year, now.week)).toMatch(/^\d{4}\/\d{1,2}$/);
  });
});

describe("deliveryWeekFromDate", () => {
  it("matches ISO week from calendar date input", () => {
    const date = new Date("2026-06-11");
    expect(deliveryWeekFromDate("2026-06-11")).toEqual(getCurrentDeliveryWeek(date));
  });

  it("returns null when date is cleared", () => {
    expect(deliveryWeekFromDate("")).toBeNull();
  });
});

describe("getDeliveryDeadlineSummary", () => {
  it("computes days until termine", () => {
    const summary = getDeliveryDeadlineSummary(
      {
        expectedDeliveryDate: "2026-06-20T12:00:00.000Z",
        deliveryWeekYear: 2026,
        deliveryWeekNum: 25,
      },
      new Date("2026-06-11T12:00:00")
    );
    expect(summary.daysUntil).toBe(9);
    expect(summary.status).toBe("soon");
    expect(contractExpiryLabel(summary)).toBe("scade tra 9 giorni");
  });

  it("flags misaligned planned week", () => {
    const summary = getDeliveryDeadlineSummary({
      expectedDeliveryDate: "2026-06-20T12:00:00.000Z",
      deliveryWeekYear: 2026,
      deliveryWeekNum: 30,
    });
    expect(summary.weeksAligned).toBe(false);
  });
});

describe("latestDeliveryShiftNote", () => {
  it("returns latest note", () => {
    expect(
      latestDeliveryShiftNote([
        { note: "Posticipata da cliente" },
        { note: "vecchia" },
      ])
    ).toBe("Posticipata da cliente");
  });
});

describe("formatDeliveryHistoryShift", () => {
  it("formats week shift with explicit weeks", () => {
    expect(
      formatDeliveryHistoryShift({
        id: "1",
        kind: "week",
        previousDate: null,
        newDate: "2026-08-10T10:00:00.000Z",
        previousWeekYear: 2026,
        previousWeekNum: 30,
        newWeekYear: 2026,
        newWeekNum: 32,
        changedAt: "2026-06-22T10:00:00.000Z",
      })
    ).toBe("Sett. 2026/30° → Sett. 2026/32°");
  });

  it("derives weeks from legacy date-only entries", () => {
    expect(
      formatDeliveryHistoryShift({
        id: "1",
        previousDate: "2026-07-23T10:00:00.000Z",
        newDate: "2026-07-24T10:00:00.000Z",
        changedAt: "2026-06-19T10:00:00.000Z",
      })
    ).toMatch(/^Sett\. 2026\/\d+° → Sett\. 2026\/\d+°$/);
  });

  it("formats contract date changes", () => {
    expect(
      formatDeliveryHistoryShift({
        id: "1",
        kind: "contract",
        previousDate: "2026-08-10T10:00:00.000Z",
        newDate: "2026-09-01T10:00:00.000Z",
        changedAt: "2026-06-22T10:00:00.000Z",
      })
    ).toBe("Termine contratto: 10/08/2026 → 01/09/2026");
  });
});

describe("inferLegacyElencoSection", () => {
  it("maps montaggio completato to terminate", () => {
    expect(
      inferLegacyElencoSection(order(), [job({ id: "j1", status: "completato" })])
    ).toBe("terminate");
  });

  it("does not archive legacy commessa with only controcasse completata", () => {
    expect(
      inferLegacyElencoSection(order(), [
        job({ id: "j1", title: "consegna_controcasse", status: "completato" }),
      ])
    ).toBe(null);
  });

  it("does not archive when only annullati (da riprogrammare)", () => {
    expect(
      inferLegacyElencoSection(order(), [job({ id: "j1", status: "annullato" })])
    ).toBe(null);
  });

  it("does not archive controcasse completata + montaggio annullato", () => {
    expect(
      inferLegacyElencoSection(order(), [
        job({ id: "j1", title: "consegna_controcasse", status: "completato" }),
        job({ id: "j2", status: "annullato" }),
      ])
    ).toBe(null);
  });

  it("maps da_completare to montaggi_da_completare", () => {
    expect(
      inferLegacyElencoSection(order(), [job({ id: "j1", status: "da_completare" })])
    ).toBe("montaggi_da_completare");
  });

  it("maps assegnato to in_cantiere (not montaggi da completare)", () => {
    expect(
      inferLegacyElencoSection(order(), [job({ id: "j1", status: "assegnato" })])
    ).toBe("in_cantiere");
  });

  it("prioritizes da_completare over assegnato on same commessa", () => {
    expect(
      inferLegacyElencoSection(order(), [
        job({ id: "j1", status: "completato" }),
        job({ id: "j2", status: "da_completare" }),
      ])
    ).toBe("montaggi_da_completare");
  });

  it("ignores assistenza for legacy classification", () => {
    expect(
      inferLegacyElencoSection(order(), [
        job({ id: "j1", title: "assistenza", status: "in_corso" }),
      ])
    ).toBe(null);
  });
});

describe("classifyOfficeElencoSection", () => {
  it("uses pipeline status when no field jobs yet", () => {
    expect(
      classifyOfficeElencoSection(order({ officeStatus: "in_lavorazione" }), [])
    ).toBe("in_lavorazione");
  });

  it("keeps pipeline status when only controcasse is completata", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "da_mandare_in_lavorazione" }),
        [job({ id: "j1", title: "consegna_controcasse", status: "completato" })]
      )
    ).toBe("da_mandare_in_lavorazione");
  });

  it("keeps pipeline status when controcasse is aperta", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "da_mandare_in_lavorazione" }),
        [job({ id: "j1", title: "consegna_controcasse", status: "assegnato" })]
      )
    ).toBe("da_mandare_in_lavorazione");
  });

  it("moves to in_cantiere when consegna or montaggio is aperto", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "in_lavorazione" }),
        [job({ id: "j1", title: "consegna", status: "in_corso" })]
      )
    ).toBe("in_cantiere");
  });

  it("keeps in_lavorazione when controcasse is completata during production", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "in_lavorazione" }),
        [job({ id: "j1", title: "consegna_controcasse", status: "completato" })]
      )
    ).toBe("in_lavorazione");
  });

  it("does not terminate with controcasse completata and montaggio annullato", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "pronte_da_consegnare" }),
        [
          job({ id: "j1", title: "consegna_controcasse", status: "completato" }),
          job({ id: "j2", status: "annullato" }),
        ]
      )
    ).toBe("pronte_da_consegnare");
  });

  it("keeps pipeline status when montaggio completato until office close", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "pronte_da_consegnare" }),
        [job({ id: "j1", status: "completato" })]
      )
    ).toBe("pronte_da_consegnare");
  });

  it("keeps pipeline status when only consegna infissi with montaggio (M) expected", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "pronte_da_consegnare", hasMontaggio: true }),
        [job({ id: "j1", title: "consegna", status: "completato" })]
      )
    ).toBe("montaggi_da_completare");
  });

  it("maps consegna completata + M to montaggi_da_completare (legacy)", () => {
    expect(
      inferLegacyElencoSection(order({ hasMontaggio: true }), [
        job({ id: "j1", title: "consegna", status: "completato" }),
      ])
    ).toBe("montaggi_da_completare");
  });

  it("keeps pipeline status when controcasse and montaggio are both completati", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "in_lavorazione" }),
        [
          job({ id: "j1", title: "consegna_controcasse", status: "completato" }),
          job({ id: "j2", status: "completato" }),
        ]
      )
    ).toBe("in_lavorazione");
  });

  it("goes to terminate after manual office close", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "conclusa_ufficio" }),
        [job({ id: "j1", status: "completato" })]
      )
    ).toBe("terminate");
  });

  it("goes to terminate_insolute when office status is insolute", () => {
    expect(
      classifyOfficeElencoSection(
        order({ officeStatus: "conclusa_insoluta" }),
        [job({ id: "j1", status: "completato" })]
      )
    ).toBe("terminate_insolute");
  });
});

describe("dateInputFromDeliveryWeek", () => {
  it("roundtrips with deliveryWeekFromDate", () => {
    const input = dateInputFromDeliveryWeek(2026, 25);
    expect(deliveryWeekFromDate(input)).toEqual({ year: 2026, week: 25 });
  });
});
