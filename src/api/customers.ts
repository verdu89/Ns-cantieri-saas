import type { Customer } from "@/types";
import { tenantCacheScope } from "@/lib/cacheScope";
import { fetchWithCache, invalidateCache } from "@/lib/resourceCache";
import { httpClient } from "./httpClient";

const LIST_CACHE_TTL_MS = 120_000;

type CustomerApiRow = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt?: string;
  created_at?: string;
};

function normalizeCustomer(c: CustomerApiRow): Customer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    notes: c.notes ?? undefined,
    createdAt: c.createdAt ?? c.created_at ?? undefined,
  };
}

export const customerAPI = {
  async list(options?: {
    cache?: boolean;
    forceFresh?: boolean;
    q?: string;
  }): Promise<Customer[]> {
    const hasFilters = Boolean(options?.q?.trim());
    const load = async () => {
      const qs = options?.q?.trim()
        ? `?q=${encodeURIComponent(options.q.trim())}`
        : "";
      const data = await httpClient.get<CustomerApiRow[]>(`/customers${qs}`);
      return (Array.isArray(data) ? data : []).map(normalizeCustomer);
    };
    if (options?.cache && !hasFilters) {
      const cacheKey = `customers:list:${tenantCacheScope()}`;
      return fetchWithCache(cacheKey, LIST_CACHE_TTL_MS, load, {
        forceFresh: options.forceFresh,
        revalidate: !options.forceFresh,
      });
    }
    return load();
  },

  async getById(id: string): Promise<Customer | undefined> {
    try {
      const data = await httpClient.get<CustomerApiRow>(`/customers/${id}`);
      return normalizeCustomer(data);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return undefined;
      }
      throw error;
    }
  },

  async create(payload: Omit<Customer, "id">): Promise<Customer> {
    const data = await httpClient.post<CustomerApiRow>("/customers", {
      name: payload.name,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address: payload.address ?? null,
      notes: payload.notes ?? null,
    });
    invalidateCache("customers:list");
    return normalizeCustomer(data);
  },

  async update(id: string, patch: Partial<Customer>): Promise<Customer> {
    const data = await httpClient.put<CustomerApiRow>(`/customers/${id}`, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    });
    invalidateCache("customers:list");
    return normalizeCustomer(data);
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/customers/${id}`);
    invalidateCache("customers:list");
  },

  /** Autocomplete: preferire `list({ q })` per risultati completi; `limit` solo se serve cap esplicito. */
  async search(q: string, limit = 100): Promise<Customer[]> {
    const rows = await httpClient.get<CustomerApiRow[]>(
      `/customers/search?q=${encodeURIComponent(q)}&limit=${limit}`
    );
    return Array.isArray(rows) ? rows.map(normalizeCustomer) : [];
  },
};
