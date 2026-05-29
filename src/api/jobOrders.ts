import type { JobOrder } from "../types";
import { tenantCacheScope } from "@/lib/cacheScope";
import { fetchWithCache, invalidateCache } from "@/lib/resourceCache";
import { httpClient } from "./httpClient";

const LIST_CACHE_TTL_MS = 120_000;

type JobOrderRow = {
  id: string;
  code: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  location?: { address?: string; mapsUrl?: string } | null;
  notes?: string;
  notesBackoffice?: string;
  createdAt: string;
};

function mapJobOrder(row: JobOrderRow): JobOrder {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    location: row.location ?? {},
    notes: row.notes ?? undefined,
    notesBackoffice: row.notesBackoffice ?? undefined,
    createdAt: row.createdAt,
  };
}

function listQueryString(params?: { q?: string; customerId?: string }) {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set("q", params.q.trim());
  if (params?.customerId?.trim()) sp.set("customerId", params.customerId.trim());
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const jobOrderAPI = {
  async list(options?: {
    cache?: boolean;
    forceFresh?: boolean;
    q?: string;
    customerId?: string;
  }): Promise<JobOrder[]> {
    const hasFilters = Boolean(options?.q?.trim() || options?.customerId?.trim());
    const load = async () => {
      const rows = await httpClient.get<JobOrderRow[]>(
        `/job-orders${listQueryString({
          q: options?.q,
          customerId: options?.customerId,
        })}`
      );
      return (Array.isArray(rows) ? rows : []).map(mapJobOrder);
    };
    if (options?.cache && !hasFilters) {
      const cacheKey = `job-orders:list:${tenantCacheScope()}`;
      return fetchWithCache(cacheKey, LIST_CACHE_TTL_MS, load, {
        forceFresh: options.forceFresh,
        revalidate: !options.forceFresh,
      });
    }
    return load();
  },

  async getById(id: string): Promise<JobOrder | undefined> {
    try {
      const row = await httpClient.get<JobOrderRow>(`/job-orders/${id}`);
      return mapJobOrder(row);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return undefined;
      }
      throw error;
    }
  },

  async listByCustomer(customerId: string): Promise<JobOrder[]> {
    const rows = await httpClient.get<JobOrderRow[]>(
      `/job-orders?customerId=${encodeURIComponent(customerId)}`
    );
    return rows.map(mapJobOrder);
  },

  async create(payload: Omit<JobOrder, "id" | "createdAt">): Promise<JobOrder> {
    const row = await httpClient.post<JobOrderRow>("/job-orders", {
      code: payload.code,
      customerId: payload.customerId,
      location: payload.location ?? {},
      notes: payload.notes ?? null,
      notesBackoffice: payload.notesBackoffice ?? null,
    });
    invalidateCache("job-orders:");
    return mapJobOrder(row);
  },

  async update(id: string, patch: Partial<JobOrder>): Promise<JobOrder> {
    const row = await httpClient.put<JobOrderRow>(`/job-orders/${id}`, {
      ...(patch.code !== undefined ? { code: patch.code } : {}),
      ...(patch.customerId !== undefined ? { customerId: patch.customerId } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.notesBackoffice !== undefined
        ? { notesBackoffice: patch.notesBackoffice }
        : {}),
    });
    invalidateCache("job-orders:");
    return mapJobOrder(row);
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/job-orders/${id}`);
    invalidateCache("job-orders:");
    invalidateCache("jobs:order:");
  },
};
