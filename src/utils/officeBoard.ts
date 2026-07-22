import type { Job, JobOrder } from "@/types";
import type { OfficeStatus } from "@/config/officeWorkflow";
import {
  fieldWorkAllowsOfficeClose,
  isCantiereElencoFieldJobTitle,
  isMontaggioPendingAfterDelivery,
} from "@/utils/fieldWorkOfficeClose";

export const OFFICE_CLOSED_STATUS = "conclusa_ufficio" as const;
export const OFFICE_UNSETTLED_STATUS = "conclusa_insoluta" as const;

export function isOfficeClosedStatus(
  status: string | null | undefined
): status is typeof OFFICE_CLOSED_STATUS | typeof OFFICE_UNSETTLED_STATUS {
  return status === OFFICE_CLOSED_STATUS || status === OFFICE_UNSETTLED_STATUS;
}

export function isOfficeSettled(order: JobOrder): boolean {
  return order.officeStatus === OFFICE_CLOSED_STATUS;
}

export function isOfficeUnsettled(order: JobOrder): boolean {
  return order.officeStatus === OFFICE_UNSETTLED_STATUS;
}

export type OfficeBoardTab = "gestire" | "cantiere" | "concluse";

export type OfficeBoardTabMeta = {
  id: OfficeBoardTab;
  label: string;
  hint: string;
};

export const OFFICE_BOARD_TABS: OfficeBoardTabMeta[] = [
  {
    id: "gestire",
    label: "Da gestire in ufficio",
    hint: "Produzione, ordini, controcasse — prima del cantiere",
  },
  {
    id: "cantiere",
    label: "In cantiere",
    hint: "Consegna o montaggio aperti (non assistenza)",
  },
  {
    id: "concluse",
    label: "Concluse",
    hint: "Consegna/montaggio finiti — le assistenze restano in Assistenza",
  },
];

const DONE_JOB_STATUSES = new Set(["completato", "annullato"]);

export function jobPersistedStatus(job: Job): string {
  return job.persistedStatus ?? job.status;
}

export function isAssistenzaJob(job: Job): boolean {
  return job.title === "assistenza";
}

export function isControcasseDeliveryJob(job: Job): boolean {
  return job.title === "consegna_controcasse";
}

export function fieldJobsForOrder(jobs: Job[], orderId: string): Job[] {
  return jobs.filter((j) => j.jobOrderId === orderId && !isAssistenzaJob(j));
}

export function isFieldJobOpen(job: Job): boolean {
  return !DONE_JOB_STATUSES.has(jobPersistedStatus(job));
}

/** Completato in modo definitivo (non annullato da riprogrammare). */
export function isFieldJobConclusivelyClosed(job: Job): boolean {
  return jobPersistedStatus(job) === "completato";
}

/** Interventi ancora da seguire in cantiere (programmati / in corso). */
export function hasActiveFieldWork(jobs: Job[], orderId: string): boolean {
  return fieldJobsForOrder(jobs, orderId).some((j) => {
    const status = jobPersistedStatus(j);
    return status !== "completato" && status !== "annullato";
  });
}

/**
 * Lavori cantiere conclusi secondo regole commessa (M, controcasse, consegna vs montaggio).
 */
export function canAutoArchiveByFieldJobs(
  jobs: Job[],
  order: Pick<JobOrder, "id" | "hasMontaggio">
): boolean {
  return fieldWorkAllowsOfficeClose(order, jobs);
}

export type OrderFieldJobsSummary = {
  allField: Job[];
  openField: Job[];
  incomplete: Job[];
  scheduled: Job[];
  closedField: Job[];
  assistenza: Job[];
};

/** Riepilogo interventi commessa per UI elenco / prossimo passo. */
export function summarizeOrderFieldJobs(jobs: Job[], orderId: string): OrderFieldJobsSummary {
  const orderJobs = jobs.filter((j) => j.jobOrderId === orderId);
  const assistenza = orderJobs.filter(isAssistenzaJob);
  const allField = orderJobs.filter((j) => !isAssistenzaJob(j));
  const openField = allField.filter(isFieldJobOpen);
  const incomplete = openField.filter((j) => jobPersistedStatus(j) === "da_completare");
  const scheduled = openField.filter((j) => jobPersistedStatus(j) !== "da_completare");
  const closedField = allField.filter((j) => !isFieldJobOpen(j));
  return { allField, openField, incomplete, scheduled, closedField, assistenza };
}

export function openFieldJobsForOrder(jobs: Job[], orderId: string): Job[] {
  return summarizeOrderFieldJobs(jobs, orderId).openField;
}

export function isOfficeManuallyClosed(order: JobOrder): boolean {
  return isOfficeClosedStatus(order.officeStatus);
}

export function isOfficeAutoConcluded(order: JobOrder, jobs: Job[]): boolean {
  return canAutoArchiveByFieldJobs(jobs, order);
}

/** Commessa in archivio elenco: saldata, insoluta, o interventi conclusivi completati. */
export function isOfficeConcluded(order: JobOrder, jobs: Job[]): boolean {
  if (isOfficeClosedStatus(order.officeStatus)) return true;
  return canAutoArchiveByFieldJobs(jobs, order);
}

export function classifyOfficeOrder(
  order: JobOrder,
  jobs: Job[]
): OfficeBoardTab | null {
  if (!order.officeStatus) return null;

  const openField = fieldJobsForOrder(jobs, order.id).filter(
    (j) => isFieldJobOpen(j) && isCantiereElencoFieldJobTitle(j.title)
  );
  if (openField.length > 0) return "cantiere";

  if (isMontaggioPendingAfterDelivery(order, jobs)) return "cantiere";

  if (isOfficeClosedStatus(order.officeStatus) || canAutoArchiveByFieldJobs(jobs, order)) {
    return "concluse";
  }

  return "gestire";
}

export function isPipelineOfficeStatus(
  status: string | null | undefined
): status is OfficeStatus {
  return (
    status === "da_definire" ||
    status === "da_mandare_in_lavorazione" ||
    status === "in_lavorazione" ||
    status === "pronte_da_consegnare"
  );
}

export function openFieldJobsSummary(jobs: Job[], orderId: string): string {
  const { openField, incomplete } = summarizeOrderFieldJobs(jobs, orderId);
  if (openField.length === 0) return "";
  if (incomplete.length > 0) {
    return incomplete.length === openField.length
      ? incomplete.length === 1
        ? "1 montaggio da completare"
        : `${incomplete.length} montaggi da completare`
      : `${openField.length} interventi aperti (${incomplete.length} da completare)`;
  }
  if (openField.length === 1) return "1 intervento aperto";
  return `${openField.length} interventi aperti`;
}
