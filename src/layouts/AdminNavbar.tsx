import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Wrench,
  FileText,
  BarChart3,
  CalendarClock,
  DollarSign,
  History,
  PhoneCall,
  Building2,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { NavDropdown } from "@/components/layout/NavDropdown";
import {
  navLinkBase,
  navLinkActive,
  navLinkInactive,
  navDropdownItem,
} from "@/components/layout/navChrome";

type OpenMenu = "anagrafiche" | "report" | null;

export default function AdminNavbar() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const officeWorkflowEnabled = Boolean(user?.officeWorkflowEnabled);
  const t = theme === "light" ? "light" : "dark";
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  function linkClass({ isActive }: { isActive: boolean }) {
    return `${navLinkBase} ${isActive ? navLinkActive(t) : navLinkInactive(t)}`;
  }

  const closeMenu = () => setOpenMenu(null);

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const anagraficheLinks = (
    <>
      <NavLink
        to="/backoffice/customers"
        className={navDropdownItem}
        onClick={closeMenu}
      >
        <Users size={16} /> Clienti
      </NavLink>
      <NavLink
        to="/backoffice/orders"
        className={navDropdownItem}
        onClick={closeMenu}
      >
        <Package size={16} /> Ordini
      </NavLink>
      <NavLink
        to="/backoffice/montatori"
        className={navDropdownItem}
        onClick={closeMenu}
      >
        <Wrench size={16} /> Montatori
      </NavLink>
      <NavLink
        to="/backoffice/documenti"
        className={navDropdownItem}
        onClick={closeMenu}
      >
        <FileText size={16} /> Documenti
      </NavLink>
    </>
  );

  const anagraficheMobileLinks = (
    <>
      <NavLink to="/backoffice/customers" className={linkClass} onClick={closeMenu}>
        <Users size={16} /> Clienti
      </NavLink>
      <NavLink to="/backoffice/orders" className={linkClass} onClick={closeMenu}>
        <Package size={16} /> Ordini
      </NavLink>
      <NavLink to="/backoffice/montatori" className={linkClass} onClick={closeMenu}>
        <Wrench size={16} /> Montatori
      </NavLink>
      <NavLink to="/backoffice/documenti" className={linkClass} onClick={closeMenu}>
        <FileText size={16} /> Documenti
      </NavLink>
    </>
  );

  const reportLinks = (
    <>
      <NavLink
        to="/backoffice/economic-dashboard"
        className={navDropdownItem}
        onClick={closeMenu}
      >
        <DollarSign size={16} /> Economia
      </NavLink>
      <NavLink
        to="/backoffice/report"
        className={navDropdownItem}
        onClick={closeMenu}
      >
        <BarChart3 size={16} /> Report cantieri
      </NavLink>
      <NavLink
        to="/backoffice/activity-log"
        className={navDropdownItem}
        onClick={closeMenu}
      >
        <History size={16} /> Registro attività
      </NavLink>
    </>
  );

  const reportMobileLinks = (
    <>
      <NavLink
        to="/backoffice/economic-dashboard"
        className={linkClass}
        onClick={closeMenu}
      >
        <DollarSign size={16} /> Economia
      </NavLink>
      <NavLink to="/backoffice/report" className={linkClass} onClick={closeMenu}>
        <BarChart3 size={16} /> Report cantieri
      </NavLink>
      <NavLink
        to="/backoffice/activity-log"
        className={linkClass}
        onClick={closeMenu}
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

      <NavDropdown
        label="Anagrafiche"
        icon={Users}
        theme={t}
        open={openMenu === "anagrafiche"}
        onToggle={() => toggleMenu("anagrafiche")}
        onClose={closeMenu}
        mobileChildren={anagraficheMobileLinks}
      >
        {anagraficheLinks}
      </NavDropdown>

      {officeWorkflowEnabled && (
        <NavLink to="/backoffice/office" className={linkClass}>
          <Building2 size={16} /> Ufficio
        </NavLink>
      )}

      <NavLink to="/backoffice/assistenza" className={linkClass}>
        <PhoneCall size={16} /> Assistenza
      </NavLink>

      <NavDropdown
        label="Analisi"
        icon={BarChart3}
        theme={t}
        open={openMenu === "report"}
        onToggle={() => toggleMenu("report")}
        onClose={closeMenu}
        mobileChildren={reportMobileLinks}
      >
        {reportLinks}
      </NavDropdown>
    </>
  );
}
