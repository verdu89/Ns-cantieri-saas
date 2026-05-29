import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  decidePushOnboardingState,
  getPushDiagnostics,
  isPushNotificationsAvailable,
  PUSH_CHANNEL_ID,
  setupPushNotifications,
  syncPushReachabilityWithServer,
  syncStoredPushTokenToServer,
  tryAutoCompletePushRegistration,
  type PushDiagnostics,
} from "@/lib/pushNotificationsSetup";
import { watchAppResume } from "@/lib/appResume";
import {
  openAppNotificationChannelSettings,
  openAppNotificationSystemSettings,
} from "@/lib/openAppNotificationSettings";
import type { User } from "@/types";

/** Tipo di blocco che spiega "perché" mostriamo il guide all'utente. */
type GuideBlock = "system-off" | "channel-off" | "permission-denied";

function deriveGuideBlock(diag: PushDiagnostics): GuideBlock {
  if (diag.systemNotificationsEnabled === false) return "system-off";
  if (diag.jobsChannelEnabled === false) return "channel-off";
  return "permission-denied";
}

/**
 * Flusso "stile app normali":
 * - Se permesso ancora richiedibile (prompt) → chiamiamo direttamente il dialog Android
 *   senza un pre-prompt intermedio. L'utente vede subito "Consenti / Non consentire".
 * - Se permesso negato o interruttore notifiche spento → mostriamo il modal di guida
 *   con "Apri impostazioni": dopo il ritorno in app completiamo da soli quando possibile.
 * - In ogni caso, anche se l'utente ignora il modal, al resume riallineiamo il server
 *   (rimuoviamo il token se l'utente ha spento le notifiche fuori dall'app).
 */
export function PushOnboardingModal({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);
  const [block, setBlock] = useState<GuideBlock>("permission-denied");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Snooze in memoria del guide: reset al resume o riavvio processo. */
  const guideDismissedThisRunRef = useRef(false);
  /** Auto-request dialog Android: una volta sola per sessione. */
  const autoRequestAttemptedRef = useRef(false);

  const onOpenJob = useCallback(
    (jobId: string) => navigate(`/jobs/${jobId}`),
    [navigate]
  );

  const evaluate = useCallback(async () => {
    if (!user || user.isPlatformAdmin) {
      setShowGuide(false);
      return;
    }
    if (!isPushNotificationsAvailable()) {
      setShowGuide(false);
      return;
    }

    try {
      let diag = await getPushDiagnostics();

      /** Token presente ma non sincronizzato → primo tentativo di sync. */
      if (
        diag.permissionReceive === "granted" &&
        diag.storedToken &&
        !diag.serverTokenSynced
      ) {
        await syncStoredPushTokenToServer(diag.storedToken);
        diag = await getPushDiagnostics();
      }

      /** SEMPRE — anche se l'utente ha dismissato il guide o non lo vede mai:
       * notifiche spente da Android → dereg token sul server. Admin vedrà "no push". */
      diag = await syncPushReachabilityWithServer(diag);

      /** Token e permesso ok ma server da reallineare → re-register silenzioso. */
      diag = await tryAutoCompletePushRegistration(diag, onOpenJob);

      const decision = decidePushOnboardingState(diag);

      if (decision === "hidden") {
        setShowGuide(false);
        return;
      }

      if (decision === "enable" && !autoRequestAttemptedRef.current) {
        /** Niente pre-prompt: parte direttamente il dialog Android di sistema.
         * Lo facciamo una volta sola per sessione per evitare cicli se Android
         * decide di non mostrarlo più. */
        autoRequestAttemptedRef.current = true;
        const result = await setupPushNotifications({ onOpenJob });
        if (result.ok) {
          setShowGuide(false);
          return;
        }
        if (result.reason === "denied") {
          /** Android ha rifiutato il dialog (o l'utente ha negato): mostra il guide. */
          setBlock(deriveGuideBlock(await getPushDiagnostics()));
          setShowGuide(!guideDismissedThisRunRef.current);
          return;
        }
        /** Errori tecnici (token FCM non ricevuto, ecc.): mostra guide con messaggio. */
        setError(result.message ?? "Impossibile attivare le notifiche.");
        setBlock(deriveGuideBlock(await getPushDiagnostics()));
        setShowGuide(!guideDismissedThisRunRef.current);
        return;
      }

      if (decision === "guide" && !guideDismissedThisRunRef.current) {
        setBlock(deriveGuideBlock(diag));
        setShowGuide(true);
      } else {
        setShowGuide(false);
      }
    } catch {
      setShowGuide(false);
    }
  }, [user, onOpenJob]);

  useEffect(() => {
    let cancelled = false;
    void evaluate();
    /** Seconda valutazione di sicurezza per device con WebView lenta a inizializzare. */
    const t = window.setTimeout(() => {
      if (cancelled) return;
      void evaluate();
    }, 800);
    const unwatch = watchAppResume(() => {
      /** Al resume reset dello snooze + retry auto-request: Android potrebbe aver
       * cambiato lo stato delle notifiche mentre l'app era in background. */
      guideDismissedThisRunRef.current = false;
      autoRequestAttemptedRef.current = false;
      window.setTimeout(() => {
        void evaluate();
      }, 300);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      unwatch();
    };
  }, [evaluate]);

  if (!showGuide) return null;

  function handleLater() {
    guideDismissedThisRunRef.current = true;
    setShowGuide(false);
  }

  async function handleOpenSystemSettings() {
    setBusy(true);
    setError(null);
    try {
      if (block === "channel-off") {
        /** Va dritto sulla pagina del canale "Lavori e aggiornamenti": un solo tap. */
        await openAppNotificationChannelSettings(PUSH_CHANNEL_ID);
      } else {
        await openAppNotificationSystemSettings();
      }
      /** L'utente esce dall'app; al rientro `watchAppResume` rieseguirà `evaluate`. */
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossibile aprire le impostazioni del telefono."
      );
    } finally {
      setBusy(false);
    }
  }

  const copy = (() => {
    switch (block) {
      case "channel-off":
        return {
          title: "Riattiva «Lavori e aggiornamenti»",
          intro:
            "Hai disattivato il canale «Lavori e aggiornamenti» nelle impostazioni del telefono. Le notifiche dei cantieri non arrivano finché resta spento.",
          instructions: (
            <>
              Tocca <strong>Apri impostazioni canale</strong>, attiva
              l&apos;interruttore <strong>Lavori e aggiornamenti</strong> e torna
              nell&apos;app.
            </>
          ),
          buttonLabel: "Apri impostazioni canale",
        };
      case "system-off":
        return {
          title: "Riattiva le notifiche",
          intro:
            "Le notifiche di NS Cantieri sono disattivate. Riattivale per ricevere gli aggiornamenti sui tuoi cantieri.",
          instructions: (
            <>
              Tocca <strong>Apri impostazioni</strong>, attiva
              l&apos;interruttore <strong>Notifiche</strong> e torna nell&apos;app.
            </>
          ),
          buttonLabel: "Apri impostazioni",
        };
      case "permission-denied":
      default:
        return {
          title: "Attiva le notifiche",
          intro:
            "Per ricevere gli aggiornamenti sui cantieri serve concedere il permesso notifiche dalle impostazioni del telefono.",
          instructions: (
            <>
              Tocca <strong>Apri impostazioni</strong>, attiva
              l&apos;interruttore <strong>Notifiche</strong> e torna nell&apos;app.
            </>
          ),
          buttonLabel: "Apri impostazioni",
        };
    }
  })();

  const overlay = (
    <div
      className="fixed inset-0 z-[12000] flex items-end justify-center bg-slate-900/55 px-4 pb-4 pt-10 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-onboarding-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="relative bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 px-5 py-6 text-white">
          <button
            type="button"
            onClick={handleLater}
            aria-label="Chiudi"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/90 ring-1 ring-white/20 transition hover:bg-white/25"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <SettingsIcon className="h-6 w-6" aria-hidden />
          </span>
          <h2
            id="push-onboarding-title"
            className="mt-4 text-xl font-semibold leading-tight"
          >
            {copy.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-orange-50/95">
            {copy.intro}
          </p>
        </div>

        <div className="space-y-2 px-5 py-5 text-sm text-slate-600">
          <p>{copy.instructions}</p>
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleLater}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            Più tardi
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleOpenSystemSettings()}
            disabled={busy}
            className="w-full gap-2 sm:w-auto"
          >
            <SettingsIcon className="h-4 w-4" aria-hidden />
            {busy ? "Apertura…" : copy.buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
