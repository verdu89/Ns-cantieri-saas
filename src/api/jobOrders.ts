import type { JobOrder } from "../types";
import type { OfficeOpenItem, OfficeStatus, DeliveryDateChange } from "@/config/officeWorkflow";
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
  officeStatus?: OfficeStatus;
  expectedDeliveryDate?: string;
  depositAmount?: number;
  depositCollectedAt?: string;
  clientConfirmedAt?: string;
  clientConfirmedNote?: string | null;
  openItems?: OfficeOpenItem[];
  deliveryDateHistory?: DeliveryDateChange[];
  deliveryWeekYear?: number | null;
  deliveryWeekNum?: number | null;
  deliveryCons?: string | null;
  contactName?: string | null;
  destinationCity?: string | null;
  productColor?: string | null;
  pieceCount?: number | null;
  hasControcasse?: boolean;
  hasMontaggio?: boolean;
  hasEneaPratica?: boolean;
  eneaPraticaPendingAt?: string | null;
  eneaPraticaCompletedAt?: string | null;
  eneaPraticaNote?: string | null;
  createdAt: string;
};

export type JobOrderUpdatePayload = Partial<JobOrderCreatePayload> & {
  deliveryDateChangeNote?: string | null;
};

export type JobOrderCreatePayload = Omit<JobOrder, "id" | "createdAt"> & {
  hasMeasurements?: boolean;
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
    officeStatus: row.officeStatus,
    expectedDeliveryDate: row.expectedDeliveryDate,
    depositAmount: row.depositAmount,
    depositCollectedAt: row.depositCollectedAt,
    clientConfirmedAt: row.clientConfirmedAt,
    clientConfirmedNote: row.clientConfirmedNote ?? undefined,
    openItems: row.openItems ?? [],
    deliveryDateHistory: row.deliveryDateHistory ?? [],
    deliveryWeekYear: row.deliveryWeekYear,
    deliveryWeekNum: row.deliveryWeekNum,
    deliveryCons: row.deliveryCons,
    contactName: row.contactName,
    destinationCity: row.destinationCity,
    productColor: row.productColor,
    pieceCount: row.pieceCount,
    hasControcasse: row.hasControcasse ?? false,
    hasMontaggio: row.hasMontaggio ?? false,
    hasEneaPratica: row.hasEneaPratica ?? false,
    eneaPraticaPendingAt: row.eneaPraticaPendingAt ?? undefined,
    eneaPraticaCompletedAt: row.eneaPraticaCompletedAt ?? undefined,
    eneaPraticaNote: row.eneaPraticaNote ?? undefined,
    createdAt: row.createdAt,
  };
}

function officePayloadFields(payload: Partial<JobOrderCreatePayload>) {
  return {
    ...(payload.hasMeasurements !== undefined
      ? { hasMeasurements: payload.hasMeasurements }
      : {}),
    ...(payload.officeStatus !== undefined
      ? { officeStatus: payload.officeStatus }
      : {}),
    ...(payload.expectedDeliveryDate !== undefined
      ? { expectedDeliveryDate: payload.expectedDeliveryDate }
      : {}),
    ...(payload.depositAmount !== undefined
      ? { depositAmount: payload.depositAmount }
      : {}),
    ...(payload.depositCollectedAt !== undefined
      ? { depositCollectedAt: payload.depositCollectedAt }
      : {}),
    ...(payload.clientConfirmedAt !== undefined
      ? { clientConfirmedAt: payload.clientConfirmedAt }
      : {}),
    ...(payload.clientConfirmedNote !== undefined
      ? { clientConfirmedNote: payload.clientConfirmedNote }
      : {}),
    ...(payload.openItems !== undefined ? { openItems: payload.openItems } : {}),
    ...(payload.deliveryWeekYear !== undefined
      ? { deliveryWeekYear: payload.deliveryWeekYear }
      : {}),
    ...(payload.deliveryWeekNum !== undefined
      ? { deliveryWeekNum: payload.deliveryWeekNum }
      : {}),
    ...(payload.deliveryCons !== undefined ? { deliveryCons: payload.deliveryCons } : {}),
    ...(payload.contactName !== undefined ? { contactName: payload.contactName } : {}),
    ...(payload.destinationCity !== undefined
      ? { destinationCity: payload.destinationCity }
      : {}),
    ...(payload.productColor !== undefined ? { productColor: payload.productColor } : {}),
    ...(payload.pieceCount !== undefined ? { pieceCount: payload.pieceCount } : {}),
    ...(payload.hasControcasse !== undefined
      ? { hasControcasse: payload.hasControcasse }
      : {}),
    ...(payload.hasMontaggio !== undefined ? { hasMontaggio: payload.hasMontaggio } : {}),
    ...(payload.hasEneaPratica !== undefined
      ? { hasEneaPratica: payload.hasEneaPratica }
      : {}),
    ...(payload.eneaPraticaPendingAt !== undefined
      ? { eneaPraticaPendingAt: payload.eneaPraticaPendingAt }
      : {}),
    ...(payload.eneaPraticaCompletedAt !== undefined
      ? { eneaPraticaCompletedAt: payload.eneaPraticaCompletedAt }
      : {}),
    ...(payload.eneaPraticaNote !== undefined
      ? { eneaPraticaNote: payload.eneaPraticaNote }
      : {}),
  };
}

function updatePayloadFields(patch: JobOrderUpdatePayload) {
  return {
    ...officePayloadFields(patch),
    ...(patch.deliveryDateChangeNote !== undefined
      ? { deliveryDateChangeNote: patch.deliveryDateChangeNote }
      : {}),
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

  async create(payload: JobOrderCreatePayload): Promise<JobOrder> {
    const row = await httpClient.post<JobOrderRow>("/job-orders", {
      code: payload.code,
      customerId: payload.customerId,
      location: payload.location ?? {},
      notes: payload.notes ?? null,
      notesBackoffice: payload.notesBackoffice ?? null,
      ...officePayloadFields(payload),
    });
    invalidateCache("job-orders:");
    return mapJobOrder(row);
  },

  async update(id: string, patch: JobOrderUpdatePayload): Promise<JobOrder> {
    const row = await httpClient.put<JobOrderRow>(`/job-orders/${id}`, {
      ...(patch.code !== undefined ? { code: patch.code } : {}),
      ...(patch.customerId !== undefined ? { customerId: patch.customerId } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.notesBackoffice !== undefined
        ? { notesBackoffice: patch.notesBackoffice }
        : {}),
      ...updatePayloadFields(patch),
    });
    invalidateCache("job-orders:");
    return mapJobOrder(row);
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/job-orders/${id}`);
    invalidateCache("job-orders:");
    invalidateCache("jobs:order:");
  },

  async eneaPendingCount(): Promise<number> {
    const result = await httpClient.get<{ count: number }>(
      "/job-orders/enea-pending-count"
    );
    return result?.count ?? 0;
  },
};
