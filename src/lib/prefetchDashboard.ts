import { jobAPI } from "@/api/jobs";
import { workerAPI } from "@/api/workers";
import type { User } from "@/types";

/** Precarica dati agenda/home subito dopo login per aprirle più veloci. */
export function prefetchDashboardData(user: User): void {
  if (user.role === "worker" && user.workerId) {
    void jobAPI.listAssigned(String(user.workerId), { cache: true });
    return;
  }
  if (!user.isPlatformAdmin) {
    void workerAPI.list({ cache: true });
    void jobAPI.list({ cache: true });
  }
}
