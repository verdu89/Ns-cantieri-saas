import { describe, expect, it } from "vitest";
import { getJobDisplayStatus, isJobPlannedOverdue } from "./statusConfig";

describe("isJobPlannedOverdue", () => {
  it("is overdue on a later calendar day (Europe/Rome)", () => {
    expect(
      isJobPlannedOverdue(
        "2024-01-15T09:00:00",
        new Date("2024-01-16T10:00:00")
      )
    ).toBe(true);
  });

  it("is not overdue before 17:00 on the planned day", () => {
    expect(
      isJobPlannedOverdue(
        "2024-06-01T09:00:00",
        new Date("2024-06-01T16:30:00")
      )
    ).toBe(false);
  });

  it("is overdue after 17:00 on the planned day", () => {
    expect(
      isJobPlannedOverdue(
        "2024-06-01T09:00:00",
        new Date("2024-06-01T17:01:00")
      )
    ).toBe(true);
  });
});

describe("getJobDisplayStatus", () => {
  it("shows in_ritardo for assegnato with a planned date far in the past", () => {
    expect(
      getJobDisplayStatus(
        "assegnato",
        "2023-06-01T09:00:00",
        new Date("2026-05-28T12:00:00")
      )
    ).toBe("in_ritardo");
  });

  it("shows in_corso for assegnato on the planned day before cutoff", () => {
    expect(
      getJobDisplayStatus(
        "assegnato",
        "2024-06-01T09:00:00",
        new Date("2024-06-01T10:00:00")
      )
    ).toBe("in_corso");
  });

  it("shows in_ritardo for in_corso after cutoff", () => {
    expect(
      getJobDisplayStatus(
        "in_corso",
        "2024-06-01T09:00:00",
        new Date("2024-06-01T18:00:00")
      )
    ).toBe("in_ritardo");
  });

  it("keeps assegnato when the planned datetime is still in the future", () => {
    expect(
      getJobDisplayStatus(
        "assegnato",
        "2026-12-01T14:00:00",
        new Date("2026-05-28T12:00:00")
      )
    ).toBe("assegnato");
  });
});
