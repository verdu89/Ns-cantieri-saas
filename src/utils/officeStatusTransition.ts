import type { Job, JobOrder } from "@/types";
import {
  OFFICE_PIPELINE_STATUSES,
  OFFICE_STATUS_CONFIG,
  type OfficePipelineStatus,
} from "@/config/officeWorkflow";
import { openFieldJobsForOrder } from "./officeBoard";

export type StatusTransitionWarning = "missing_client_confirm";

export type StatusTransitionCheck = {
  allowed: boolean;
  warning?: StatusTransitionWarning;
  title?: string;
  message?: string;
};

export function pipelineIndex(
  status: OfficePipelineStatus | string | null | undefined
): number {
  if (!status || status === "conclusa_ufficio" || status === "conclusa_insoluta") {
    return -1;
  }
  return OFFICE_PIPELINE_STATUSES.indexOf(status as OfficePipelineStatus);
}

export function nextPipelineStatus(
  status: OfficePipelineStatus | string | null | undefined
): OfficePipelineStatus | null {
  const index = pipelineIndex(status);
  if (index < 0 || index >= OFFICE_PIPELINE_STATUSES.length - 1) return null;
  return OFFICE_PIPELINE_STATUSES[index + 1];
}

export function previousPipelineStatus(
  status: OfficePipelineStatus | string | null | undefined
): OfficePipelineStatus | null {
  const index = pipelineIndex(status);
  if (index <= 0) return null;
  return OFFICE_PIPELINE_STATUSES[index - 1];
}

export function isClientConfirmed(order: JobOrder): boolean {
  return Boolean(order.clientConfirmedAt);
}

/** Commessa creata senza misure: in attesa del primo rilievo. */
export function isMeasurementsAwaitingDefinition(order: JobOrder): boolean {
  return order.officeStatus === "da_definire" && !isClientConfirmed(order);
}

/** Misure già note ma conferma tolta (revisione in corso). */
export function isMeasurementsRevisionPending(order: JobOrder): boolean {
  if (isClientConfirmed(order)) return false;
  if (!order.officeStatus || order.officeStatus === "da_definire") return false;
  if (
    order.officeStatus === "conclusa_ufficio" ||
    order.officeStatus === "conclusa_insoluta"
  ) {
    return false;
  }
  return true;
}

/** Controllo prima di impostare uno stato pipeline. */
export function checkOfficeStatusTransition(
  order: JobOrder,
  target: OfficePipelineStatus
): StatusTransitionCheck {
  if (target === "in_lavorazione" && !isClientConfirmed(order)) {
    if (isMeasurementsAwaitingDefinition(order)) {
      return {
        allowed: true,
        warning: "missing_client_confirm",
        title: "Misure definitive non confermate",
        message:
          "La commessa è ancora in «Da definire». Conferma le misure definitive (con eventuale nota) prima di mandare in officina, oppure spostala in «Da mandare» se la scheda è completa.",
      };
    }
    if (isMeasurementsRevisionPending(order)) {
      return {
        allowed: true,
        warning: "missing_client_confirm",
        title: "Conferma dopo revisione",
        message:
          "Revisione misure in corso. Aggiorna scheda e note, poi conferma di nuovo prima di mandare in officina.",
      };
    }
    return {
      allowed: true,
      warning: "missing_client_confirm",
      title: "Misure definitive non confermate",
      message:
        "Registra la conferma delle misure definitive (con eventuale nota) prima di mandare in officina.",
    };
  }

  return { allowed: true };
}

export function statusTransitionLabel(target: OfficePipelineStatus): string {
  return OFFICE_STATUS_CONFIG[target].label;
}

export function advanceStatusLabel(
  current: OfficePipelineStatus | string | null | undefined
): string | null {
  const next = nextPipelineStatus(current);
  if (!next) return null;
  return `Passo successivo: ${OFFICE_STATUS_CONFIG[next].label}`;
}

export type OfficeCloseCheck = {
  allowed: boolean;
  title: string;
  message: string;
  openJobs: Job[];
};

/** Blocca archivio ufficio se restano interventi cantiere senza checkout concluso. */
export function checkOfficeCloseTransition(
  jobs: Job[],
  orderId: string
): OfficeCloseCheck {
  const openJobs = openFieldJobsForOrder(jobs, orderId);
  if (openJobs.length === 0) {
    return { allowed: true, title: "", message: "", openJobs: [] };
  }
  return {
    allowed: false,
    title: "Completa il checkout prima",
    message:
      "Non puoi passare a Terminate e consegnate finché restano interventi cantiere aperti. Completa il checkout (o annulla l'intervento se va riprogrammato).",
    openJobs,
  };
}
