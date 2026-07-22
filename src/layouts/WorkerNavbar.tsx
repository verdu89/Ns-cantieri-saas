import { NavLink } from "react-router-dom";
import { CalendarClock, ClipboardList } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { navLinkBase, navLinkActive, navLinkInactive } from "@/components/layout/navChrome";

export default function WorkerNavbar() {
  const { theme } = useTheme();
  const t = theme === "light" ? "light" : "dark";

  function linkClass({ isActive }: { isActive: boolean }) {
    return `${navLinkBase} ${isActive ? navLinkActive(t) : navLinkInactive(t)}`;
  }

  return (
    <>
      <NavLink to="/agenda" className={linkClass}>
        <CalendarClock size={16} /> Agenda
      </NavLink>
      <NavLink to="/my-jobs" className={linkClass}>
        <ClipboardList size={16} /> I miei lavori
      </NavLink>
    </>
  );
}
