// src/utils/status.ts
import type { Job } from "@/types";
import { STATUS_CONFIG } from "@/config/statusConfig";

export function getEffectiveStatus(job?: Job | null): Job["status"] {
  if (!job) return "assegnato"; // fallback a uno stato valido

  // Stati finali → non li tocchiamo
  if (
    ["completato", "annullato", "check_out_completato"].includes(job.status)
  ) {
    return job.status;
  }

  // Calcolo ritardo
  if (job.status === "in_corso" && job.plannedDate) {
    const planned = new Date(job.plannedDate);

    const endOfDay = new Date(planned);
    endOfDay.setHours(17, 0, 0, 0);

    if (new Date() > endOfDay) {
      return "in_ritardo";
    }
  }

  // Se lo stato non è in config (caso raro), fallback a "assegnato"
  return STATUS_CONFIG[job.status] ? job.status : "assegnato";
}
