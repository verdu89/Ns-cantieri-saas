import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";

export async function isDeviceOnline(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }
  const status = await Network.getStatus();
  return status.connected;
}

export async function assertOnlineOrThrow(): Promise<void> {
  const online = await isDeviceOnline();
  if (!online) {
    throw new Error(
      "Connessione assente. Verifica Wi‑Fi o dati mobili e riprova."
    );
  }
}

/** Invoca `onOnline` quando la connessione torna disponibile. */
export function watchNetworkStatus(onOnline: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  if (!Capacitor.isNativePlatform()) {
    const handler = () => onOnline();
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }

  let removed = false;
  let listener: { remove: () => void } | undefined;

  void Network.addListener("networkStatusChange", (status) => {
    if (status.connected) onOnline();
  }).then((handle) => {
    if (removed) handle.remove();
    else listener = handle;
  });

  return () => {
    removed = true;
    listener?.remove();
  };
}
