import { describe, expect, it } from "vitest";
import { canOfferReviewRequestAtCheckout } from "./jobTitles";

describe("canOfferReviewRequestAtCheckout", () => {
  it("disables review for consegna controcasse", () => {
    expect(canOfferReviewRequestAtCheckout("consegna_controcasse")).toBe(false);
  });

  it("allows review for consegna infissi and montaggio", () => {
    expect(canOfferReviewRequestAtCheckout("consegna")).toBe(true);
    expect(canOfferReviewRequestAtCheckout("consegna_montaggio")).toBe(true);
    expect(canOfferReviewRequestAtCheckout("montaggio")).toBe(true);
  });
});
