import { Capacitor, registerPlugin } from "@capacitor/core";

interface AppNotificationSettingsPlugin {
  open(): Promise<{ opened: boolean }>;
  openChannel(options: { channelId: string }): Promise<{ opened: boolean }>;
}

const AppNotificationSettings = registerPlugin<AppNotificationSettingsPlugin>(
  "AppNotificationSettings"
);

/**
 * Apre la scheda "Notifiche" dell'app nelle impostazioni del sistema.
 * - Android: plugin nativo custom (Settings.ACTION_APP_NOTIFICATION_SETTINGS).
 * - iOS: schema `app-settings:`.
 * Niente su web.
 */
export async function openAppNotificationSystemSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  if (Capacitor.getPlatform() === "ios") {
    window.location.href = "app-settings:";
    return;
  }

  if (Capacitor.getPlatform() === "android") {
    try {
      await AppNotificationSettings.open();
    } catch (e) {
      console.warn("[push] openAppNotificationSettings failed:", e);
      throw e;
    }
  }
}

/**
 * Apre la pagina del singolo canale Android (es. "Lavori e aggiornamenti"), così l'utente può
 * riattivare un canale specifico senza dover navigare fra le impostazioni.
 * Solo Android (API 26+); sotto API 26 apre la scheda app generale.
 * Su iOS: niente (i canali non esistono).
 */
export async function openAppNotificationChannelSettings(
  channelId: string
): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    return openAppNotificationSystemSettings();
  }
  try {
    await AppNotificationSettings.openChannel({ channelId });
  } catch (e) {
    console.warn("[push] openAppNotificationChannelSettings failed:", e);
    /** Fallback alla scheda app generale. */
    await openAppNotificationSystemSettings();
  }
}
