import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/** Invoca callback quando l'app torna in primo piano (sessioni lunghe senza logout). */
export function watchAppResume(onResume: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let removed = false;
  let capListener: { remove: () => void } | undefined;

  const onVisible = () => {
    if (document.visibilityState === "visible") onResume();
  };

  document.addEventListener("visibilitychange", onVisible);

  if (Capacitor.isNativePlatform()) {
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) onResume();
    }).then((handle) => {
      if (removed) handle.remove();
      else capListener = handle;
    });
  }

  return () => {
    removed = true;
    document.removeEventListener("visibilitychange", onVisible);
    capListener?.remove();
  };
}
