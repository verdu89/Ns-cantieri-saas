import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import Footer from "../components/Footer";
import { navSidebarStackClass } from "@/components/layout/navChrome";

type AppLayoutProps = {
  left: ReactNode; // navbar principale (link / dropdown)
  right?: ReactNode; // user menu (avatar, settings, logout)
  children?: ReactNode;
};

export default function AppLayout({ left, right, children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setMobileOpen(false);
    }
    if (mobileOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="relative flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Apri menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            POSA 3000
          </h1>
        </div>

        <nav className="hidden items-center gap-2 md:flex">{left}</nav>

        <div className="hidden md:flex">{right}</div>

        {mobileOpen && (
          <div
            ref={panelRef}
            className="absolute left-0 right-0 top-full z-50 border-b border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-900/5 md:hidden"
          >
            <div className={`px-3 py-3 ${navSidebarStackClass}`}>{left}</div>
            {right ? (
              <>
                <div className="mx-3 border-t border-slate-200" />
                <div className={`px-3 py-3 ${navSidebarStackClass}`}>{right}</div>
              </>
            ) : null}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <Footer />
    </div>
  );
}
