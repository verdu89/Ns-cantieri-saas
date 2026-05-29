import type { Job } from "@/types";
import { STATUS_CONFIG } from "@/config/statusConfig";
import { cn } from "@/components/ui/cn";

type Props = {
  total: number;
  counts: Record<Job["status"], number>;
  statuses: Job["status"][];
  className?: string;
};

export function KpiSummaryStrip({ total, counts, statuses, className }: Props) {
  const tiles = statuses.filter((s) => (counts[s] ?? 0) > 0);

  return (
    <section className={cn("space-y-2", className)}>
      <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Riepilogo settimana
      </h2>
      <div
        className={cn(
          "flex gap-2.5 overflow-x-auto pb-1 -mx-0.5 px-0.5",
          "snap-x snap-mandatory scroll-smooth",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:mx-0 md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:px-0 lg:grid-cols-4"
        )}
      >
        <KpiTile
          label="Totale interventi"
          value={total}
          className="border-slate-200 bg-white text-slate-900"
          labelClass="text-slate-500"
        />
        {tiles.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <KpiTile
              key={s}
              label={cfg.label}
              value={counts[s]}
              icon={cfg.icon}
              className={cn(cfg.color, "border-current/20")}
              labelClass="opacity-90"
            />
          );
        })}
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  icon,
  className,
  labelClass,
}: {
  label: string;
  value: number;
  icon?: string;
  className?: string;
  labelClass?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[88px] min-w-[128px] shrink-0 snap-start flex-col justify-between rounded-2xl border p-3.5 shadow-sm ring-1 ring-black/5",
        "sm:min-w-[140px] md:min-h-0 md:min-w-0",
        className
      )}
    >
      <p
        className={cn(
          "flex items-start gap-1 text-[11px] font-semibold leading-snug line-clamp-2",
          labelClass
        )}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="min-w-0">{label}</span>
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}
