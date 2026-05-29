import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  CalendarClock,
  ChevronDown,
  PhoneCall,
  ShieldCheck,
  History,
  Database,
  Smartphone,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  navLinkBase,
  navLinkActive,
  navLinkInactive,
  navDropdownPanel,
  navDropdownItem,
} from "@/components/layout/navChrome";

export default function BackofficeNavbar() {
  const { theme } = useTheme();
  const t = theme === "light" ? "light" : "dark";
  const { user } = useAuth();
  const [openDesktop, setOpenDesktop] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function linkClass({ isActive }: { isActive: boolean }) {
    return `${navLinkBase} ${isActive ? navLinkActive(t) : navLinkInactive(t)}`;
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpenDesktop(false);
    }
    if (openDesktop) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openDesktop]);

  return (
    <>
      {user?.isPlatformAdmin ? (
        <>
          <NavLink to="/backoffice/super-admin" className={linkClass}>
            <ShieldCheck size={16} /> Super Admin
          </NavLink>
          <NavLink to="/backoffice/activity-log" className={linkClass}>
            <History size={16} /> Registro attività
          </NavLink>
          <NavLink to="/backoffice/backups" className={linkClass}>
            <Database size={16} /> Backup
          </NavLink>
          <NavLink to="/backoffice/app-version" className={linkClass}>
            <Smartphone size={16} /> Aggiornamento app
          </NavLink>
        </>
      ) : (
        <>
          <NavLink to="/backoffice/agenda" className={linkClass}>
            <CalendarClock size={16} /> Agenda
          </NavLink>

          <NavLink to="/backoffice/home" className={linkClass}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>

          <NavLink to="/backoffice/assistenza" className={linkClass}>
            <PhoneCall size={16} /> Assistenza
          </NavLink>

          <div className="relative">
            <button
              type="button"
              className={`${navLinkBase} ${
                openDesktop || openMobile ? navLinkActive(t) : navLinkInactive(t)
              } w-full md:w-auto`}
              onClick={() =>
                window.innerWidth >= 768
                  ? setOpenDesktop((v) => !v)
                  : setOpenMobile((v) => !v)
              }
            >
              <Package size={16} /> Anagrafiche
              <ChevronDown
                size={16}
                className={`ml-auto transition-transform md:ml-0 ${
                  openDesktop || openMobile ? "rotate-180" : ""
                }`}
              />
            </button>

            {openDesktop && (
              <div ref={ref} className={navDropdownPanel(t)}>
                <div className="py-1">
                  <NavLink
                    to="/backoffice/customers"
                    className={navDropdownItem}
                    onClick={() => setOpenDesktop(false)}
                  >
                    <Users size={16} /> Clienti
                  </NavLink>
                  <NavLink
                    to="/backoffice/orders"
                    className={navDropdownItem}
                    onClick={() => setOpenDesktop(false)}
                  >
                    <Package size={16} /> Ordini
                  </NavLink>
                  <NavLink
                    to="/backoffice/documenti"
                    className={navDropdownItem}
                    onClick={() => setOpenDesktop(false)}
                  >
                    <FileText size={16} /> Documenti
                  </NavLink>
                </div>
              </div>
            )}

            {openMobile && (
              <div className="ml-4 mt-1 flex flex-col gap-1 md:hidden">
                <NavLink to="/backoffice/customers" className={linkClass}>
                  <Users size={16} /> Clienti
                </NavLink>
                <NavLink to="/backoffice/orders" className={linkClass}>
                  <Package size={16} /> Ordini
                </NavLink>
                <NavLink to="/backoffice/documenti" className={linkClass}>
                  <FileText size={16} /> Documenti
                </NavLink>
              </div>
            )}
          </div>

          {user?.role === "admin" && (
            <NavLink to="/backoffice/super-admin" className={linkClass}>
              <ShieldCheck size={16} /> Super Admin
            </NavLink>
          )}
        </>
      )}
    </>
  );
}
