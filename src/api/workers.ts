import type { Worker } from "../types";
import { tenantCacheScope } from "@/lib/cacheScope";
import { fetchWithCache, invalidateCache } from "@/lib/resourceCache";
import { httpClient } from "./httpClient";

const WORKERS_CACHE_TTL_MS = 5 * 60_000;

type WorkerRow = {
  id: string;
  name: string;
  phone?: string;
  userId?: string;
  user_id?: string;
  email?: string;
  role?: string;
  checkoutCelebrationMessage?: string | null;
  checkoutCelebrationImageUrl?: string | null;
};

function mapWorker(row: WorkerRow): Worker {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    userId: row.userId ?? row.user_id ?? "",
    email: row.email,
    role: row.role,
    checkoutCelebrationMessage: row.checkoutCelebrationMessage ?? null,
    checkoutCelebrationImageUrl: row.checkoutCelebrationImageUrl ?? null,
  };
}

export type WorkerUpdatePayload = Partial<Worker> & {
  password?: string;
  checkoutCelebrationImage?: string;
  removeCheckoutCelebrationImage?: boolean;
};

export const workerAPI = {
  async list(options?: { cache?: boolean; revalidate?: boolean }): Promise<Worker[]> {
    const load = async () => {
      const rows = await httpClient.get<WorkerRow[]>("/workers");
      return (rows ?? []).map(mapWorker);
    };
    if (options?.cache) {
      const cacheKey = `workers:list:${tenantCacheScope()}`;
      return fetchWithCache(cacheKey, WORKERS_CACHE_TTL_MS, load, {
        revalidate: options.revalidate,
      });
    }
    return load();
  },

  async getById(id: string): Promise<Worker | undefined> {
    try {
      const row = await httpClient.get<WorkerRow>(`/workers/${id}`);
      return mapWorker(row);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("404:")) return undefined;
      throw error;
    }
  },

  async create(payload: Omit<Worker, "id"> & { password?: string }): Promise<Worker> {
    const row = await httpClient.post<WorkerRow>("/workers", {
      name: payload.name,
      phone: payload.phone ?? null,
      userId: payload.userId ?? null,
      email: payload.email ?? `${payload.name.replace(/\s+/g, ".").toLowerCase()}@local.test`,
      role: payload.role ?? "worker",
      password: payload.password,
    });
    invalidateCache("workers:list");
    return mapWorker(row);
  },

  async update(id: string, patch: WorkerUpdatePayload): Promise<Worker> {
    const row = await httpClient.put<WorkerRow>(`/workers/${id}`, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.userId !== undefined ? { userId: patch.userId } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.password !== undefined ? { password: patch.password } : {}),
      ...(patch.checkoutCelebrationMessage !== undefined
        ? { checkoutCelebrationMessage: patch.checkoutCelebrationMessage }
        : {}),
      ...(patch.checkoutCelebrationImage !== undefined
        ? { checkoutCelebrationImage: patch.checkoutCelebrationImage }
        : {}),
      ...(patch.removeCheckoutCelebrationImage !== undefined
        ? { removeCheckoutCelebrationImage: patch.removeCheckoutCelebrationImage }
        : {}),
    });
    invalidateCache("workers:list");
    return mapWorker(row);
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/workers/${id}`);
    invalidateCache("workers:list");
  },
};
