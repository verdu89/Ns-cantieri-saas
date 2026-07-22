import type { Customer } from "@/types";

const PROVINCE_SUFFIX = /\s*\([A-Z]{2}\)\s*$/i;
const STREET_PREFIX =
  /^(via|viale|v\.|vle|p\.?\s*zza|piazza|corso|c\.so|loc\.?|località|strada|s\.s\.|ss\.|vocabolo)\b/i;

function normalizeElencoToken(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Nome completo cliente (come in anagrafica) per colonna Nome elenco. */
export function customerDisplayName(
  customer: Pick<Customer, "name"> | null | undefined
): string {
  if (!customer?.name?.trim()) return "";
  return normalizeElencoToken(customer.name);
}

export function elencoNomeFromCustomerName(name?: string | null): string {
  return customerDisplayName(name ? { name } : null);
}

/** @deprecated Usare customerDisplayName — Cognome elenco = nome cliente anagrafica. */
export function elencoCognomeFromCustomerName(name?: string | null): string {
  return elencoNomeFromCustomerName(name);
}

function cleanCityToken(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Estrae il comune da un indirizzo cliente (testo libero anagrafica). */
export function extractCityFromAddress(address?: string | null): string | null {
  if (!address?.trim()) return null;

  const withoutProv = address.trim().replace(PROVINCE_SUFFIX, "").trim();

  const capMatch = withoutProv.match(/\b(\d{5})\s+([A-Za-zÀ-ÿ'’.·\-\s]+)$/u);
  if (capMatch?.[2]) {
    return cleanCityToken(capMatch[2]);
  }

  const parts = withoutProv
    .split(/[,–\-]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].replace(/\b\d{5}\b/g, "").trim();
    if (!part || part.length < 2 || STREET_PREFIX.test(part)) continue;
    if (/^\d+[A-Za-z]?$/.test(part)) continue;
    return cleanCityToken(part);
  }

  if (parts.length === 1 && !/\d{5}/.test(withoutProv) && !STREET_PREFIX.test(withoutProv)) {
    return cleanCityToken(withoutProv);
  }

  return null;
}

/** Comune destinazione elenco, dall'indirizzo anagrafica cliente. */
export function customerDestinationCity(
  customer: Pick<Customer, "address" | "city"> | null | undefined
): string {
  if (!customer) return "";
  if (customer.city?.trim()) return cleanCityToken(customer.city);
  return extractCityFromAddress(customer.address) ?? "";
}

/** Campi elenco sincronizzati dall'anagrafica cliente collegata alla commessa. */
export function customerElencoFieldsFromAnagrafica(
  customer: Pick<Customer, "name" | "address" | "city"> | null | undefined
): { contactName: string | null; destinationCity: string | null } {
  const contactName = customerDisplayName(customer) || null;
  const destinationCity = customerDestinationCity(customer) || null;
  return { contactName, destinationCity };
}
