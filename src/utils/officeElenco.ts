import type { Job, JobOrder } from "@/types";
import type { DeliveryDateChange, OfficePipelineStatus } from "@/config/officeWorkflow";
import {
  canAutoArchiveByFieldJobs,
  fieldJobsForOrder,
  isAssistenzaJob,
  isOfficeSettled,
  isOfficeUnsettled,
  jobPersistedStatus,
  summarizeOrderFieldJobs,
} from "@/utils/officeBoard";
import {
  isCantiereElencoFieldJobTitle,
  isMontaggioPendingAfterDelivery,
} from "@/utils/fieldWorkOfficeClose";
import { isEneaPraticaPending } from "@/utils/eneaPratica";

/** Sezioni dell'elenco generale (come stampa Access). */
export type OfficeElencoSectionId =
  | "da_mandare_in_lavorazione"
  | "da_definire"
  | "in_lavorazione"
  | "pronte_da_consegnare"
  | "in_cantiere"
  | "montaggi_da_completare"
  | "terminate_insolute"
  | "terminate"
  | "enea_da_fare";

export type OfficeElencoSectionMeta = {
  id: OfficeElencoSectionId;
  pdfNumber: number;
  title: string;
  description: string;
};

export const OFFICE_ELENCO_SECTIONS: OfficeElencoSectionMeta[] = [
  {
    id: "da_mandare_in_lavorazione",
    pdfNumber: 1,
    title: "Da mandare in lavorazione",
    description: "Ufficio: ordini, controcasse, programma",
  },
  {
    id: "da_definire",
    pdfNumber: 2,
    title: "Da definire",
    description: "In attesa misure o scelte",
  },
  {
    id: "in_lavorazione",
    pdfNumber: 4,
    title: "In lavorazione",
    description: "In produzione officina",
  },
  {
    id: "pronte_da_consegnare",
    pdfNumber: 5,
    title: "Pronte da consegnare",
    description: "Prodotto, in stock o attesa cliente",
  },
  {
    id: "in_cantiere",
    pdfNumber: 7,
    title: "In cantiere",
    description: "Consegna o montaggio programmati / in corso",
  },
  {
    id: "montaggi_da_completare",
    pdfNumber: 6,
    title: "Montaggi da completare",
    description:
      "Montaggio (M) ancora da fare dopo la consegna, o checkout «da completare»",
  },
  {
    id: "terminate_insolute",
    pdfNumber: 8,
    title: "Terminate ma insolute",
    description: "Lavori conclusi — incasso residuo da saldare",
  },
  {
    id: "terminate",
    pdfNumber: 9,
    title: "Terminate e consegnate",
    description: "Commesse chiuse in ufficio e saldate",
  },
  {
    id: "enea_da_fare",
    pdfNumber: 10,
    title: "Pratiche ENEA da fare",
    description: "Promemoria post-montaggio (anche commesse terminate)",
  },
];

export type OfficeElencoRow = {
  order: JobOrder;
  /** Interventi `da_completare` (sezione 6). */
  incompleteJobs: Job[];
  /** Altri interventi cantiere aperti (sezione 7). */
  activeFieldJobs: Job[];
  /** Tutti gli interventi cantiere aperti (6 + 7). */
  openFieldJobs: Job[];
};

function jobStatus(job: Job): string {
  return jobPersistedStatus(job);
}

const FIELD_JOB_DONE = new Set(["completato", "annullato"]);

function isFieldJobDone(status: string): boolean {
  return FIELD_JOB_DONE.has(status);
}

/** Commesse storiche (solo cantiere): classificazione dagli interventi collegati. */
export function inferLegacyElencoSection(
  order: JobOrder,
  jobs: Job[]
): OfficeElencoSectionId | null {
  const field = fieldJobsForOrder(jobs, order.id);
  if (field.length === 0) return null;

  const cantiereField = field.filter((j) => isCantiereElencoFieldJobTitle(j.title));

  if (cantiereField.some((j) => jobStatus(j) === "da_completare")) {
    return "montaggi_da_completare";
  }

  if (cantiereField.some((j) => !isFieldJobDone(jobStatus(j)))) {
    return "in_cantiere";
  }

  if (isMontaggioPendingAfterDelivery(order, jobs)) {
    return "montaggi_da_completare";
  }

  if (canAutoArchiveByFieldJobs(jobs, order)) {
    return "terminate";
  }

  return null;
}

export function cantiereElencoFieldJobs(jobs: Job[], orderId: string): Job[] {
  return fieldJobsForOrder(jobs, orderId).filter((j) =>
    isCantiereElencoFieldJobTitle(j.title)
  );
}

export function incompleteFieldJobs(jobs: Job[], orderId: string): Job[] {
  return cantiereElencoFieldJobs(jobs, orderId).filter(
    (j) => jobStatus(j) === "da_completare"
  );
}

export function activeNonIncompleteFieldJobs(jobs: Job[], orderId: string): Job[] {
  const done = new Set([...FIELD_JOB_DONE, "da_completare"]);
  return cantiereElencoFieldJobs(jobs, orderId).filter((j) => !done.has(jobStatus(j)));
}

export function classifyOfficeElencoSection(
  order: JobOrder,
  jobs: Job[]
): OfficeElencoSectionId | null {
  if (!order.officeStatus) {
    return inferLegacyElencoSection(order, jobs);
  }

  if (isOfficeUnsettled(order)) {
    return "terminate_insolute";
  }

  if (isOfficeSettled(order)) {
    return "terminate";
  }

  const incomplete = incompleteFieldJobs(jobs, order.id);
  if (incomplete.length > 0) {
    return "montaggi_da_completare";
  }

  const active = activeNonIncompleteFieldJobs(jobs, order.id);
  if (active.length > 0) {
    return "in_cantiere";
  }

  if (isMontaggioPendingAfterDelivery(order, jobs)) {
    return "montaggi_da_completare";
  }

  const status = order.officeStatus;
  if (
    status === "da_mandare_in_lavorazione" ||
    status === "da_definire" ||
    status === "in_lavorazione" ||
    status === "pronte_da_consegnare"
  ) {
    return status;
  }

  return "da_mandare_in_lavorazione";
}

export function buildOfficeElenco(
  orders: JobOrder[],
  jobs: Job[]
): Record<OfficeElencoSectionId, OfficeElencoRow[]> {
  const buckets = Object.fromEntries(
    OFFICE_ELENCO_SECTIONS.map((s) => [s.id, [] as OfficeElencoRow[]])
  ) as Record<OfficeElencoSectionId, OfficeElencoRow[]>;

  for (const order of orders) {
    const section = classifyOfficeElencoSection(order, jobs);
    if (section) {
      const summary = summarizeOrderFieldJobs(jobs, order.id);
      buckets[section].push({
        order,
        incompleteJobs: summary.incomplete,
        activeFieldJobs: summary.scheduled,
        openFieldJobs: summary.openField,
      });
    }
    if (isEneaPraticaPending(order)) {
      const summary = summarizeOrderFieldJobs(jobs, order.id);
      buckets.enea_da_fare.push({
        order,
        incompleteJobs: summary.incomplete,
        activeFieldJobs: summary.scheduled,
        openFieldJobs: summary.openField,
      });
    }
  }

  for (const section of OFFICE_ELENCO_SECTIONS) {
    buckets[section.id].sort(compareElencoRows);
  }

  return buckets;
}

export function compareElencoRows(a: OfficeElencoRow, b: OfficeElencoRow): number {
  const cognome = (order: JobOrder) => elencoCognomeForSort(order);

  const wa = a.order.deliveryWeekYear ?? 9999;
  const wb = b.order.deliveryWeekYear ?? 9999;
  if (wa !== wb) return wa - wb;
  const na = a.order.deliveryWeekNum ?? 99;
  const nb = b.order.deliveryWeekNum ?? 99;
  if (na !== nb) return na - nb;

  const byCognome = cognome(a.order).localeCompare(cognome(b.order), "it", {
    sensitivity: "base",
  });
  if (byCognome !== 0) return byCognome;

  return a.order.code.localeCompare(b.order.code, "it", { numeric: true });
}

function elencoCognomeForSort(order: JobOrder): string {
  const full =
    order.contactName?.trim() ||
    order.customerName?.trim() ||
    "";
  if (!full) return "";
  return full.replace(/\s+/g, " ").trim().toUpperCase().split(/\s+/)[0] ?? "";
}

export function formatDeliveryWeek(
  year?: number | null,
  week?: number | null
): string {
  if (year == null || week == null) return "";
  return `${year}/${week}°`;
}

/** Formato input filtro: `2026/25` */
export function formatDeliveryWeekInput(year: number, week: number): string {
  return `${year}/${week}`;
}

/** Settimana ISO corrente (anno + numero settimana). */
export function getCurrentDeliveryWeek(date = new Date()): {
  year: number;
  week: number;
} {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return { year, week };
}

/** Settimana ISO da data ISO o `YYYY-MM-DD` (input date). */
export function deliveryWeekFromDate(
  isoOrDate?: string | Date | null
): { year: number; week: number } | null {
  if (!isoOrDate) return null;
  const date =
    typeof isoOrDate === "string"
      ? isoOrDate.includes("T")
        ? new Date(isoOrDate)
        : new Date(`${isoOrDate}T12:00:00`)
      : isoOrDate;
  if (Number.isNaN(date.getTime())) return null;
  return getCurrentDeliveryWeek(date);
}

/** Lunedì (locale) della settimana ISO. */
export function mondayOfDeliveryWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4, 12, 0, 0, 0);
  const day = jan4.getDay() || 7;
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setDate(jan4.getDate() - day + 1);
  const monday = new Date(weekOneMonday);
  monday.setDate(weekOneMonday.getDate() + (week - 1) * 7);
  return monday;
}

/** Data rappresentativa (giovedì ISO) per `expectedDeliveryDate`, formato input date. */
export function dateInputFromDeliveryWeek(year: number, week: number): string {
  const monday = mondayOfDeliveryWeek(year, week);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const y = thursday.getFullYear();
  const m = String(thursday.getMonth() + 1).padStart(2, "0");
  const d = String(thursday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type CalendarWeekRow = {
  isoYear: number;
  isoWeek: number;
  days: { date: Date; inMonth: boolean }[];
};

/** Righe calendario (lun→dom) con numero settimana ISO per un mese. */
export function calendarWeeksForMonth(viewYear: number, viewMonth: number): CalendarWeekRow[] {
  const monthStart = new Date(viewYear, viewMonth, 1, 12, 0, 0, 0);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0, 12, 0, 0, 0);
  const gridStart = new Date(monthStart);
  const startDow = gridStart.getDay() || 7;
  gridStart.setDate(gridStart.getDate() - (startDow - 1));

  const rows: CalendarWeekRow[] = [];
  const cursor = new Date(gridStart);

  while (true) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + index);
      return { date, inMonth: date.getMonth() === viewMonth };
    });
    const iso = getCurrentDeliveryWeek(days[3].date);
    rows.push({ isoYear: iso.year, isoWeek: iso.week, days });
    cursor.setDate(cursor.getDate() + 7);
    if (cursor > monthEnd && days[6].date > monthEnd) break;
  }

  return rows;
}

export type DeliveryDeadlineStatus = "none" | "ok" | "soon" | "this_week" | "overdue";

export type DeliveryDeadlineSummary = {
  termineIso: string | null | undefined;
  plannedWeek: { year: number; week: number } | null;
  termineWeek: { year: number; week: number } | null;
  daysUntil: number | null;
  status: DeliveryDeadlineStatus;
  weeksAligned: boolean;
  statusLabel: string;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Riepilogo termine di consegna vs settimana pianificata in elenco. */
export function getDeliveryDeadlineSummary(
  order: Pick<
    JobOrder,
    "expectedDeliveryDate" | "deliveryWeekYear" | "deliveryWeekNum"
  >,
  now = new Date()
): DeliveryDeadlineSummary {
  const termineIso = order.expectedDeliveryDate;
  const plannedWeek =
    order.deliveryWeekYear != null && order.deliveryWeekNum != null
      ? { year: order.deliveryWeekYear, week: order.deliveryWeekNum }
      : null;
  const termineWeek = termineIso ? deliveryWeekFromDate(termineIso) : null;

  let daysUntil: number | null = null;
  let status: DeliveryDeadlineStatus = "none";
  let statusLabel = "Termine non impostato";

  if (termineIso) {
    const termine = startOfLocalDay(new Date(termineIso));
    const today = startOfLocalDay(now);
    daysUntil = Math.round(
      (termine.getTime() - today.getTime()) / 86_400_000
    );
    if (daysUntil < 0) {
      status = "overdue";
      statusLabel =
        daysUntil === -1
          ? "Scaduta ieri"
          : `In arretrato di ${Math.abs(daysUntil)} giorni`;
    } else if (daysUntil === 0) {
      status = "this_week";
      statusLabel = "Scade oggi";
    } else if (daysUntil === 1) {
      status = "soon";
      statusLabel = "Scade domani";
    } else if (daysUntil <= 7) {
      status = "this_week";
      statusLabel = `Scade tra ${daysUntil} giorni (questa settimana)`;
    } else if (daysUntil <= 14) {
      status = "soon";
      statusLabel = `Scade tra ${daysUntil} giorni`;
    } else {
      status = "ok";
      statusLabel = `Scade tra ${daysUntil} giorni`;
    }
  } else if (plannedWeek) {
    statusLabel = "Solo settimana pianificata (termine non indicato in commessa)";
  }

  const weeksAligned = Boolean(
    plannedWeek &&
      termineWeek &&
      plannedWeek.year === termineWeek.year &&
      plannedWeek.week === termineWeek.week
  );

  return {
    termineIso,
    plannedWeek,
    termineWeek,
    daysUntil,
    status,
    weeksAligned,
    statusLabel,
  };
}

/** Frase breve per scadenza contratto, es. «scade tra 49 giorni». */
export function contractExpiryLabel(
  summary: Pick<
    DeliveryDeadlineSummary,
    "termineIso" | "daysUntil" | "status"
  >
): string | null {
  if (!summary.termineIso || summary.daysUntil === null) return null;
  if (summary.daysUntil < 0) {
    const days = Math.abs(summary.daysUntil);
    return days === 1 ? "scaduta ieri" : `in arretrato di ${days} giorni`;
  }
  if (summary.daysUntil === 0) return "scade oggi";
  if (summary.daysUntil === 1) return "scade domani";
  return `scade tra ${summary.daysUntil} giorni`;
}

export function latestDeliveryShiftNote(
  history: ReadonlyArray<{ note?: string | null }> | undefined
): string | null {
  const note = history?.[0]?.note?.trim();
  return note || null;
}

function historyWeekFromEntry(
  entry: {
    previousWeekYear?: number | null;
    previousWeekNum?: number | null;
    newWeekYear?: number | null;
    newWeekNum?: number | null;
    previousDate?: string | null;
    newDate?: string | null;
  },
  side: "previous" | "new"
): { year: number; week: number } | null {
  if (side === "previous") {
    if (entry.previousWeekYear != null && entry.previousWeekNum != null) {
      return { year: entry.previousWeekYear, week: entry.previousWeekNum };
    }
    return deliveryWeekFromDate(entry.previousDate);
  }
  if (entry.newWeekYear != null && entry.newWeekNum != null) {
    return { year: entry.newWeekYear, week: entry.newWeekNum };
  }
  return deliveryWeekFromDate(entry.newDate);
}

function formatHistoryWeekLabel(week: { year: number; week: number } | null): string {
  if (!week) return "—";
  return `Sett. ${formatDeliveryWeek(week.year, week.week)}`;
}

/** Riga principale storico spostamenti (settimana elenco o termine contratto). */
export function formatDeliveryHistoryShift(entry: DeliveryDateChange): string {
  if (entry.kind === "contract") {
    const from = entry.previousDate
      ? new Date(entry.previousDate).toLocaleDateString("it-IT")
      : "—";
    const to = entry.newDate
      ? new Date(entry.newDate).toLocaleDateString("it-IT")
      : "—";
    return `Termine contratto: ${from} → ${to}`;
  }

  const previous = historyWeekFromEntry(entry, "previous");
  const next = historyWeekFromEntry(entry, "new");
  return `${formatHistoryWeekLabel(previous)} → ${formatHistoryWeekLabel(next)}`;
}

export function addDeliveryWeeks(
  year: number,
  week: number,
  deltaWeeks: number
): { year: number; week: number } {
  const midWeek = new Date(year, 0, 1 + (week - 1) * 7 + 3);
  midWeek.setDate(midWeek.getDate() + deltaWeeks * 7);
  return getCurrentDeliveryWeek(midWeek);
}

/** Settimana copertina librone: di solito la precedente (stampa il lunedì). */
export function getLibroneDefaultPrintWeek(date = new Date()): {
  year: number;
  week: number;
} {
  const current = getCurrentDeliveryWeek(date);
  return addDeliveryWeeks(current.year, current.week, -1);
}

export function formatLibronePrintWeekLabel(week: {
  year: number;
  week: number;
}): string {
  return `${week.week}-${week.year}`;
}

export function parseLibronePrintWeekLabel(value: string): {
  year?: number;
  week?: number;
} {
  const m = value.trim().match(/^(\d{1,2})-(\d{4})$/);
  if (!m) return {};
  return { week: Number.parseInt(m[1], 10), year: Number.parseInt(m[2], 10) };
}

export type DeliveryWeekPresetId =
  | ""
  | "this_week"
  | "next_4"
  | "next_8"
  | "overdue";

export const DELIVERY_WEEK_PRESETS: {
  id: DeliveryWeekPresetId;
  label: string;
  hint: string;
}[] = [
  { id: "this_week", label: "Questa settimana", hint: "Consegne in settimana corrente" },
  {
    id: "next_4",
    label: "Prossime 4 settimane",
    hint: "Da oggi — per programmare consegne in arrivo",
  },
  {
    id: "next_8",
    label: "Prossime 8 settimane",
    hint: "Orizzonte medio di pianificazione",
  },
  {
    id: "overdue",
    label: "In arretrato",
    hint: "Settimana consegna già passata",
  },
];

export function deliveryWeekPresetRange(
  preset: DeliveryWeekPresetId
): { from: string; to: string } {
  if (!preset) return { from: "", to: "" };
  const now = getCurrentDeliveryWeek();
  const fmt = formatDeliveryWeekInput;
  switch (preset) {
    case "this_week":
      return { from: fmt(now.year, now.week), to: fmt(now.year, now.week) };
    case "next_4": {
      const end = addDeliveryWeeks(now.year, now.week, 3);
      return { from: fmt(now.year, now.week), to: fmt(end.year, end.week) };
    }
    case "next_8": {
      const end = addDeliveryWeeks(now.year, now.week, 7);
      return { from: fmt(now.year, now.week), to: fmt(end.year, end.week) };
    }
    case "overdue": {
      const last = addDeliveryWeeks(now.year, now.week, -1);
      return { from: "", to: fmt(last.year, last.week) };
    }
    default:
      return { from: "", to: "" };
  }
}

export function parseDeliveryWeekInput(value: string): {
  year?: number;
  week?: number;
} {
  const m = value.trim().match(/^(\d{4})\/(\d{1,2})$/);
  if (!m) return {};
  return { year: Number.parseInt(m[1], 10), week: Number.parseInt(m[2], 10) };
}

/** Testo colonna Note ufficio nell'elenco (solo notesBackoffice, come Access). */
export function officeNotesPreview(order: JobOrder): string {
  return order.notesBackoffice?.trim() ?? "";
}

/** Note commessa visibili anche in cantiere (non ufficio). */
export function fieldNotesPreview(order: JobOrder): string {
  return order.notes?.trim() ?? "";
}

/** @deprecated Usare officeNotesPreview / fieldNotesPreview */
export function orderNotesPreview(order: JobOrder): string {
  const office = officeNotesPreview(order);
  const field = fieldNotesPreview(order);
  if (office && field) return `${office}. ${field}`;
  return office || field;
}

export function matchesElencoSearch(row: OfficeElencoRow, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const o = row.order;
  return (
    o.code.toLowerCase().includes(query) ||
    (o.customerName ?? "").toLowerCase().includes(query) ||
    (o.contactName ?? "").toLowerCase().includes(query) ||
    (o.destinationCity ?? "").toLowerCase().includes(query) ||
    (o.productColor ?? "").toLowerCase().includes(query) ||
    officeNotesPreview(o).toLowerCase().includes(query) ||
    fieldNotesPreview(o).toLowerCase().includes(query)
  );
}

export function matchesWeekFilter(
  order: JobOrder,
  fromYear?: number,
  fromWeek?: number,
  toYear?: number,
  toWeek?: number
): boolean {
  const y = order.deliveryWeekYear;
  const w = order.deliveryWeekNum;
  if (y == null || w == null) {
    return fromYear == null && toYear == null;
  }
  const value = y * 100 + w;
  const min =
    fromYear != null && fromWeek != null ? fromYear * 100 + fromWeek : null;
  const max = toYear != null && toWeek != null ? toYear * 100 + toWeek : null;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

/** Commessa visibile in elenco ufficio (workflow o storico cantiere). */
export function isOfficeOrder(order: JobOrder, jobs: Job[]): boolean {
  return (
    Boolean(order.officeStatus) ||
    inferLegacyElencoSection(order, jobs) != null ||
    isEneaPraticaPending(order)
  );
}

export function pipelineStatusForSection(
  section: OfficeElencoSectionId
): OfficePipelineStatus | null {
  if (
    section === "da_mandare_in_lavorazione" ||
    section === "da_definire" ||
    section === "in_lavorazione" ||
    section === "pronte_da_consegnare"
  ) {
    return section;
  }
  return null;
}

export function assistenzaJobsOnOrder(jobs: Job[], orderId: string): Job[] {
  return jobs.filter((j) => j.jobOrderId === orderId && isAssistenzaJob(j));
}
