import { describe, expect, it } from "vitest";
import type { JobOrder } from "@/types";
import {
  eneaPraticaFlagTitle,
  eneaInclusionPatch,
  isEneaPraticaCompleted,
  isEneaPraticaPending,
  isEneaPraticaScheduled,
} from "./eneaPratica";

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

describe("eneaPratica", () => {
  it("auto-activates reminder when ENEA is added on archived commessa", () => {
    const patch = eneaInclusionPatch(
      order({ officeStatus: "conclusa_ufficio" })
    );
    expect(patch.hasEneaPratica).toBe(true);
    expect(patch.eneaPraticaPendingAt).toBeTruthy();
    expect(
      eneaInclusionPatch(
        order({
          officeStatus: "in_lavorazione",
        })
      ).eneaPraticaPendingAt
    ).toBeUndefined();
  });

  it("detects scheduled, pending and completed", () => {
    expect(isEneaPraticaScheduled(order({ hasEneaPratica: true }))).toBe(true);
    expect(
      isEneaPraticaPending(
        order({
          hasEneaPratica: true,
          eneaPraticaPendingAt: "2026-06-01T10:00:00.000Z",
        })
      )
    ).toBe(true);
    expect(
      isEneaPraticaCompleted(
        order({
          hasEneaPratica: true,
          eneaPraticaCompletedAt: "2026-06-02T10:00:00.000Z",
        })
      )
    ).toBe(true);
  });

  it("builds flag tooltip", () => {
    expect(eneaPraticaFlagTitle(order({ hasEneaPratica: true }))).toContain(
      "prevista"
    );
    expect(
      eneaPraticaFlagTitle(
        order({
          hasEneaPratica: true,
          eneaPraticaPendingAt: "2026-06-01T10:00:00.000Z",
        })
      )
    ).toContain("da fare");
  });
});
