import { describe, expect, it } from "vitest";
import {
  collectedPaymentAmount,
  parseMoneyAmount,
  paymentAmountClass,
  economicCollectedClass,
  economicExpectedClass,
  economicResidualClass,
} from "./payments";
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

describe("parseMoneyAmount", () => {
  it("parses italian decimal comma", () => {
    expect(parseMoneyAmount("500,50")).toBe(500.5);
    expect(parseMoneyAmount("1586,48")).toBe(1586.48);
  });

  it("parses thousands with dot and decimal comma", () => {
    expect(parseMoneyAmount("6.700,00")).toBe(6700);
    expect(parseMoneyAmount("1.500,50")).toBe(1500.5);
  });

  it("parses dot decimals", () => {
    expect(parseMoneyAmount("1586.48")).toBe(1586.48);
  });

  it("returns null for invalid values", () => {
    expect(parseMoneyAmount("")).toBeNull();
    expect(parseMoneyAmount("abc")).toBeNull();
  });
});

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

describe("paymentAmountClass", () => {
  it("returns green when collected", () => {
    expect(paymentAmountClass(payment({ collected: true }))).toBe("text-green-700");
  });

  it("returns yellow when partial", () => {
    expect(paymentAmountClass(payment({ partial: true, collectedAmount: 50 }))).toBe(
      "text-yellow-600"
    );
  });

  it("returns red when pending", () => {
    expect(paymentAmountClass(payment({}))).toBe("text-red-600");
  });
});

describe("economic column classes", () => {
  it("colors collected and residual consistently", () => {
    expect(economicCollectedClass()).toBe("text-green-700");
    expect(economicExpectedClass()).toBe("text-slate-900");
    expect(economicResidualClass(100)).toBe("text-red-600");
    expect(economicResidualClass(0)).toBe("text-green-700");
  });
});
