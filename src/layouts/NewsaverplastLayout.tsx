import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Menu, X, ArrowLeft } from "lucide-react";
import { cn } from "@/components/ui/cn";
import AdminNavbar from "./AdminNavbar";
import BackofficeNavbar from "./BackofficeNavbar";
import WorkerNavbar from "./WorkerNavbar";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  navSidebarFooterSepClass,
  navSidebarPanelClass,
  navSidebarStackClass,
  navTopbarClass,
} from "@/components/layout/navChrome";
import logo from "@/assets/logo.png";

export default function NewsaverplastLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();
  const navTheme = theme === "light" ? "light" : "dark";

  const navigate = useNavigate();
  const location = useLocation();

  // Chiude automaticamente il drawer al cambio pagina
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Blocca scroll pagina quando il drawer mobile è aperto
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Rotte per cui mostrare il pulsante indietro
  const backPaths = ["/customers/", "/orders/", "/jobs/"];
  const showBack = backPaths.some((path) => location.pathname.includes(path));

  const NavbarComponent =
    user?.role === "worker"
      ? WorkerNavbar
      : user?.role === "admin" && !user?.isPlatformAdmin
      ? AdminNavbar
      : BackofficeNavbar;

  const isNative = Capacitor.isNativePlatform();

  return (
    <div
      className={cn(
        "flex w-full min-h-0 flex-col overflow-hidden",
        isNative ? "h-full max-h-full" : "min-h-screen h-[100dvh]",
        theme === "light"
          ? "bg-gradient-to-br from-slate-100 via-orange-50/60 to-slate-100"
          : "bg-gray-900"
      )}
    >
      {/* Layout principale */}
      <div className="relative z-10 flex h-full min-h-0 w-full">
        {/* Sidebar desktop */}
        <motion.aside
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className={`hidden md:flex w-64 ${navSidebarPanelClass(navTheme)}`}
        >
          {/* Navbar in alto */}
          <div className={navSidebarStackClass}>
            <NavbarComponent />
          </div>

          {/* User menu in basso */}
          <div className={`${navSidebarFooterSepClass(navTheme)} relative`}>
            <UserMenu dropUp />
          </div>
        </motion.aside>

        {/* Sidebar mobile (drawer) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Drawer ancorato a sinistra */}
            <motion.aside
              initial={{ x: -250 }}
              animate={{ x: 0 }}
              exit={{ x: -250 }}
              className={`flex h-full min-h-0 w-80 ${navSidebarPanelClass(navTheme)}`}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <button
                  type="button"
                  className="mb-4 flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => setMobileOpen(false)}
                >
                  <X size={20} /> Chiudi
                </button>
                <div className={navSidebarStackClass}>
                  <NavbarComponent />
                </div>
              </div>

              <div className={`${navSidebarFooterSepClass(navTheme)} relative shrink-0`}>
                <UserMenu expandUp />
              </div>
            </motion.aside>

            {/* Overlay a destra che copre il resto */}
            <div
              className="flex-1 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
          </div>
        )}

        {/* Area contenuto */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Topbar */}
          <header
            className={cn(
              navTopbarClass(navTheme),
              "z-30 min-h-0 shrink-0 gap-2 pb-2 md:pb-3"
            )}
          >
            <button
              type="button"
              className="shrink-0 rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <motion.div className="ml-1 flex min-w-0 flex-1 items-center md:ml-2">
              <img
                src={logo}
                alt="Logo Ns-cantieri"
                className="h-11 w-auto max-w-[140px] object-contain sm:h-12 sm:max-w-[160px] md:h-[4.75rem] md:max-w-[235px] lg:h-[5.25rem] lg:max-w-[275px]"
              />
            </motion.div>
          </header>

          {/* Main — unico contenitore scrollabile */}
          <main
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain",
              "[-webkit-overflow-scrolling:touch]",
              "px-2 py-2 sm:px-4 sm:py-4 md:px-6 md:py-6",
              "pb-[max(1.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]"
            )}
          >
            {/* Pulsante indietro (solo in sottopagine) */}
            {showBack && (
              <div className="mb-4">
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <ArrowLeft
                    size={18}
                    className="text-gray-800 dark:text-gray-200"
                  />
                  <span>Indietro</span>
                </button>
              </div>
            )}

            <div
              className={cn(
                "page-content min-w-0 rounded-2xl border shadow-sm ring-1 ring-slate-900/5",
                isNative ? "p-2 sm:p-3 md:p-4" : "p-3 sm:p-4 md:p-6",
                theme === "light"
                  ? "border-slate-200/90 bg-white/95"
                  : "bg-gray-800 border-gray-700"
              )}
            >
              <Outlet />
            </div>

            <footer
              className={cn(
                "shrink-0 rounded-xl border px-4 py-3 text-center text-xs",
                isNative ? "mt-3" : "mt-6",
                theme === "light"
                  ? "border-slate-200/80 bg-white/90 text-slate-500"
                  : "border-gray-700 bg-gray-800 text-gray-400"
              )}
            >
              © {new Date().getFullYear()} Ns-cantieri. Tutti i diritti
              riservati.
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
