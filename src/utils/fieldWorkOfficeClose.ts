import type { Job, JobOrder } from "@/types";

export const CONSEGNA_CONTROCASSE_TITLE = "consegna_controcasse";

const MONTAGGIO_FULFILLMENT_TITLES = new Set(["montaggio", "consegna_montaggio"]);
const DELIVERY_ONLY_TITLES = new Set(["consegna", "altro"]);

const DONE_JOB_STATUSES = new Set(["completato", "annullato"]);

export function isControcasseDeliveryTitle(title: string): boolean {
  return title === CONSEGNA_CONTROCASSE_TITLE;
}

export function isMontaggioFulfillmentTitle(title: string): boolean {
  return MONTAGGIO_FULFILLMENT_TITLES.has(title);
}

export function isDeliveryOnlyTitle(title: string): boolean {
  return DELIVERY_ONLY_TITLES.has(title);
}

/** Consegna/montaggio in elenco sez. 7 — non controcasse (resta in pipeline ufficio). */
export function isCantiereElencoFieldJobTitle(title: string): boolean {
  return isMontaggioFulfillmentTitle(title) || isDeliveryOnlyTitle(title);
}

function isAssistenzaJob(job: Pick<Job, "title">): boolean {
  return job.title === "assistenza";
}

function jobStatus(job: Pick<Job, "status" | "persistedStatus">): string {
  return job.persistedStatus ?? job.status;
}

function fieldJobsForOrder(jobs: Job[], orderId: string): Job[] {
  return jobs.filter((j) => j.jobOrderId === orderId && !isAssistenzaJob(j));
}

function cantiereElencoJobs(jobs: Job[], orderId: string): Job[] {
  return fieldJobsForOrder(jobs, orderId).filter((j) =>
    isCantiereElencoFieldJobTitle(j.title)
  );
}

/**
 * Consegna infissi chiusa ma montaggio (M) ancora da fare — nessun intervento aperto in cantiere.
 * Va in elenco sez. 6 «Montaggi da completare» (non è uno stato `officeStatus`).
 */
export function isMontaggioPendingAfterDelivery(
  order: Pick<JobOrder, "id" | "hasMontaggio">,
  jobs: Job[]
): boolean {
  if (!order.hasMontaggio) return false;

  const cantiere = cantiereElencoJobs(jobs, order.id);

  const montaggioSoddisfatto = cantiere.some(
    (j) => jobStatus(j) === "completato" && isMontaggioFulfillmentTitle(j.title)
  );
  if (montaggioSoddisfatto) return false;

  const deliveryComplete = cantiere.some(
    (j) => jobStatus(j) === "completato" && isDeliveryOnlyTitle(j.title)
  );
  if (!deliveryComplete) return false;

  if (cantiere.some((j) => jobStatus(j) === "da_completare")) return false;
  if (cantiere.some((j) => !DONE_JOB_STATUSES.has(jobStatus(j)))) return false;

  return true;
}

/**
 * Può passare a Terminate (e consegnate / insolute) quando i lavori cantiere rilevanti
 * sono conclusi. La consegna controcasse da sola non basta; con hasMontaggio serve
 * montaggio o consegna+montaggio completati, non solo consegna infissi.
 */
export function fieldWorkAllowsOfficeClose(
  order: Pick<JobOrder, "id" | "hasMontaggio">,
  jobs: Job[]
): boolean {
  const field = fieldJobsForOrder(jobs, order.id);
  if (field.length === 0) return false;
  if (field.some((j) => !DONE_JOB_STATUSES.has(jobStatus(j)))) return false;
  if (field.every((j) => jobStatus(j) === "annullato")) return false;
  if (field.every((j) => isControcasseDeliveryTitle(j.title))) return false;

  const hasConclusiveWork = field.some(
    (j) => jobStatus(j) === "completato" && !isControcasseDeliveryTitle(j.title)
  );
  if (!hasConclusiveWork) return false;

  if (order.hasMontaggio) {
    const montaggioSoddisfatto = field.some(
      (j) => jobStatus(j) === "completato" && isMontaggioFulfillmentTitle(j.title)
    );
    if (!montaggioSoddisfatto) return false;
  }

  return true;
}
