import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { ArrowUpCircle, Sparkles } from "lucide-react";
import { useAppUpdateCheck } from "@/hooks/useAppUpdateCheck";

export default function AppUpdateModal() {
  const { state, dismissForSession } = useAppUpdateCheck();
  const [opening, setOpening] = useState(false);

  if (!state.updateAvailable || !state.android) return null;

  const { android, mandatory, installedVersionName } = state;
  const targetName = android.latestVersionName
    ? android.latestVersionName
    : android.latestVersionCode
      ? String(android.latestVersionCode)
      : "";

  async function handleUpdate() {
    if (!state.android) return;
    setOpening(true);
    try {
      await Browser.open({
        url: state.android.playStoreUrl,
        presentationStyle: "popover",
      });
    } catch {
      try {
        window.open(state.android.playStoreUrl, "_blank", "noopener");
      } catch {
        /* ignore */
      }
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="app-update-title"
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-100/90">
                Ns-cantieri
              </p>
              <h2
                id="app-update-title"
                className="text-lg font-semibold leading-tight"
              >
                Aggiornamento disponibile
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm text-slate-700">
          <p className="leading-relaxed">
            È disponibile una nuova versione dell&apos;app
            {targetName ? (
              <>
                {" "}
                (<span className="font-semibold text-slate-900">{targetName}</span>)
              </>
            ) : null}
            . Aggiorna per continuare a usare al meglio Ns-cantieri.
          </p>

          {android.releaseNotes ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Novità di questa versione
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {android.releaseNotes}
              </p>
            </div>
          ) : null}

          {installedVersionName ? (
            <p className="text-xs text-slate-500">
              Versione installata:{" "}
              <span className="font-mono">{installedVersionName}</span>
            </p>
          ) : null}

          {mandatory ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              Questo aggiornamento è necessario per continuare a usare l&apos;app.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          {!mandatory ? (
            <button
              type="button"
              onClick={dismissForSession}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              Continua per ora
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleUpdate()}
            disabled={opening}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 transition hover:from-orange-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowUpCircle className="h-4 w-4" aria-hidden />
            {opening ? "Apertura Play Store…" : "Aggiorna ora"}
          </button>
        </div>
      </div>
    </div>
  );
}
