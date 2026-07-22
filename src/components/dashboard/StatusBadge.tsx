import type { Job } from "@/types";
import { STATUS_CONFIG } from "@/config/statusConfig";
import { cn } from "@/components/ui/cn";

const SHORT_LABEL: Partial<Record<Job["status"], string>> = {
  in_attesa_programmazione: "In attesa",
  da_completare: "Da compl.",
};

type Props = {
  status: Job["status"];
  compact?: boolean;
  className?: string;
};

export function StatusBadge({ status, compact = false, className }: Props) {
  const cfg = STATUS_CONFIG[status];
  const label =
    compact && SHORT_LABEL[status] ? SHORT_LABEL[status] : cfg?.label ?? status;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight",
        cfg?.color,
        className
      )}
    >
      {cfg?.icon ? <span className="shrink-0 text-[10px]">{cfg.icon}</span> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
