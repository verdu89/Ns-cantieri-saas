/* Shared layout tokens + PageHeader — eslint react-refresh allows only components per file */
/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** Intestazione pagina allineata allo stile Agenda (toolbar). */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&_a]:min-h-11 [&_button]:min-h-11">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Campo testo / select — text-base su mobile evita zoom iOS (<16px) */
export const inputFieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200/80 sm:text-sm";

/** Alias (stesso stile di inputFieldClass) */
export const modalInputFieldClass = inputFieldClass;

export const selectFieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200/80 sm:text-sm";

/** Contorno tabella / lista */
export const surfaceCardClass =
  "overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5";

/** Fascia filtri / toolbar sotto l’header */
export const filterBarClass =
  "rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4";

/** Griglia filtri: 1 colonna mobile, più colonne da tablet */
export const filterGridClass =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4";

/** Wrapper tabella desktop (scroll orizzontale di fallback) */
export const tableWrapperClass = "table-wrapper hidden md:block";

/** Lista card mobile sotto tabella desktop */
export const mobileCardListClass = "space-y-3 md:hidden";

/**
 * Overlay modale: bottom sheet su mobile, centrato da sm.
 * Il pannello ha max-height e scroll interno.
 */
export const modalBackdropClass =
  "fixed inset-0 z-50 flex flex-col justify-end bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4";

/** Overlay sopra un’altra modale */
export const modalBackdropElevatedClass =
  "fixed inset-0 z-[60] flex flex-col justify-end bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4";

/** Contenitore modale (aggiungere max-w-*, padding extra se serve) */
export const modalPanelClass =
  "w-full max-h-[min(92dvh,100%)] overflow-y-auto overscroll-y-contain rounded-t-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5 sm:max-h-[min(90vh,880px)] sm:rounded-2xl";

/** Azioni in fondo ai modali semplici */
export const modalActionsClass =
  "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:min-h-11 [&_button]:w-full sm:[&_button]:w-auto";

/** Padding safe-area per footer modale sticky */
export const modalSafeFooterClass =
  "pb-[max(0.75rem,env(safe-area-inset-bottom))]";
