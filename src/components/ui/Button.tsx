import { cn } from "./cn";
import { usePreventDoubleClick } from "@/hooks/usePreventDoubleClick";

type Variant =
  | "primary"
  | "secondary"
  | "danger"
  | "warning"
  | "ghost"
  | "outline"
  | "neutral"
  | "success";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  preventDoubleClick?: boolean;
};

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:pointer-events-none disabled:opacity-50";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-sm shadow-orange-900/10 hover:bg-brand-dark",
  secondary: "bg-slate-800 text-white shadow-sm hover:bg-slate-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  warning: "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
  ghost:
    "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10",
  outline:
    "border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  neutral:
    "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600",
  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
};

export function Button({
  className,
  children,
  variant,
  preventDoubleClick = true,
  onClick,
  ...props
}: ButtonProps) {
  const debounced = usePreventDoubleClick(onClick);
  const safeClick = preventDoubleClick ? debounced : onClick;

  return (
    <button
      className={cn(
        baseClass,
        variant ? variantStyles[variant] : "",
        className
      )}
      onClick={safeClick}
      {...props}
    >
      {children}
    </button>
  );
}
