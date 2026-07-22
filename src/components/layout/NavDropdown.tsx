import { useEffect, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  navLinkBase,
  navLinkActive,
  navLinkInactive,
  navDropdownPanel,
} from "@/components/layout/navChrome";

function useCompactNavLayout(): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") return true;
    return Capacitor.isNativePlatform() || window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setCompact(Capacitor.isNativePlatform() || mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return compact;
}

type Theme = "light" | "dark";

type Props = {
  label: string;
  icon: LucideIcon;
  theme: Theme;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
  mobileChildren?: ReactNode;
};

/** Voce navbar con sottomenu (desktop: pannello; mobile: lista indentata). */
export function NavDropdown({
  label,
  icon: Icon,
  theme,
  open,
  onToggle,
  onClose,
  children,
  mobileChildren,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const compact = useCompactNavLayout();
  const t = theme;

  useEffect(() => {
    if (!open || compact) return;

    let removeListener: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      function onPointerDown(e: PointerEvent) {
        if (!containerRef.current?.contains(e.target as Node)) onClose();
      }
      document.addEventListener("pointerdown", onPointerDown);
      removeListener = () => document.removeEventListener("pointerdown", onPointerDown);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      removeListener?.();
    };
  }, [open, onClose, compact]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={`${navLinkBase} ${
          open ? navLinkActive(t) : navLinkInactive(t)
        } w-full touch-manipulation md:w-auto`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <Icon size={16} /> {label}
        <ChevronDown
          size={16}
          className={`ml-auto transition-transform md:ml-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !compact && (
        <div className={navDropdownPanel(t)}>
          <div className="py-1">{children}</div>
        </div>
      )}

      {open && compact && mobileChildren ? (
        <div className="ml-4 mt-1 flex flex-col gap-1">{mobileChildren}</div>
      ) : null}
    </div>
  );
}
