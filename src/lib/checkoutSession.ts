import type { Job, JobEvent } from "@/types";
import type { Documento } from "@/types";
import {
  isCheckoutModuloPdf,
  isCheckoutSignatureImage,
  isVisibleJobAttachment,
} from "@/lib/checkoutDocuments";
import { parseDate } from "@/utils/date";

const CHECKOUT_TYPES = new Set([
  "check_out_completato",
  "check_out_da_completare",
]);

export function listCheckoutEvents(job: Job): JobEvent[] {
  return (job.events ?? [])
    .filter((e) => CHECKOUT_TYPES.has(e.type))
    .sort(
      (a, b) =>
        parseDate(b.date || b.createdAt || "").getTime() -
        parseDate(a.date || a.createdAt || "").getTime()
    );
}

export function nextCheckoutIndex(job: Job): number {
  return (
    (job.events ?? []).filter((e) => CHECKOUT_TYPES.has(e.type)).length + 1
  );
}

export function lastCheckoutEventDate(job: Job): Date | null {
  const events = listCheckoutEvents(job);
  if (events.length === 0) return null;
  const ev = events[0];
  const d = parseDate(ev.date || ev.createdAt || "");
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Primo checkout registrato (cronologico), utile per data inizio montaggio. */
export function firstCheckoutEvent(job: Job): JobEvent | null {
  const events = listCheckoutEvents(job);
  return events.length > 0 ? events[events.length - 1]! : null;
}

/** Foto/documenti generali del cantiere non ancora legati a un checkout. */
export function pendingCheckoutDocuments(docs: Documento[]): Documento[] {
  return docs.filter((d) => {
    if (!isVisibleJobAttachment(d)) return false;
    if (d.checkoutIndex != null && d.checkoutIndex > 0) return false;
    if (d.fileName?.startsWith("fine_lavoro_")) return false;
    if (d.fileName?.startsWith("checkout_")) return false;
    if (isCheckoutModuloPdf(d)) return false;
    if (isCheckoutSignatureImage(d)) return false;
    return true;
  });
}

export function documentsForCheckoutSession(
  docs: Documento[],
  checkoutIndex: number
): Documento[] {
  return docs.filter(
    (d) =>
      isVisibleJobAttachment(d) &&
      (d.checkoutIndex === checkoutIndex ||
        (d.checkoutIndex == null &&
          d.fileName?.startsWith(`fine_lavoro_${checkoutIndex}_`)))
  );
}
