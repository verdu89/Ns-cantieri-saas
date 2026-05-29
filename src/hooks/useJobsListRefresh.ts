import { useEffect } from "react";
import { JOBS_UPDATED_EVENT } from "@/lib/appEvents";
import { watchAppResume } from "@/lib/appResume";
import { watchNetworkStatus } from "@/utils/networkStatus";

type Options = {
  /** Polling leggero mentre la schermata è aperta (ms). 0 = disabilitato. */
  intervalMs?: number;
  enabled?: boolean;
};

/**
 * Aggiorna le liste lavori quando: checkout/modifica, app in foreground, rete torna online.
 */
export function useJobsListRefresh(
  onRefresh: () => void,
  options?: Options
): void {
  const enabled = options?.enabled !== false;
  const intervalMs = options?.intervalMs ?? 0;

  useEffect(() => {
    if (!enabled) return;

    const handler = () => onRefresh();

    window.addEventListener(JOBS_UPDATED_EVENT, handler);
    const stopResume = watchAppResume(handler);
    const stopNetwork = watchNetworkStatus(handler);

    const interval =
      intervalMs > 0 ? window.setInterval(handler, intervalMs) : undefined;

    return () => {
      window.removeEventListener(JOBS_UPDATED_EVENT, handler);
      stopResume();
      stopNetwork();
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [enabled, intervalMs, onRefresh]);
}
