import { describe, expect, it } from "vitest";
import { collectedPaymentAmount } from "./payments";
import type { Payment } from "@/types";

function payment(partial: Partial<Payment>): Payment {
  return {
    id: "p1",
    jobId: "j1",
    label: "Test",
    amount: 100,
    collected: false,
    partial: false,
    collectedAmount: 0,
    ...partial,
  };
}

describe("collectedPaymentAmount", () => {
  it("returns full amount when collected", () => {
    expect(collectedPaymentAmount(payment({ collected: true, amount: 250 }))).toBe(250);
  });

  it("returns partial amount when not fully collected", () => {
    expect(
      collectedPaymentAmount(
        payment({ partial: true, collectedAmount: 40, amount: 100 })
      )
    ).toBe(40);
  });

  it("returns zero when pending", () => {
    expect(collectedPaymentAmount(payment({}))).toBe(0);
  });
});
