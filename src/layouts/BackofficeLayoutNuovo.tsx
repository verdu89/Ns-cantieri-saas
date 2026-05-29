import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import BackofficeNavbar from "./BackofficeNavbar";
import UserMenu from "@/components/UserMenu";
import {
  navSidebarPanelClass,
  navSidebarStackClass,
} from "@/components/layout/navChrome";

export default function BackofficeLayout() {
  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      {/* Sfondo immagine */}
      <motion.img
        src="/cantiere.jpg"
        alt="Backoffice Ns-cantieri"
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{
          duration: 25,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      {/* Overlay leggero (non troppo scuro) */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Layout principale */}
      <div className="relative z-10 flex h-full w-full">
        {/* Sidebar (desktop) */}
        <motion.aside
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className={`hidden w-64 md:flex ${navSidebarPanelClass("light")}`}
        >
          <div className={navSidebarStackClass}>
            <BackofficeNavbar />
          </div>
        </motion.aside>

        {/* Area contenuto */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar */}
          <header
            className="
              flex items-center justify-between 
              bg-white/80 backdrop-blur-2xl border-b border-gray-200
              px-4 sm:px-6 py-3 shadow-md
            "
          >
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-wide">
              Dashboard
            </h1>
            <UserMenu />
          </header>

          {/* Main */}
          <motion.main
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6"
          >
            <div
              className="
                bg-white/90 backdrop-blur-xl rounded-xl 
                border border-gray-200 shadow-lg 
                p-4 sm:p-6
              "
            >
              <Outlet />
            </div>
          </motion.main>
        </div>
      </div>
    </div>
  );
}
