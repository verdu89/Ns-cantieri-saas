type Props = {
  completed: number;
  total: number;
  label?: string;
  className?: string;
};

export default function UploadProgressBar({
  completed,
  total,
  label,
  className = "",
}: Props) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(100, Math.round((completed / safeTotal) * 100));

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs text-slate-600">
        <span className="truncate pr-2">{label ?? "Caricamento in corso…"}</span>
        <span className="shrink-0 tabular-nums">
          {completed}/{total} ({pct}%)
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
