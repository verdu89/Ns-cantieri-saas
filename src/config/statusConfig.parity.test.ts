import { describe, expect, it } from "vitest";
import { getJobDisplayStatus } from "@/config/statusConfig";
import { resolveJobDisplayStatus } from "@/lib/jobOverdueCalendar";

/** Garantisce che il wrapper frontend e il modulo condiviso restino allineati. */
describe("job display status parity", () => {
  it("getJobDisplayStatus matches shared resolveJobDisplayStatus", () => {
    const cases = [
      { status: "assegnato" as const, planned: "2023-01-10T08:00:00", now: "2026-05-28T12:00:00" },
      { status: "in_corso" as const, planned: "2024-06-01T07:00:00Z", now: "2024-06-01T18:00:00Z" },
      { status: "assegnato" as const, planned: "2026-12-01T14:00:00", now: "2026-05-28T12:00:00" },
      { status: "da_completare" as const, planned: "2024-01-01T08:00:00", now: "2026-01-01T08:00:00" },
    ];

    for (const c of cases) {
      const now = new Date(c.now);
      expect(getJobDisplayStatus(c.status, c.planned, now)).toBe(
        resolveJobDisplayStatus(c.status, c.planned, now)
      );
    }
  });
});
