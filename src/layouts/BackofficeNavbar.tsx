import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  CalendarClock,
  PhoneCall,
  ShieldCheck,
  History,
  Database,
  Smartphone,
  Building2,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { NavDropdown } from "@/components/layout/NavDropdown";
import {
  navLinkBase,
  navLinkActive,
  navLinkInactive,
  navDropdownItem,
} from "@/components/layout/navChrome";

export default function BackofficeNavbar() {
  const { theme } = useTheme();
  const t = theme === "light" ? "light" : "dark";
  const { user } = useAuth();
  const officeWorkflowEnabled = Boolean(user?.officeWorkflowEnabled);
  const [anagraficheOpen, setAnagraficheOpen] = useState(false);

  function linkClass({ isActive }: { isActive: boolean }) {
    return `${navLinkBase} ${isActive ? navLinkActive(t) : navLinkInactive(t)}`;
  }

  const closeAnagrafiche = () => setAnagraficheOpen(false);

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

          <NavDropdown
            label="Anagrafiche"
            icon={Users}
            theme={t}
            open={anagraficheOpen}
            onToggle={() => setAnagraficheOpen((v) => !v)}
            onClose={closeAnagrafiche}
            mobileChildren={
              <>
                <NavLink
                  to="/backoffice/customers"
                  className={linkClass}
                  onClick={closeAnagrafiche}
                >
                  <Users size={16} /> Clienti
                </NavLink>
                <NavLink
                  to="/backoffice/orders"
                  className={linkClass}
                  onClick={closeAnagrafiche}
                >
                  <Package size={16} /> Ordini
                </NavLink>
                <NavLink
                  to="/backoffice/documenti"
                  className={linkClass}
                  onClick={closeAnagrafiche}
                >
                  <FileText size={16} /> Documenti
                </NavLink>
              </>
            }
          >
            <NavLink
              to="/backoffice/customers"
              className={navDropdownItem}
              onClick={closeAnagrafiche}
            >
              <Users size={16} /> Clienti
            </NavLink>
            <NavLink
              to="/backoffice/orders"
              className={navDropdownItem}
              onClick={closeAnagrafiche}
            >
              <Package size={16} /> Ordini
            </NavLink>
            <NavLink
              to="/backoffice/documenti"
              className={navDropdownItem}
              onClick={closeAnagrafiche}
            >
              <FileText size={16} /> Documenti
            </NavLink>
          </NavDropdown>

          {officeWorkflowEnabled && (
            <NavLink to="/backoffice/office" className={linkClass}>
              <Building2 size={16} /> Ufficio
            </NavLink>
          )}

          <NavLink to="/backoffice/assistenza" className={linkClass}>
            <PhoneCall size={16} /> Assistenza
          </NavLink>
        </>
      )}
    </>
  );
}
