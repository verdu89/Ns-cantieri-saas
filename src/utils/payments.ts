import type { Payment } from "@/types";

/** Importo già incassato (totale o parziale). */
export function collectedPaymentAmount(p: Payment): number {
  if (p.collected) return p.amount ?? 0;
  if (p.partial) return p.collectedAmount ?? 0;
  return 0;
}
