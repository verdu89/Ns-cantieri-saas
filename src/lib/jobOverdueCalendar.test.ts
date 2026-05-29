import { describe, expect, it } from "vitest";
import {
  isPlannedDateOverdue,
  resolveJobDisplayStatus,
} from "./jobOverdueCalendar.js";

describe("jobOverdueCalendar", () => {
  it("is overdue on a later calendar day (Europe/Rome)", () => {
    expect(
      isPlannedDateOverdue(
        new Date("2024-01-15T08:00:00Z"),
        new Date("2024-01-16T09:00:00Z")
      )
    ).toBe(true);
  });

  it("is not overdue before cutoff on the planned day", () => {
    expect(
      isPlannedDateOverdue(
        "2024-06-01T07:00:00Z",
        new Date("2024-06-01T14:00:00Z")
      )
    ).toBe(false);
  });

  it("shows in_ritardo for assegnato with planned date far in the past", () => {
    expect(
      resolveJobDisplayStatus(
        "assegnato",
        "2023-06-01T07:00:00Z",
        new Date("2026-05-28T10:00:00Z")
      )
    ).toBe("in_ritardo");
  });

  it("shows in_corso for assegnato on planned day before cutoff", () => {
    expect(
      resolveJobDisplayStatus(
        "assegnato",
        "2024-06-01T07:00:00Z",
        new Date("2024-06-01T10:00:00Z")
      )
    ).toBe("in_corso");
  });
});
