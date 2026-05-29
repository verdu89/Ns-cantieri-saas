import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import {
  navUserMenuItemClass,
  navUserMenuPanelClass,
} from "@/components/layout/navChrome";

type UserMenuProps = {
  dropUp?: boolean; // 👈 se true apre verso l'alto
};

export default function UserMenu({ dropUp = false }: UserMenuProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [openDesktop, setOpenDesktop] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpenDesktop(false);
      }
    }
    if (openDesktop) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openDesktop]);

  const t = theme === "light" ? "light" : "dark";
  const itemCls = navUserMenuItemClass(t);

  const getSettingsPath = () =>
    user?.role === "worker" ? "/settings" : "/backoffice/settings";
  const showSettings = true;
  const showPushNotifications =
    user?.role === "admin" && !user?.isPlatformAdmin;

  return (
    <div className="relative w-full" ref={ref}>
      {/* Bottone utente */}
      <button
        type="button"
        onClick={() =>
          window.innerWidth >= 768
            ? setOpenDesktop((v) => !v)
            : setOpenMobile((v) => !v)
        }
        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-slate-100 dark:hover:bg-gray-700"
      >
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold
            ${
              theme === "light"
                ? "bg-brand/15 text-brand ring-1 ring-brand/20"
                : "bg-gray-600 text-gray-100"
            }`}
        >
          {initials}
        </div>
        <span className="hidden text-sm text-slate-800 sm:inline dark:text-gray-100">
          {user?.name ?? "Utente"}
        </span>
        <ChevronDown
          size={16}
          className={`ml-auto md:ml-0 transition-transform ${
            openDesktop || openMobile ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown desktop */}
      {openDesktop && (
        <div
          className={`${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          } ${navUserMenuPanelClass(t)}`}
        >
          <div className="border-b border-slate-200 px-3 py-2 dark:border-gray-700">
            <div className="text-sm font-semibold text-slate-900 dark:text-gray-100">
              {user?.name}
            </div>
            <div className="text-xs text-slate-500 dark:text-gray-400">
              {user?.email}
            </div>
            <div
              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px]
                ${
                  theme === "light"
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-gray-600 bg-gray-700 text-gray-300"
                }`}
            >
              {user?.role}
            </div>
          </div>
          <div className="py-1">
            {showSettings && (
              <button
                className={itemCls}
                onClick={() => {
                  setOpenDesktop(false);
                  navigate(getSettingsPath());
                }}
              >
                <Settings size={16} /> Impostazioni
              </button>
            )}
            {showPushNotifications && (
              <button
                className={itemCls}
                onClick={() => {
                  setOpenDesktop(false);
                  navigate("/backoffice/push-notifications");
                }}
              >
                <Bell size={16} /> Notifiche push
              </button>
            )}
            <button
              className={itemCls}
              onClick={async () => {
                setOpenDesktop(false);
                await logout();
                navigate("/login");
              }}
            >
              <LogOut size={16} /> Esci
            </button>
          </div>
        </div>
      )}

      {/* Accordion mobile */}
      {openMobile && (
        <div className="mt-1 ml-4 flex flex-col gap-1 md:hidden">
          {showSettings && (
            <button
              className={itemCls}
              onClick={() => {
                setOpenMobile(false);
                navigate(getSettingsPath());
              }}
            >
              <Settings size={16} /> Impostazioni
            </button>
          )}
          {showPushNotifications && (
            <button
              className={itemCls}
              onClick={() => {
                setOpenMobile(false);
                navigate("/backoffice/push-notifications");
              }}
            >
              <Bell size={16} /> Notifiche push
            </button>
          )}
          <button
            className={itemCls}
            onClick={async () => {
              setOpenMobile(false);
              await logout();
              navigate("/login");
            }}
          >
            <LogOut size={16} /> Esci
          </button>
        </div>
      )}
    </div>
  );
}
