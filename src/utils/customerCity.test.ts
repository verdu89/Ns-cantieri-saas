import { describe, expect, it } from "vitest";
import {
  customerDestinationCity,
  customerDisplayName,
  customerElencoFieldsFromAnagrafica,
  elencoNomeFromCustomerName,
  extractCityFromAddress,
} from "./customerCity";

describe("extractCityFromAddress", () => {
  it("parses CAP + city at end", () => {
    expect(extractCityFromAddress("Via Roma 12, 09100 Cagliari")).toBe("CAGLIARI");
  });

  it("parses city with province suffix", () => {
    expect(extractCityFromAddress("Viale Poetto 5, 09126 Cagliari (CA)")).toBe(
      "CAGLIARI"
    );
  });

  it("returns null for empty", () => {
    expect(extractCityFromAddress("")).toBeNull();
  });
});

describe("customerDisplayName", () => {
  it("uses full customer name uppercase", () => {
    expect(customerDisplayName({ name: "Rossi Mario" })).toBe("ROSSI MARIO");
    expect(elencoNomeFromCustomerName("Rossi Mario")).toBe("ROSSI MARIO");
  });
});

describe("customerElencoFieldsFromAnagrafica", () => {
  it("derives nome and comune from customer", () => {
    expect(
      customerElencoFieldsFromAnagrafica({
        name: "Rossi Mario",
        address: "Via X, 09100 Cagliari",
      })
    ).toEqual({
      contactName: "ROSSI MARIO",
      destinationCity: "CAGLIARI",
    });
  });
});

describe("customerDestinationCity", () => {
  it("prefers structured city field", () => {
    expect(
      customerDestinationCity({
        city: "Monserrato",
        address: "Via X, 09042 Cagliari",
      })
    ).toBe("MONSERRATO");
  });
});
