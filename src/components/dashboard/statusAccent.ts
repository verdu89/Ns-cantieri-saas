import type { Job } from "@/types";

/** Bordo sinistro card intervento per stato effettivo */
export const STATUS_ACCENT: Record<Job["status"], string> = {
  in_attesa_programmazione: "border-l-amber-500",
  assegnato: "border-l-blue-500",
  in_corso: "border-l-sky-500",
  da_completare: "border-l-purple-500",
  completato: "border-l-emerald-500",
  annullato: "border-l-slate-400",
  in_ritardo: "border-l-red-500",
};
