/** Logica calendario ritardo job — tenere allineato a `backend/src/lib/jobOverdueCalendar.ts`. */

export const JOB_OVERDUE_TZ = "Europe/Rome";

/** Cutoff orario (Europe/Rome): dopo questa ora, stesso giorno pianificato = in ritardo. */
export const JOB_OVERDUE_CUTOFF_HOUR = 17;

export function calendarDateInTz(date: Date, tz = JOB_OVERDUE_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function timePartsInTz(date: Date, tz = JOB_OVERDUE_TZ): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "0"),
  };
}

/**
 * Giorno pianificato passato, oppure stesso giorno dopo le 17:00 (fuso operativo).
 * `plannedDate` è l'istante UTC del datetime pianificato (come in DB).
 */
export function isPlannedDateOverdue(
  plannedDate: Date | string,
  now = new Date(),
  tz = JOB_OVERDUE_TZ,
  cutoffHour = JOB_OVERDUE_CUTOFF_HOUR
): boolean {
  const planned = plannedDate instanceof Date ? plannedDate : new Date(plannedDate);
  if (Number.isNaN(planned.getTime())) return false;

  const plannedDay = calendarDateInTz(planned, tz);
  const today = calendarDateInTz(now, tz);

  if (today > plannedDay) return true;
  if (today < plannedDay) return false;

  const { hour, minute } = timePartsInTz(now, tz);
  return hour > cutoffHour || (hour === cutoffHour && minute > 0);
}

export type PersistedJobStatus =
  | "in_attesa_programmazione"
  | "assegnato"
  | "in_corso"
  | "da_completare"
  | "completato"
  | "annullato"
  | "in_ritardo";

/**
 * Stato visualizzato a partire da stato persistito + data pianificata.
 * Allineato a promoter backend e liste in app.
 */
export function resolveJobDisplayStatus(
  persistedStatus: PersistedJobStatus,
  plannedDate: string | Date | null | undefined,
  now = new Date(),
  tz = JOB_OVERDUE_TZ
): PersistedJobStatus {
  if (!plannedDate) return persistedStatus;

  const planned = plannedDate instanceof Date ? plannedDate : new Date(plannedDate);
  if (Number.isNaN(planned.getTime())) return persistedStatus;

  const overdue = isPlannedDateOverdue(planned, now, tz);

  if (persistedStatus === "assegnato") {
    if (planned <= now) {
      return overdue ? "in_ritardo" : "in_corso";
    }
    return persistedStatus;
  }

  if (persistedStatus === "in_corso" && overdue) {
    return "in_ritardo";
  }

  return persistedStatus;
}
