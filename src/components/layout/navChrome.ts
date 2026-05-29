/** Stili condivisi sidebar / drawer (allineati a PageChrome + brand). */

export const navLinkBase =
  "rounded-xl px-3 py-2 text-sm font-medium transition inline-flex items-center gap-2";

export function navLinkInactive(theme: "light" | "dark"): string {
  return theme === "light"
    ? "text-slate-700 hover:bg-slate-100 hover:text-brand"
    : "text-gray-300 hover:bg-white/10 hover:text-orange-200";
}

export function navLinkActive(theme: "light" | "dark"): string {
  return theme === "light"
    ? "bg-brand/10 text-brand ring-1 ring-brand/25 shadow-sm"
    : "bg-orange-500/20 text-orange-200 ring-1 ring-orange-400/30";
}

export function navDropdownPanel(theme: "light" | "dark"): string {
  return [
    "absolute left-0 z-50 mt-2 hidden w-56 rounded-xl py-1 shadow-lg ring-1 ring-slate-900/5 md:block",
    theme === "light"
      ? "border border-slate-200/90 bg-white text-slate-800"
      : "border border-gray-700 bg-gray-900 text-gray-100",
  ].join(" ");
}

export const navDropdownItem =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-brand dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-orange-200";

/** Stack verticale voci nella sidebar (desktop + drawer). */
export const navSidebarStackClass = "flex flex-col gap-2";

/**
 * Pannello sidebar / drawer mobile che contiene navbar + user menu.
 * Stesso linguaggio visivo di PageChrome (slate, ring, blur).
 */
export function navSidebarPanelClass(theme: "light" | "dark"): string {
  return [
    "relative flex flex-col justify-between border-r p-4 shadow-xl backdrop-blur-2xl",
    theme === "light"
      ? "border-slate-200/90 bg-white/95 text-slate-900 shadow-sm ring-1 ring-slate-900/5"
      : "border-gray-700 bg-gray-800 text-gray-100",
  ].join(" ");
}

/** Topbar sopra il contenuto (logo / hamburger), coerente con la sidebar. */
export function navTopbarClass(theme: "light" | "dark"): string {
  return [
    "flex items-center border-b px-4 py-3 text-slate-900 shadow-md backdrop-blur-2xl sm:px-6 dark:text-gray-100",
    theme === "light"
      ? "border-slate-200/80 bg-white/90 shadow-sm"
      : "border-gray-700 bg-gray-800",
  ].join(" ");
}

/** Separatore sopra il blocco UserMenu in sidebar. */
export function navSidebarFooterSepClass(theme: "light" | "dark"): string {
  return theme === "light"
    ? "mt-4 border-t border-slate-200/80 pt-4"
    : "mt-4 border-t border-gray-700 pt-4";
}

/** Pannello dropdown menu utente (allineato a navDropdownPanel, fixed width). */
export function navUserMenuPanelClass(theme: "light" | "dark"): string {
  return [
    "absolute right-0 z-[200] hidden w-56 rounded-xl py-1 shadow-lg ring-1 ring-slate-900/5 md:block",
    theme === "light"
      ? "border border-slate-200/90 bg-white text-slate-800"
      : "border border-gray-700 bg-gray-900 text-gray-100",
  ].join(" ");
}

export function navUserMenuItemClass(theme: "light" | "dark"): string {
  return [
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
    theme === "light"
      ? "text-slate-700 hover:bg-slate-50 hover:text-brand"
      : "text-gray-200 hover:bg-gray-800 hover:text-orange-200",
  ].join(" ");
}
