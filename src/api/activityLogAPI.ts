import { httpClient } from "./httpClient";

export type ActivityBusinessContext = {
  customerName: string | null;
  orderCode: string | null;
  jobTitle: string | null;
  jobStatus: string | null;
};

export type ActivityLogEntry = {
  id: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantDisplayName: string | null;
  actorWorkerId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  businessContext: ActivityBusinessContext | null;
  contextLabel: string | null;
  payload: unknown;
  requestMethod: string | null;
  requestPath: string | null;
  ip: string | null;
  createdAt: string;
};

export type ActivityLogListResponse = {
  total: number;
  skip: number;
  take: number;
  items: ActivityLogEntry[];
};

export const activityLogAPI = {
  async list(params: {
    q?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
    tenantScope?: string;
    skip?: number;
    take?: number;
  }): Promise<ActivityLogListResponse> {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.entityType) sp.set("entityType", params.entityType);
    if (params.entityId) sp.set("entityId", params.entityId);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    if (params.tenantScope) sp.set("tenantScope", params.tenantScope);
    if (params.skip !== undefined) sp.set("skip", String(params.skip));
    if (params.take !== undefined) sp.set("take", String(params.take));
    const qs = sp.toString();
    return httpClient.get<ActivityLogListResponse>(
      `/activity-logs${qs ? `?${qs}` : ""}`
    );
  },

  async clear(params?: { tenantScope?: string }): Promise<{ deleted: number; scope: string }> {
    return httpClient.post<{ deleted: number; scope: string }>("/activity-logs/clear", {
      confirm: true as const,
      ...(params?.tenantScope ? { tenantScope: params.tenantScope } : {}),
    });
  },
};
