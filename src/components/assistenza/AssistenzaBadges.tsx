import type { Job } from "@/types";
import { JOB_PRIORITY_CONFIG, isAssistenzaJob } from "@/config/assistenzaConfig";

export function AssistenzaBadges({ job }: { job: Job }) {
  if (!isAssistenzaJob(job)) return null;

  const priority = job.priority ?? "normale";
  const count = job.followUpCount ?? 0;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {priority !== "normale" && (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${JOB_PRIORITY_CONFIG[priority].className}`}
        >
          {JOB_PRIORITY_CONFIG[priority].label}
        </span>
      )}
      {count > 0 && (
        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900">
          Sollecitato ×{count}
        </span>
      )}
    </span>
  );
}
