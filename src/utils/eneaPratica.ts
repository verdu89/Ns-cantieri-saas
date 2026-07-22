import type { JobOrder } from "@/types";
import { isOfficeClosedStatus } from "@/utils/officeBoard";

export function isEneaPraticaPending(order: Pick<
  JobOrder,
  "hasEneaPratica" | "eneaPraticaPendingAt" | "eneaPraticaCompletedAt"
>): boolean {
  return Boolean(
    order.hasEneaPratica &&
      order.eneaPraticaPendingAt &&
      !order.eneaPraticaCompletedAt
  );
}

export function isEneaPraticaCompleted(order: Pick<
  JobOrder,
  "hasEneaPratica" | "eneaPraticaCompletedAt"
>): boolean {
  return Boolean(order.hasEneaPratica && order.eneaPraticaCompletedAt);
}

export function isEneaPraticaScheduled(order: Pick<
  JobOrder,
  "hasEneaPratica" | "eneaPraticaPendingAt" | "eneaPraticaCompletedAt"
>): boolean {
  return Boolean(
    order.hasEneaPratica &&
      !order.eneaPraticaPendingAt &&
      !order.eneaPraticaCompletedAt
  );
}

export function eneaPraticaFlagTitle(order: Pick<
  JobOrder,
  "hasEneaPratica" | "eneaPraticaPendingAt" | "eneaPraticaCompletedAt"
>): string {
  if (!order.hasEneaPratica) return "Senza pratica ENEA";
  if (isEneaPraticaPending(order)) return "Pratica ENEA da fare";
  if (isEneaPraticaCompleted(order)) return "Pratica ENEA completata";
  return "Pratica ENEA prevista (post montaggio)";
}

/** Su commesse archiviate, l'ENEA va subito in «da fare» (non solo «prevista»). */
export function eneaInclusionPatch(
  order: Pick<
    JobOrder,
    | "officeStatus"
    | "hasEneaPratica"
    | "eneaPraticaPendingAt"
    | "eneaPraticaCompletedAt"
  >
): Pick<JobOrder, "hasEneaPratica" | "eneaPraticaPendingAt"> {
  const base = { hasEneaPratica: true as const };
  if (
    isOfficeClosedStatus(order.officeStatus) &&
    !order.eneaPraticaCompletedAt &&
    !order.eneaPraticaPendingAt
  ) {
    return { ...base, eneaPraticaPendingAt: new Date().toISOString() };
  }
  return base;
}
