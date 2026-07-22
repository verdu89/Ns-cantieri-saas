import type { Job, JobOrder } from "@/types";
import { OFFICE_STATUS_CONFIG, type OfficePipelineStatus } from "@/config/officeWorkflow";
import {
  OFFICE_ELENCO_SECTIONS,
  classifyOfficeElencoSection,
} from "@/utils/officeElenco";
import {
  OFFICE_UNSETTLED_STATUS,
  fieldJobsForOrder,
  isOfficeClosedStatus,
  summarizeOrderFieldJobs,
} from "@/utils/officeBoard";
import { isEneaPraticaPending } from "@/utils/eneaPratica";
import { nextPipelineStatus } from "@/utils/officeStatusTransition";
import { isMontaggioPendingAfterDelivery } from "@/utils/fieldWorkOfficeClose";

export type OrderDetailTab = "ufficio" | "cantiere";

export type OrderNextStepAction =
  | "create_job"
  | "confirm_client"
  | "view_jobs"
  | "go_office"
  | "close_office";

export type OrderNextStep = {
  title: string;
  description: string;
  tab: OrderDetailTab;
  action?: OrderNextStepAction;
  sectionLabel?: string;
};

export function elencoSectionLabel(order: JobOrder, jobs: Job[]): string | null {
  const sectionId = classifyOfficeElencoSection(order, jobs);
  if (!sectionId) return null;
  return OFFICE_ELENCO_SECTIONS.find((s) => s.id === sectionId)?.title ?? null;
}

function formatOpenJobsTitle(summary: ReturnType<typeof summarizeOrderFieldJobs>): string {
  const { openField, incomplete } = summary;
  if (openField.length === 0) return "";
  if (incomplete.length > 0) {
    if (incomplete.length === openField.length) {
      return incomplete.length === 1
        ? "1 montaggio da completare in cantiere"
        : `${incomplete.length} montaggi da completare in cantiere`;
    }
    return `${openField.length} interventi aperti (${incomplete.length} da completare)`;
  }
  return openField.length === 1
    ? "1 intervento aperto in cantiere"
    : `${openField.length} interventi aperti in cantiere`;
}

function formatOpenJobsDescription(
  summary: ReturnType<typeof summarizeOrderFieldJobs>
): string {
  const { openField, incomplete, scheduled, closedField, assistenza } = summary;
  const parts: string[] = [];

  if (incomplete.length > 0) {
    parts.push("Completa il checkout sui montaggi segnati «da completare».");
  }
  if (scheduled.length > 0) {
    parts.push(
      scheduled.length === 1
        ? "1 intervento programmato o in corso."
        : `${scheduled.length} interventi programmati o in corso.`
    );
  }
  if (closedField.length > 0) {
    parts.push(
      closedField.length === 1
        ? "1 intervento già concluso in commessa."
        : `${closedField.length} interventi già conclusi in commessa.`
    );
  }
  if (assistenza.length > 0) {
    parts.push(
      assistenza.length === 1
        ? "1 assistenza post-vendita (non conteggiata nei montaggi)."
        : `${assistenza.length} assistenze post-vendita (non conteggiate nei montaggi).`
    );
  }

  if (parts.length === 0) {
    return openField.length === 1
      ? "Apri l'intervento per squadra, documenti e pagamenti."
      : "Programma squadra, documenti e pagamenti sui singoli interventi.";
  }

  return parts.join(" ");
}

function hasControcasseJob(jobs: Job[], orderId: string): boolean {
  return fieldJobsForOrder(jobs, orderId).some(
    (job) => job.title === "consegna_controcasse"
  );
}

function officePipelineStep(
  order: JobOrder,
  jobs: Job[],
  sectionLabel: string | undefined
): OrderNextStep | null {
  const status = order.officeStatus as OfficePipelineStatus | undefined;
  if (!status) return null;

  const next = nextPipelineStatus(status);
  const nextLabel = next ? OFFICE_STATUS_CONFIG[next].label : null;
  const cantiereHint =
    "Dal tab Cantiere puoi creare interventi anticipati (controcasse, altro).";

  if (status === "da_mandare_in_lavorazione") {
    if (order.hasControcasse && !hasControcasseJob(jobs, order.id)) {
      return {
        title: "Consegna controcasse",
        description: `Crea l'intervento di consegna controcasse in cantiere. ${cantiereHint}`,
        tab: "cantiere",
        action: "create_job",
        sectionLabel,
      };
    }
    return {
      title: nextLabel ? `Prossimo: ${nextLabel}` : "Da mandare in lavorazione",
      description: `Avanza lo stato in ufficio quando programma e ordini sono pronti. ${cantiereHint}`,
      tab: "ufficio",
      action: "go_office",
      sectionLabel,
    };
  }

  if (status === "in_lavorazione") {
    return {
      title: nextLabel ? `Prossimo: ${nextLabel}` : "In produzione officina",
      description: `Il prodotto è in officina: avanza a «Pronte da consegnare» quando è pronto. ${cantiereHint}`,
      tab: "ufficio",
      action: "go_office",
      sectionLabel,
    };
  }

  return null;
}

export function getOrderNextStep(order: JobOrder, jobs: Job[]): OrderNextStep | null {
  const sectionLabel = elencoSectionLabel(order, jobs);
  const summary = summarizeOrderFieldJobs(jobs, order.id);

  if (summary.openField.length > 0) {
    return {
      title: formatOpenJobsTitle(summary),
      description: formatOpenJobsDescription(summary),
      tab: "cantiere",
      action: "view_jobs",
      sectionLabel: sectionLabel ?? undefined,
    };
  }

  if (isMontaggioPendingAfterDelivery(order, jobs)) {
    return {
      title: "Montaggio da programmare",
      description:
        "La consegna infissi è conclusa: crea l'intervento di montaggio nel tab Cantiere.",
      tab: "cantiere",
      action: "create_job",
      sectionLabel: sectionLabel ?? undefined,
    };
  }

  if (!order.officeStatus) {
    if (summary.allField.length > 0) {
      return {
        title: "Interventi cantiere",
        description:
          "Commessa storica senza stato ufficio: apri il cantiere per vedere gli interventi o crearne di nuovi.",
        tab: "cantiere",
        action: "view_jobs",
        sectionLabel: sectionLabel ?? undefined,
      };
    }
    return {
      title: "Allinea commessa all'ufficio",
      description:
        "Commessa storica: imposta lo stato ufficio e completa la scheda elenco (settimana, note, comune), oppure passa al cantiere per un intervento.",
      tab: "ufficio",
      action: "go_office",
      sectionLabel: sectionLabel ?? undefined,
    };
  }

  if (order.officeStatus === OFFICE_UNSETTLED_STATUS) {
    return {
      title: "Saldare incassi residui",
      description:
        "Resta un importo da incassare. Aggiorna i pagamenti in ufficio per chiudere la commessa.",
      tab: "ufficio",
      action: "go_office",
      sectionLabel: sectionLabel ?? undefined,
    };
  }

  if (isOfficeClosedStatus(order.officeStatus)) {
    if (isEneaPraticaPending(order)) {
      return {
        title: "Pratica ENEA da fare",
        description:
          "Promemoria post-montaggio ancora aperto: segnala all'altro ufficio o segna completata in scheda.",
        tab: "ufficio",
        action: "go_office",
        sectionLabel: sectionLabel ?? undefined,
      };
    }
    return null;
  }

  if (order.officeStatus === "pronte_da_consegnare") {
    return {
      title: "Passa al cantiere",
      description:
        "Il prodotto è pronto: crea un intervento di consegna o montaggio per mandare la commessa in cantiere.",
      tab: "cantiere",
      action: "create_job",
      sectionLabel: sectionLabel ?? undefined,
    };
  }

  if (
    order.officeStatus === "da_mandare_in_lavorazione" &&
    !order.clientConfirmedAt
  ) {
    return {
      title: "Conferma di nuovo le misure",
      description:
        "Revisione in corso: aggiorna scheda e note, poi conferma le misure definitive prima di mandare in officina.",
      tab: "ufficio",
      action: "confirm_client",
      sectionLabel: sectionLabel ?? undefined,
    };
  }

  if (order.officeStatus === "da_definire") {
    return {
      title: "Commessa da definire",
      description:
        "Completa scheda elenco e note ufficio; quando hai le misure sposta in «Da mandare».",
      tab: "ufficio",
      action: "go_office",
      sectionLabel: sectionLabel ?? undefined,
    };
  }

  const pipelineStep = officePipelineStep(order, jobs, sectionLabel ?? undefined);
  if (pipelineStep) return pipelineStep;

  return {
    title: "Gestione ufficio",
    description: "Aggiorna stato produzione, data consegna e scheda per l'elenco.",
    tab: "ufficio",
    action: "go_office",
    sectionLabel: sectionLabel ?? undefined,
  };
}
