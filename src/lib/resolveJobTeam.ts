import { workerAPI } from "@/api/workers";
import type { Job, User, Worker } from "@/types";

const FALLBACK_WORKER = (id: string): Worker => ({
  id,
  name: "?",
  userId: "",
});

/**
 * Risolve i nomi del team senza scaricare tutta l'anagrafica per i montatori.
 */
export async function resolveWorkersForJobs(
  jobs: Job[],
  user: User | null
): Promise<Map<string, Worker>> {
  const ids = new Set<string>();
  for (const job of jobs) {
    for (const wid of job.assignedWorkers ?? []) {
      if (wid) ids.add(wid);
    }
  }

  if (user?.role === "worker") {
    const map = new Map<string, Worker>();
    if (user.workerId) {
      map.set(user.workerId, {
        id: user.workerId,
        name: user.name,
        email: user.email,
        userId: user.id,
      });
    }
    const missing = [...ids].filter((id) => !map.has(id));
    if (missing.length > 0) {
      const fetched = await Promise.all(
        missing.map((id) => workerAPI.getById(id))
      );
      for (let i = 0; i < missing.length; i++) {
        const w = fetched[i];
        map.set(missing[i], w ?? FALLBACK_WORKER(missing[i]));
      }
    }
    return map;
  }

  const all = await workerAPI.list({ cache: true });
  return new Map(all.map((w) => [w.id, w]));
}

export function attachTeamToJobs(
  jobs: Job[],
  workersById: Map<string, Worker>
): Job[] {
  return jobs.map((job) => ({
    ...job,
    team: (job.assignedWorkers ?? []).map(
      (wid) => workersById.get(wid) ?? FALLBACK_WORKER(wid)
    ),
  }));
}
