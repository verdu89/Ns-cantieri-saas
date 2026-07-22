import type { Job, JobPriority, JobStatus } from "@/types";

export const ASSISTENZA_TITLE = "assistenza" as const;

export const JOB_PRIORITY_CONFIG: Record<
  JobPriority,
  { label: string; className: string }
> = {
  normale: { label: "Normale", className: "bg-slate-100 text-slate-700" },
  alta: { label: "Alta", className: "bg-amber-100 text-amber-900" },
  urgente: { label: "Urgente", className: "bg-red-100 text-red-900" },
};

const PRIORITY_RANK: Record<JobPriority, number> = {
  urgente: 0,
  alta: 1,
  normale: 2,
};

const CLOSED: JobStatus[] = ["completato", "annullato"];

export function isAssistenzaJob(job: Pick<Job, "title">): boolean {
  return job.title === ASSISTENZA_TITLE;
}

export function isOpenAssistenzaJob(job: Pick<Job, "persistedStatus" | "status">): boolean {
  const s = job.persistedStatus ?? job.status;
  return !CLOSED.includes(s);
}

export function compareAssistenzaJobs(a: Job, b: Job): number {
  const pa = a.priority ?? "normale";
  const pb = b.priority ?? "normale";
  if (PRIORITY_RANK[pa] !== PRIORITY_RANK[pb]) {
    return PRIORITY_RANK[pa] - PRIORITY_RANK[pb];
  }
  const fc = (b.followUpCount ?? 0) - (a.followUpCount ?? 0);
  if (fc !== 0) return fc;
  const la = a.lastFollowUpAt ? new Date(a.lastFollowUpAt).getTime() : 0;
  const lb = b.lastFollowUpAt ? new Date(b.lastFollowUpAt).getTime() : 0;
  if (lb !== la) return lb - la;
  const da = a.plannedDate ? new Date(a.plannedDate).getTime() : Number.MAX_SAFE_INTEGER;
  const db = b.plannedDate ? new Date(b.plannedDate).getTime() : Number.MAX_SAFE_INTEGER;
  return da - db;
}

export type AssistenzaListFilter =
  | "all"
  | "open"
  | "urgent"
  | "sollecitati"
  | "in_attesa_programmazione"
  | "assegnato"
  | "in_corso"
  | "da_completare";

export function matchesAssistenzaListFilter(
  job: Job,
  filter: AssistenzaListFilter
): boolean {
  const persisted = job.persistedStatus ?? job.status;
  switch (filter) {
    case "all":
      return true;
    case "open":
      return isOpenAssistenzaJob(job);
    case "urgent":
      return isOpenAssistenzaJob(job) && job.priority === "urgente";
    case "sollecitati":
      return isOpenAssistenzaJob(job) && (job.followUpCount ?? 0) > 0;
    case "in_attesa_programmazione":
    case "assegnato":
    case "in_corso":
    case "da_completare":
      return persisted === filter;
    default:
      return true;
  }
}
