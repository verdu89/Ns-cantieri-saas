import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { pushAPI } from "@/api/pushAPI";
import toast from "react-hot-toast";

const PUSH_SETUP_KEY = "push_setup_done";
const PUSH_DENIED_KEY = "push_denied";
const PUSH_SERVER_SYNC_KEY = "push_token_server_synced";
const PUSH_REACHABILITY_KEY = "push_reachability";

/** ID del canale Android dedicato a job/aggiornamenti. Disabilitabile separatamente dall'utente. */
export const PUSH_CHANNEL_ID = "ns_cantieri_jobs";
export const PUSH_CHANNEL_NAME = "Lavori e aggiornamenti";

/** Evita refresh sessione / prefetch mentre il dialog permessi è aperto. */
let pushPermissionFlowActive = false;

export function isPushPermissionFlowActive(): boolean {
  return pushPermissionFlowActive;
}

/** Solo con `VITE_PUSH_ENABLED=true` e `google-services.json` in android/app. */
export function isPushRegisterEnabled(): boolean {
  const flag = import.meta.env.VITE_PUSH_ENABLED;
  return flag === "true" || flag === "1";
}

export function isPushNotificationsAvailable(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable("PushNotifications") &&
      isPushRegisterEnabled()
    );
  } catch {
    return false;
  }
}

export function resetWorkerPushSetupFlag(): void {
  resetWorkerPushSetupLock();
}

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem("push_token");
  } catch {
    return null;
  }
}

function setStoredToken(token: string): void {
  try {
    localStorage.setItem("push_token", token);
  } catch {
    /* ignore */
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem("push_token");
  } catch {
    /* ignore */
  }
}

function markPushSetupDone(): void {
  try {
    localStorage.setItem(PUSH_SETUP_KEY, "1");
  } catch {
    /* ignore */
  }
}

function markPushDenied(): void {
  try {
    localStorage.setItem(PUSH_DENIED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isPushSetupDone(): boolean {
  try {
    return localStorage.getItem(PUSH_SETUP_KEY) === "1";
  } catch {
    return false;
  }
}

export function isPushDenied(): boolean {
  try {
    return localStorage.getItem(PUSH_DENIED_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPushSetupFlags(): void {
  try {
    localStorage.removeItem(PUSH_SETUP_KEY);
    localStorage.removeItem(PUSH_DENIED_KEY);
    localStorage.removeItem(PUSH_SERVER_SYNC_KEY);
    localStorage.removeItem(PUSH_REACHABILITY_KEY);
    clearStoredToken();
  } catch {
    /* ignore */
  }
}

function getStoredReachability(): "enabled" | "disabled" | null {
  try {
    const v = localStorage.getItem(PUSH_REACHABILITY_KEY);
    return v === "enabled" || v === "disabled" ? v : null;
  } catch {
    return null;
  }
}

function setStoredReachability(value: "enabled" | "disabled"): void {
  try {
    localStorage.setItem(PUSH_REACHABILITY_KEY, value);
  } catch {
    /* ignore */
  }
}

function clearServerTokenSyncedFlag(): void {
  try {
    localStorage.removeItem(PUSH_SERVER_SYNC_KEY);
  } catch {
    /* ignore */
  }
}

function markServerTokenSynced(): void {
  try {
    localStorage.setItem(PUSH_SERVER_SYNC_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isServerTokenSynced(): boolean {
  try {
    return localStorage.getItem(PUSH_SERVER_SYNC_KEY) === "1";
  } catch {
    return false;
  }
}

function pushPlatform(): "android" | "ios" | "web" {
  if (Capacitor.getPlatform() === "ios") return "ios";
  if (Capacitor.getPlatform() === "android") return "android";
  return "web";
}

/** Registra il token FCM sul backend (tabella WorkerPushToken). */
export async function syncStoredPushTokenToServer(
  token?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const value = (token ?? getStoredToken())?.trim();
  if (!value) {
    return { ok: false, message: "Token FCM non ancora disponibile sul dispositivo." };
  }
  if (!localStorage.getItem("auth_token")) {
    return { ok: false, message: "Sessione non valida: rifai il login nell'app." };
  }
  try {
    await pushAPI.register(value, pushPlatform());
    markServerTokenSynced();
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw.includes("401")) {
      return { ok: false, message: "Sessione scaduta: esci e rientra nell'app." };
    }
    if (raw.includes("404") && raw.includes("Worker")) {
      return {
        ok: false,
        message: "Utente non trovato sul server (account non collegato a Worker).",
      };
    }
    return {
      ok: false,
      message: raw.includes("Failed to fetch")
        ? "Server non raggiungibile. Controlla rete e URL API."
        : `Registrazione token fallita: ${raw.slice(0, 120)}`,
    };
  }
}

export type PushDiagnostics = {
  isNative: boolean;
  platform: string;
  pluginAvailable: boolean;
  viteFlagEnabled: boolean;
  setupDoneFlag: boolean;
  deniedFlag: boolean;
  storedToken: string | null;
  serverTokenSynced: boolean;
  permissionReceive:
    | "granted"
    | "denied"
    | "prompt"
    | "prompt-with-rationale"
    | "unknown"
    | "error";
  permissionError?: string;
  /**
   * Stato reale «notifiche per questa app» a livello sistema (Android / iOS).
   * `null` se il plugin @capacitor/local-notifications non è nella build o errore.
   * Su Android il solo PushNotifications spesso resta «granted» anche con l’interruttore spento.
   */
  systemNotificationsEnabled: boolean | null;
  /**
   * Stato del canale Android `ns_cantieri_jobs` (lavori e aggiornamenti).
   * - `true` canale presente e `importance > 0` (notifiche del canale consegnabili).
   * - `false` canale presente ma `importance === 0` → utente ha spento *solo* il canale dalle
   *   impostazioni Android lasciando l’app in generale abilitata. Le push non arriveranno.
   * - `null` non determinabile (iOS, plugin non disponibile, canale ancora non creato).
   */
  jobsChannelEnabled: boolean | null;
};

/**
 * Decisione dichiarativa di cosa mostrare all'utente per le notifiche.
 * - "hidden": niente da chiedere
 * - "enable": permesso ancora richiedibile (prompt → dialog Android)
 * - "guide": permesso già negato → istruzioni manuali per riabilitarlo
 */
export type PushOnboardingState = "hidden" | "enable" | "guide";

export function decidePushOnboardingState(
  diag: PushDiagnostics
): PushOnboardingState {
  if (!diag.isNative) return "hidden";
  if (!diag.pluginAvailable || !diag.viteFlagEnabled) return "hidden";
  if (diag.systemNotificationsEnabled === false) return "guide";
  /** Canale del cantiere spento dall'utente: token valido ma le push del canale non arrivano. */
  if (diag.jobsChannelEnabled === false) return "guide";
  if (
    diag.permissionReceive === "granted" &&
    diag.storedToken &&
    diag.serverTokenSynced
  ) {
    return "hidden";
  }
  if (diag.permissionReceive === "denied") return "guide";
  if (diag.deniedFlag) return "guide";
  return "enable";
}

/** Fotografia delle precondizioni che governano il prompt notifiche. */
export async function getPushDiagnostics(): Promise<PushDiagnostics> {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  let pluginAvailable = false;
  try {
    pluginAvailable = Capacitor.isPluginAvailable("PushNotifications");
  } catch {
    pluginAvailable = false;
  }
  const viteFlagEnabled = isPushRegisterEnabled();
  const setupDoneFlag = isPushSetupDone();
  const deniedFlag = isPushDenied();
  const storedToken = getStoredToken();
  const serverTokenSynced = isServerTokenSynced();

  let permissionReceive: PushDiagnostics["permissionReceive"] = "unknown";
  let permissionError: string | undefined;
  if (isNative && pluginAvailable && viteFlagEnabled) {
    try {
      const status = await PushNotifications.checkPermissions();
      permissionReceive =
        (status.receive as PushDiagnostics["permissionReceive"]) ?? "unknown";
    } catch (e) {
      permissionReceive = "error";
      permissionError = e instanceof Error ? e.message : String(e);
    }
  }

  let systemNotificationsEnabled: boolean | null = null;
  if (isNative) {
    try {
      if (Capacitor.isPluginAvailable("LocalNotifications")) {
        const { value } = await LocalNotifications.areEnabled();
        systemNotificationsEnabled = Boolean(value);
      }
    } catch {
      systemNotificationsEnabled = null;
    }
  }

  const jobsChannelEnabled = await getJobsChannelEnabled({
    isNative,
    platform,
    pluginAvailable,
    viteFlagEnabled,
  });

  return {
    isNative,
    platform,
    pluginAvailable,
    viteFlagEnabled,
    setupDoneFlag,
    deniedFlag,
    storedToken,
    serverTokenSynced,
    permissionReceive,
    permissionError,
    systemNotificationsEnabled,
    jobsChannelEnabled,
  };
}

/**
 * Stato del canale Android `ns_cantieri_jobs`. Su API 26+ Android permette di disabilitare
 * un singolo canale lasciando attive le notifiche generali dell'app: in quel caso le push
 * verso quel canale non vengono consegnate, anche se il toggle app è ON.
 *
 * Implementazione: `listChannels()` ritorna `importance` come int Android raw; quando
 * l'utente disabilita il canale, Android espone `IMPORTANCE_NONE === 0`.
 */
async function getJobsChannelEnabled(ctx: {
  isNative: boolean;
  platform: string;
  pluginAvailable: boolean;
  viteFlagEnabled: boolean;
}): Promise<boolean | null> {
  if (!ctx.isNative || ctx.platform !== "android") return null;
  if (!ctx.pluginAvailable || !ctx.viteFlagEnabled) return null;
  try {
    const { channels } = await PushNotifications.listChannels();
    const ch = channels.find((c) => c.id === PUSH_CHANNEL_ID);
    if (!ch) return null;
    /** Cast esplicito: il type Importance del plugin è 1..5 (input), ma `getImportance()`
     * Android può tornare 0 (NONE) se l'utente disabilita il canale. */
    const importance = (ch.importance as unknown as number) ?? 3;
    return importance > 0;
  } catch {
    return null;
  }
}

/**
 * Riallinea lo stato del token sul server in base a quello che il device reale può ricevere:
 * - se l'utente ha spento le notifiche da Android (o ha negato il permesso) e il token è ancora
 *   registrato sul server, lo deregistra → il pannello admin tenant vedrà "no push";
 * - se invece il device è di nuovo raggiungibile dopo essere stato "disabled", pulisce il flag
 *   di sync così la prossima `tryAutoCompletePushRegistration` farà il re-register.
 *
 * Non si occupa di registrare il token nuovo: lo fa già `setupPushNotifications` /
 * `tryAutoCompletePushRegistration`.
 */
export async function syncPushReachabilityWithServer(
  diag: PushDiagnostics
): Promise<PushDiagnostics> {
  if (!diag.isNative) return diag;
  if (!diag.pluginAvailable || !diag.viteFlagEnabled) return diag;
  if (!localStorage.getItem("auth_token")) return diag;

  const isReachable =
    diag.permissionReceive === "granted" &&
    diag.systemNotificationsEnabled !== false &&
    diag.jobsChannelEnabled !== false;
  const previous = getStoredReachability();
  const token = diag.storedToken?.trim();

  if (!isReachable) {
    if (!token) {
      if (previous !== "disabled") setStoredReachability("disabled");
      return diag;
    }
    /** Notifiche spente da Android (o permesso revocato): rimuoviamo il token dal server.
     * Conserviamo localmente il token: alla riattivazione lo re-registriamo senza nuova richiesta a FCM. */
    if (previous !== "disabled" || diag.serverTokenSynced) {
      try {
        await pushAPI.unregister(token);
      } catch {
        /* riproviamo al prossimo resume */
      }
      clearServerTokenSyncedFlag();
      setStoredReachability("disabled");
      return await getPushDiagnostics();
    }
    return diag;
  }

  /** Device di nuovo raggiungibile. */
  if (previous === "disabled") {
    /** Forza il prossimo `tryAutoCompletePushRegistration` a fare re-register sul server. */
    clearServerTokenSyncedFlag();
  }
  setStoredReachability("enabled");
  return diag;
}

let pushAutoCompleteRegistrationInFlight = false;

/**
 * Dopo aver corretto le notifiche da Impostazioni di sistema: completa registrazione FCM
 * e sync sul server senza un secondo tap, se permesso runtime e interruttore sistema lo consentono.
 */
export async function tryAutoCompletePushRegistration(
  diag: PushDiagnostics,
  onOpenJob: (jobId: string) => void
): Promise<PushDiagnostics> {
  if (!isPushNotificationsAvailable()) return diag;
  if (diag.permissionReceive !== "granted") return diag;
  if (diag.systemNotificationsEnabled === false) return diag;
  if (diag.jobsChannelEnabled === false) return diag;
  if (diag.storedToken && diag.serverTokenSynced) return diag;

  if (pushAutoCompleteRegistrationInFlight) return diag;
  pushAutoCompleteRegistrationInFlight = true;
  try {
    const result = await setupPushNotifications({
      onOpenJob,
      showSuccessToast: false,
    });
    if (result.ok) return await getPushDiagnostics();
    return diag;
  } finally {
    pushAutoCompleteRegistrationInFlight = false;
  }
}

async function waitForStoredFcmToken(timeoutMs = 12000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const t = getStoredToken();
    if (t) return t;
    await new Promise((r) => window.setTimeout(r, 250));
  }
  return getStoredToken();
}

let pushSetupStarted = false;

/** Evita doppio setup (Login + hook), indipendentemente dal ruolo. */
export function tryBeginWorkerPushSetup(): boolean {
  if (pushSetupStarted || isPushSetupDone() || isPushDenied()) {
    return false;
  }
  pushSetupStarted = true;
  return true;
}

export function resetWorkerPushSetupLock(): void {
  pushSetupStarted = false;
}

let nativeListenersAttached = false;
let openJobHandler: ((jobId: string) => void) | undefined;

function attachNativeListenersOnce(): void {
  if (nativeListenersAttached) return;
  nativeListenersAttached = true;

  void PushNotifications.addListener("registration", (token) => {
    const value = token.value?.trim();
    if (!value) return;
    setStoredToken(value);
    markPushSetupDone();
    void syncStoredPushTokenToServer(value).then((r) => {
      if (!r.ok) {
        console.warn("[push] sync server dopo registration:", r.message);
      }
    });
  });

  void PushNotifications.addListener("registrationError", () => {
    resetWorkerPushSetupLock();
    markPushDenied();
    clearStoredToken();
  });

  void PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const title = notification.title ?? "Nuova notifica";
    const body = notification.body ?? "";
    toast(body ? `${title}: ${body}` : title);
  });

  void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as { jobId?: string } | undefined;
    const jobId = data?.jobId;
    if (jobId && openJobHandler) {
      openJobHandler(String(jobId));
    }
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: PUSH_CHANNEL_NAME,
      description: "Notifiche sui cantieri assegnati",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* canale già presente o plugin non disponibile */
  }
}

/** Attende che l'activity sia stabile dopo il dialog permessi (riduce crash WebView/FCM). */
function waitForUiSettled(ms = 900): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Interruttori notifiche a livello sistema:
 * 1. interruttore generale "Notifiche" dell'app (`LocalNotifications.areEnabled`)
 * 2. canale `ns_cantieri_jobs` ("Lavori e aggiornamenti"): se disabilitato dall'utente le push
 *    non vengono consegnate anche con permesso e toggle app concessi.
 */
async function checkSystemNotificationsOrFail(): Promise<
  { ok: false; reason: "denied"; message: string } | null
> {
  try {
    if (Capacitor.isPluginAvailable("LocalNotifications")) {
      const { value } = await LocalNotifications.areEnabled();
      if (!value) {
        return {
          ok: false,
          reason: "denied",
          message:
            "Le notifiche per questa app sono disattivate nelle impostazioni del dispositivo. Apri Impostazioni → App → NS Cantieri → Notifiche e abilitale.",
        };
      }
    }
  } catch {
    /* se non determinabile, non bloccare lo setup */
  }

  /** Su Android verifichiamo anche lo stato del canale dedicato ai cantieri. */
  if (isNativeAndroid()) {
    const channelEnabled = await getJobsChannelEnabled({
      isNative: true,
      platform: "android",
      pluginAvailable: true,
      viteFlagEnabled: true,
    });
    if (channelEnabled === false) {
      return {
        ok: false,
        reason: "denied",
        message:
          "Il canale «Lavori e aggiornamenti» è disattivato nelle impostazioni del telefono. Riattivalo per ricevere le notifiche dei cantieri.",
      };
    }
  }

  return null;
}

export type PushSetupResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" | "error"; message?: string };

export async function setupPushNotifications(options?: {
  onOpenJob?: (jobId: string) => void;
  showSuccessToast?: boolean;
}): Promise<PushSetupResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: "unavailable" };
  }

  if (!isPushRegisterEnabled()) {
    return {
      ok: false,
      reason: "unavailable",
      message: "Push non abilitate in questa build (manca configurazione Firebase).",
    };
  }

  openJobHandler = options?.onOpenJob;
  attachNativeListenersOnce();

  pushPermissionFlowActive = true;
  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== "granted") {
      markPushDenied();
      return { ok: false, reason: "denied" };
    }

    const sysBlock = await checkSystemNotificationsOrFail();
    if (sysBlock) return sysBlock;

    await ensureAndroidChannel();

    const existing = getStoredToken();
    if (existing) {
      markPushSetupDone();
      const synced = await syncStoredPushTokenToServer(existing);
      if (!synced.ok) {
        return { ok: false, reason: "error", message: synced.message };
      }
      if (options?.showSuccessToast) {
        toast.success("Notifiche attivate");
      }
      return { ok: true };
    }

    await waitForUiSettled();

    try {
      await PushNotifications.register();
    } catch (err) {
      resetWorkerPushSetupLock();
      const message = err instanceof Error ? err.message : "Registrazione push non riuscita";
      return { ok: false, reason: "error", message };
    }

    const fcmToken = await waitForStoredFcmToken();
    if (!fcmToken) {
      return {
        ok: false,
        reason: "error",
        message:
          "Permesso concesso ma token FCM non ricevuto. Verifica google-services.json e reinstalla l'APK.",
      };
    }

    const synced = await syncStoredPushTokenToServer(fcmToken);
    if (!synced.ok) {
      return { ok: false, reason: "error", message: synced.message };
    }

    if (options?.showSuccessToast) {
      toast.success("Notifiche attivate");
    }
    return { ok: true };
  } finally {
    window.setTimeout(() => {
      pushPermissionFlowActive = false;
    }, 1500);
  }
}
