import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Job } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/components/ui/cn";

export type MobileJobCardMeta = {
  icon: ReactNode;
  text: string;
};

type Props = {
  to: string;
  title: string;
  subtitle?: string | null;
  status: Job["status"];
  meta?: MobileJobCardMeta[];
  accent?: string;
};

export function MobileJobCard({
  to,
  title,
  subtitle,
  status,
  meta = [],
  accent = "border-l-slate-300",
}: Props) {
  return (
    <Link
      to={to}
      className={cn(
        "block w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white",
        "shadow-sm ring-1 ring-slate-900/5 transition active:scale-[0.99]",
        "hover:border-slate-300 hover:shadow-md",
        "border-l-[4px]",
        accent
      )}
    >
      <div className="p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[15px] font-semibold leading-snug text-slate-900 line-clamp-2">
              {title}
            </p>
            {subtitle ? (
              <p className="text-xs font-medium text-slate-500 line-clamp-1">
                {subtitle}
              </p>
            ) : null}
          </div>
          <StatusBadge status={status} compact className="shrink-0 max-w-[42%]" />
        </div>

        {meta.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {meta.map((row, i) => (
              <li
                key={i}
                className="flex min-w-0 items-center gap-2.5 text-sm text-slate-700"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  {row.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Link>
  );
}
