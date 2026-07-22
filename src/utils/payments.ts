import type { Payment, OrderPayment } from "@/types";

/** Normalizza importo digitato (virgola italiana, spazi). Null se non valido. */
export function parseMoneyAmount(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Importo già incassato (totale o parziale). */
export function collectedPaymentAmount(p: Payment): number {
  if (p.collected) return p.amount ?? 0;
  if (p.partial) return p.collectedAmount ?? 0;
  return 0;
}

/** Classe Tailwind per colorare l'importo in base allo stato di incasso. */
export function paymentAmountClass(
  p: Pick<Payment, "collected" | "partial">
): string {
  if (p.collected) return "text-green-700";
  if (p.partial) return "text-yellow-600";
  return "text-red-600";
}

/** Pagamento commessa visibile in cantiere salvo esplicito hide (showOnField=false). */
export function isOrderPaymentVisibleOnField(
  p: Pick<OrderPayment, "showOnField">
): boolean {
  return p.showOnField !== false;
}

export function orderPaymentFieldKey(label: string, amount: number): string {
  return `${label}\0${amount}`;
}

/** Colonne aggregate (gestione economica, report): previsto / incassato / residuo. */
export function economicExpectedClass(): string {
  return "text-slate-900";
}

export function economicCollectedClass(): string {
  return "text-green-700";
}

export function economicResidualClass(residual: number): string {
  return residual > 0 ? "text-red-600" : "text-green-700";
}
