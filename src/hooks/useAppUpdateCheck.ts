import { useCallback, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  fetchAppVersionInfo,
  type AndroidVersionInfo,
  type AppVersionInfo,
} from "@/api/appVersion";
import { watchAppResume } from "@/lib/appResume";

export type AppUpdateState = {
  /** Quando true, mostrare la modale "Aggiorna ora". */
  updateAvailable: boolean;
  /** Forzare l'aggiornamento: niente "Continua per ora". */
  mandatory: boolean;
  /** versionCode installato sul dispositivo (Android). */
  installedVersionCode: number | null;
  /** versionName installato sul dispositivo (Android), per log/diagnostica. */
  installedVersionName: string | null;
  /** Info versione lette dal backend. */
  android: AndroidVersionInfo | null;
};

const initialState: AppUpdateState = {
  updateAvailable: false,
  mandatory: false,
  installedVersionCode: null,
  installedVersionName: null,
  android: null,
};

async function readInstalledAndroidVersion(): Promise<
  { code: number; name: string } | null
> {
  if (!Capacitor.isNativePlatform()) return null;
  if (Capacitor.getPlatform() !== "android") return null;
  try {
    const info = await App.getInfo();
    const code = Number(info.build);
    if (!Number.isFinite(code)) return null;
    return { code, name: info.version ?? "" };
  } catch {
    return null;
  }
}

function deriveUpdateState(
  installed: { code: number; name: string } | null,
  serverInfo: AppVersionInfo | null
): AppUpdateState {
  if (!installed || !serverInfo) {
    return {
      ...initialState,
      installedVersionCode: installed?.code ?? null,
      installedVersionName: installed?.name ?? null,
      android: serverInfo?.android ?? null,
    };
  }
  const android = serverInfo.android;
  const latest = android.latestVersionCode;
  if (!latest || installed.code >= latest) {
    return {
      ...initialState,
      installedVersionCode: installed.code,
      installedVersionName: installed.name,
      android,
    };
  }
  const minimum = android.minimumVersionCode ?? 0;
  const mandatory = installed.code < minimum;
  return {
    updateAvailable: true,
    mandatory,
    installedVersionCode: installed.code,
    installedVersionName: installed.name,
    android,
  };
}

/**
 * Controlla se è disponibile una nuova versione APK sul Play Store.
 *
 * Comportamento:
 * - check all'avvio e ad ogni resume dell'app (Capacitor `appStateChange`);
 * - se l'utente preme "Continua per ora", la modale resta nascosta per la
 *   versione corrente fino a un riavvio del processo (cold start) o fino
 *   a quando il backend pubblica una versione `latestVersionCode` superiore;
 * - in modalità `mandatory` il dismiss è ignorato.
 *
 * Su browser web non fa nulla.
 */
export function useAppUpdateCheck(): {
  state: AppUpdateState;
  dismissForSession: () => void;
} {
  const [state, setState] = useState<AppUpdateState>(initialState);
  /** `latestVersionCode` per cui l'utente ha premuto "Continua per ora" in questa sessione. */
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);

  const runCheck = useCallback(async () => {
    const installed = await readInstalledAndroidVersion();
    if (!installed) {
      setState((prev) => ({ ...prev, ...initialState }));
      return;
    }
    const serverInfo = await fetchAppVersionInfo();
    setState(deriveUpdateState(installed, serverInfo));
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void runCheck();
    const unwatch = watchAppResume(() => {
      void runCheck();
    });
    return unwatch;
  }, [runCheck]);

  const dismissForSession = useCallback(() => {
    const target = state.android?.latestVersionCode ?? -1;
    setDismissedFor(target);
  }, [state.android?.latestVersionCode]);

  const currentLatest = state.android?.latestVersionCode ?? null;
  const dismissEffective =
    dismissedFor != null &&
    currentLatest != null &&
    dismissedFor === currentLatest;

  if (dismissEffective && !state.mandatory) {
    return {
      state: { ...state, updateAvailable: false },
      dismissForSession,
    };
  }

  return { state, dismissForSession };
}
