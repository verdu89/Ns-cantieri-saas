import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type DataCardRow = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

type Props = {
  title: string;
  subtitle?: string | null;
  badge?: ReactNode;
  rows?: DataCardRow[];
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Card compatta per liste su schermi piccoli (sostituto tabelle larghe). */
export function DataCard({
  title,
  subtitle,
  badge,
  rows = [],
  footer,
  children,
  className,
}: Props) {
  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-slate-900 line-clamp-2">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-2">
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? <div className="shrink-0 max-w-[48%]">{badge}</div> : null}
      </div>

      {children}

      {rows.length > 0 ? (
        <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start justify-between gap-3 text-sm">
              <dt className="shrink-0 text-slate-500">{row.label}</dt>
              <dd
                className={cn(
                  "min-w-0 text-right font-medium text-slate-800",
                  row.valueClassName
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? (
        <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div>
      ) : null}
    </article>
  );
}
