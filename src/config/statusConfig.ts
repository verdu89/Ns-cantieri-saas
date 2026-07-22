// src/config/statusConfig.ts
import type { Job } from "@/types";
import {
  isPlannedDateOverdue as isPlannedDateOverdueShared,
  resolveJobDisplayStatus as resolveJobDisplayStatusShared,
  type PersistedJobStatus,
} from "@/lib/jobOverdueCalendar";

/**
 * Configurazione visuale degli status
 */
export const STATUS_CONFIG: Record<
  Job["status"],
  { color: string; label: string; icon?: string }
> = {
  in_attesa_programmazione: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    label: "In attesa programmazione",
    icon: "⏳",
  },
  assegnato: {
    color: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Assegnato",
    icon: "📌",
  },
  in_corso: {
    color: "bg-sky-50 text-sky-700 border-sky-200",
    label: "In corso",
    icon: "🔧",
  },
  da_completare: {
    color: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Da completare",
    icon: "📝",
  },
  completato: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Completato",
    icon: "✅",
  },
  annullato: {
    color: "bg-gray-100 text-gray-600 border-gray-200",
    label: "Annullato",
    icon: "❌",
  },
  in_ritardo: {
    color: "bg-red-100 text-red-700 border-red-200",
    label: "In ritardo",
    icon: "⚠️",
  },
};

/** Stati impostati esplicitamente (checkout / annullamento): il filtro usa il valore in DB. */
const PERSISTED_FILTER_STATUSES = new Set<Job["status"]>([
  "da_completare",
  "completato",
  "annullato",
]);

/** Re-export per compatibilità test/UI. Logica in `@shared-overdue`. */
export function isJobPlannedOverdue(
  plannedDate: string | Date,
  now = new Date(),
  tz?: string
): boolean {
  return isPlannedDateOverdueShared(plannedDate, now, tz);
}

/**
 * Stato mostrato in UI (allineato a `autoUpdateStatus` in `src/api/jobs.ts` e al promoter backend).
 */
export function getJobDisplayStatus(
  persistedStatus: Job["status"],
  plannedDate?: string | Date | null,
  now = new Date()
): Job["status"] {
  return resolveJobDisplayStatusShared(
    persistedStatus as PersistedJobStatus,
    plannedDate,
    now
  ) as Job["status"];
}

/** @deprecated Usare `getJobDisplayStatus` con stato persistito. */
export function getEffectiveStatus(
  status: Job["status"],
  plannedDate?: string | Date | null
): Job["status"] {
  return getJobDisplayStatus(status, plannedDate);
}

/** Filtro dashboard: stati da checkout/annullamento sul DB; gli altri sullo stato visualizzato. */
export function matchesJobStatusFilter(
  persistedStatus: Job["status"],
  displayStatus: Job["status"],
  filter: Job["status"]
): boolean {
  if (PERSISTED_FILTER_STATUSES.has(filter)) {
    return persistedStatus === filter;
  }
  return displayStatus === filter;
}
