import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Wrench,
  FileText,
  BarChart3,
  CalendarClock,
  ChevronDown,
  DollarSign,
  History,
  PhoneCall,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import {
  navLinkBase,
  navLinkActive,
  navLinkInactive,
  navDropdownPanel,
  navDropdownItem,
} from "@/components/layout/navChrome";

export default function AdminNavbar() {
  const { theme } = useTheme();
  const t = theme === "light" ? "light" : "dark";
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

  const gestioneDropdown = (
    <>
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
        to="/backoffice/montatori"
        className={navDropdownItem}
        onClick={() => setOpenDesktop(false)}
      >
        <Wrench size={16} /> Montatori
      </NavLink>
      <NavLink
        to="/backoffice/documenti"
        className={navDropdownItem}
        onClick={() => setOpenDesktop(false)}
      >
        <FileText size={16} /> Documenti
      </NavLink>
      <div
        className="my-1 border-t border-slate-200/80 dark:border-gray-600"
        role="separator"
      />
      <NavLink
        to="/backoffice/economic-dashboard"
        className={navDropdownItem}
        onClick={() => setOpenDesktop(false)}
      >
        <DollarSign size={16} /> Gestione economica
      </NavLink>
      <NavLink
        to="/backoffice/report"
        className={navDropdownItem}
        onClick={() => setOpenDesktop(false)}
      >
        <BarChart3 size={16} /> Report
      </NavLink>
      <NavLink
        to="/backoffice/activity-log"
        className={navDropdownItem}
        onClick={() => setOpenDesktop(false)}
      >
        <History size={16} /> Registro attività
      </NavLink>
    </>
  );

  return (
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
            <div className="py-1">{gestioneDropdown}</div>
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
            <NavLink to="/backoffice/montatori" className={linkClass}>
              <Wrench size={16} /> Montatori
            </NavLink>
            <NavLink to="/backoffice/documenti" className={linkClass}>
              <FileText size={16} /> Documenti
            </NavLink>
            <div
              className="my-1 border-t border-slate-200/80 dark:border-gray-600"
              role="separator"
            />
            <NavLink to="/backoffice/economic-dashboard" className={linkClass}>
              <DollarSign size={16} /> Gestione economica
            </NavLink>
            <NavLink to="/backoffice/report" className={linkClass}>
              <BarChart3 size={16} /> Report
            </NavLink>
            <NavLink to="/backoffice/activity-log" className={linkClass}>
              <History size={16} /> Registro attività
            </NavLink>
          </div>
        )}
      </div>
    </>
  );
}
