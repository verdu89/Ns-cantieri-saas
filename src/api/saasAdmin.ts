import { getApiBaseUrl, httpClient, tryRefreshSession } from "./httpClient";
import { fetchWithResilience } from "@/utils/resilientRequest";

export type TenantListItem = {
  id: string;
  slug: string;
  displayName: string;
  plan: "trial" | "basic" | "pro";
  trialEndsAt: string | null;
  billingCycle: "monthly" | "yearly";
  monthlyPrice: number;
  nextBillingAt: string | null;
  lastPaymentAt: string | null;
  paymentStatus: "pending" | "paid" | "overdue";
  reviewRequestEnabled: boolean;
  reviewDeliveryMode: "google_sheet" | "email_app";
  reviewGoogleSheetId: string | null;
  checkoutEmailEnabled: boolean;
  documentsStorageEnabled: boolean;
  checkoutDigitalEnabled: boolean;
  checkoutCompanyName: string | null;
  checkoutSubtitle: string | null;
  checkoutLegalText: string | null;
  checkoutFooterWebsite: string | null;
  checkoutLogoUrl: string | null;
  checkoutHeaderLayout: string | null;
  checkoutBrandColor: string | null;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  status: "active" | "suspended" | "archived";
  isActive: boolean;
  createdAt: string;
};

export type TenantUserItem = {
  id: string;
  workerId?: string | null;
  email: string;
  fullName: string;
  role: "admin" | "backoffice" | "worker";
  tenantId: string;
  isActive?: boolean;
};

export type BillingEventItem = {
  id: string;
  tenantId: string;
  eventType: string;
  message: string;
  amount: number | null;
  dueAt: string | null;
  effectiveAt: string | null;
  createdAt: string;
};

export type TenantBackupItem = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  tenantDisplayName: string | null;
  relativePath: string;
  sizeBytes: number;
  trigger: string;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type DatabaseDumpItem = {
  id: string;
  kind: string;
  relativePath: string;
  sizeBytes: number;
  trigger: string;
  status: string;
  errorMessage: string | null;
  sha256: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type PlatformEmailStatus = {
  sendingReady: boolean;
  emailEnabled: boolean;
  hasApiKey: boolean;
  hasFromAddress: boolean;
  fromAddress: string | null;
  hint: string;
};

export type PlatformEmailConfigRecord = {
  emailEnabled: boolean;
  emailFrom: string | null;
  hasResendApiKeyInEnv: boolean;
  resendApiKeyMasked: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  configuredInDatabase: boolean;
};

export type PlatformEmailAdminView = PlatformEmailStatus & {
  config: PlatformEmailConfigRecord;
};

export const saasAdminAPI = {
  getEmailPlatformStatus(): Promise<PlatformEmailAdminView> {
    return httpClient.get<PlatformEmailAdminView>("/admin/email-platform");
  },

  updateEmailPlatform(payload: {
    emailEnabled: boolean;
    emailFrom?: string | null;
  }): Promise<PlatformEmailAdminView> {
    return httpClient.put<PlatformEmailAdminView>("/admin/email-platform", payload);
  },

  listTenants(): Promise<TenantListItem[]> {
    return httpClient.get<TenantListItem[]>("/admin/tenants");
  },

  createTenant(payload: {
    slug: string;
    displayName: string;
    plan: "trial" | "basic" | "pro";
    admin: { fullName: string; email: string; password: string };
  }): Promise<{
    tenant: TenantListItem;
    adminUser: { id: string; email: string; fullName: string | null; role: string };
  }> {
    return httpClient.post("/admin/tenants", payload);
  },

  listTenantUsers(tenantId: string): Promise<TenantUserItem[]> {
    return httpClient.get<TenantUserItem[]>(
      `/admin/tenant-users?tenantId=${encodeURIComponent(tenantId)}`
    );
  },

  createTenantUser(payload: {
    tenantId: string;
    fullName: string;
    email: string;
    password: string;
    role: "admin" | "backoffice" | "worker";
  }): Promise<TenantUserItem> {
    return httpClient.post("/admin/tenant-users", payload);
  },

  updateTenantUser(
    userId: string,
    payload: {
      fullName?: string;
      email?: string;
      role?: "admin" | "backoffice" | "worker";
    }
  ): Promise<TenantUserItem> {
    return httpClient.put(`/admin/tenant-users/${userId}`, payload);
  },

  deleteTenantUser(userId: string): Promise<void> {
    return httpClient.delete(`/admin/tenant-users/${userId}`);
  },

  updateTenantStatus(
    tenantId: string,
    status: "active" | "suspended" | "archived"
  ): Promise<TenantListItem> {
    return httpClient.put(`/admin/tenants/${tenantId}/status`, { status });
  },

  deleteTenant(tenantId: string): Promise<void> {
    return httpClient.delete(`/admin/tenants/${tenantId}`);
  },

  forceDeleteTenant(tenantId: string, confirmSlug: string): Promise<void> {
    return httpClient.post(`/admin/tenants/${tenantId}/force-delete`, { confirmSlug });
  },

  uploadTenantCheckoutLogo(
    tenantId: string,
    imageDataUrl: string
  ): Promise<TenantListItem> {
    return httpClient.post<TenantListItem>(
      `/admin/tenants/${tenantId}/checkout-logo`,
      { imageDataUrl }
    );
  },

  deleteTenantCheckoutLogo(tenantId: string): Promise<TenantListItem> {
    return httpClient.delete<TenantListItem>(`/admin/tenants/${tenantId}/checkout-logo`);
  },

  async previewCheckoutPdf(
    tenantId: string,
    payload: {
      checkoutCompanyName?: string | null;
      checkoutSubtitle?: string | null;
      checkoutLegalText?: string | null;
      checkoutFooterWebsite?: string | null;
      checkoutHeaderLayout?: "band" | "clean" | "centered" | "logo_only" | null;
      checkoutBrandColor?: string | null;
    }
  ): Promise<Blob> {
    const path = `/admin/tenants/${tenantId}/checkout-pdf-preview`;
    const run = async () => {
      const token = localStorage.getItem("auth_token");
      return fetchWithResilience(`${getApiBaseUrl()}${path}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    };

    let response = await run();
    if (response.status === 401 && (await tryRefreshSession())) {
      response = await run();
    }
    if (!response.ok) {
      const text = await response.text();
      let message = "Errore generazione anteprima PDF";
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (text.trim()) message = text;
      }
      throw new Error(message);
    }
    return response.blob();
  },

  updateTenantBilling(
    tenantId: string,
    payload: Partial<{
      plan: "trial" | "basic" | "pro";
      trialEndsAt: string | null;
      billingCycle: "monthly" | "yearly";
      monthlyPrice: number;
      nextBillingAt: string | null;
      lastPaymentAt: string | null;
      paymentStatus: "pending" | "paid" | "overdue";
      reviewRequestEnabled: boolean;
      reviewDeliveryMode?: "google_sheet" | "email_app";
      reviewGoogleSheetUrl?: string | null;
      documentsStorageEnabled: boolean;
      storageQuotaBytes: number;
      checkoutDigitalEnabled?: boolean;
      checkoutEmailEnabled?: boolean;
      checkoutCompanyName?: string | null;
      checkoutSubtitle?: string | null;
      checkoutLegalText?: string | null;
      checkoutFooterWebsite?: string | null;
      checkoutLogoUrl?: string | null;
      checkoutHeaderLayout?: "band" | "clean" | "centered" | "logo_only" | null;
      checkoutBrandColor?: string | null;
      billingNote: string;
    }>
  ): Promise<TenantListItem> {
    return httpClient.put(`/admin/tenants/${tenantId}/billing`, payload);
  },

  listTenantBillingEvents(tenantId: string): Promise<BillingEventItem[]> {
    return httpClient.get<BillingEventItem[]>(`/admin/tenants/${tenantId}/billing-events`);
  },

  listTenantBackups(params?: { tenantId?: string; skip?: number; take?: number }): Promise<TenantBackupItem[]> {
    const sp = new URLSearchParams();
    if (params?.tenantId) sp.set("tenantId", params.tenantId);
    if (params?.skip != null) sp.set("skip", String(params.skip));
    if (params?.take != null) sp.set("take", String(params.take));
    const q = sp.toString();
    return httpClient.get<TenantBackupItem[]>(`/admin/tenant-backups${q ? `?${q}` : ""}`);
  },

  runTenantBackup(payload?: { tenantId?: string }): Promise<TenantBackupItem | { message: string }> {
    return httpClient.post<TenantBackupItem | { message: string }>("/admin/tenant-backups/run", payload ?? {});
  },

  restoreTenantBackup(backupId: string, confirmSlug: string): Promise<{ ok: boolean }> {
    return httpClient.post<{ ok: boolean }>(`/admin/tenant-backups/${backupId}/restore`, { confirmSlug });
  },

  deleteTenantBackup(backupId: string): Promise<void> {
    return httpClient.delete(`/admin/tenant-backups/${backupId}`);
  },

  async downloadTenantBackup(backupId: string): Promise<{ blob: Blob; fileName: string }> {
    const { getApiBaseUrl } = await import("./httpClient");
    const token = localStorage.getItem("auth_token");
    const url = `${getApiBaseUrl()}/admin/tenant-backups/${encodeURIComponent(backupId)}/download`;
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${response.status}:${text || "Download failed"}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const fileName = match?.[1] ?? `backup-${backupId}.json.gz`;
    return { blob, fileName };
  },

  listDatabaseDumps(params?: { kind?: string; skip?: number; take?: number }): Promise<DatabaseDumpItem[]> {
    const sp = new URLSearchParams();
    if (params?.kind) sp.set("kind", params.kind);
    if (params?.skip != null) sp.set("skip", String(params.skip));
    if (params?.take != null) sp.set("take", String(params.take));
    const q = sp.toString();
    return httpClient.get<DatabaseDumpItem[]>(`/admin/database-dumps${q ? `?${q}` : ""}`);
  },

  runDatabaseDump(payload?: {
    kind?: "daily" | "weekly" | "monthly" | "manual";
  }): Promise<DatabaseDumpItem> {
    return httpClient.post<DatabaseDumpItem>("/admin/database-dumps/run", payload ?? {});
  },

  deleteDatabaseDump(dumpId: string): Promise<void> {
    return httpClient.delete(`/admin/database-dumps/${dumpId}`);
  },

  async downloadDatabaseDump(dumpId: string): Promise<{ blob: Blob; fileName: string }> {
    const { getApiBaseUrl } = await import("./httpClient");
    const token = localStorage.getItem("auth_token");
    const url = `${getApiBaseUrl()}/admin/database-dumps/${encodeURIComponent(dumpId)}/download`;
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${response.status}:${text || "Download failed"}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const fileName = match?.[1] ?? `dump-${dumpId}.dump`;
    return { blob, fileName };
  },

  resetTenantUserPassword(workerId: string, newPassword: string): Promise<{ ok: boolean }> {
    return httpClient.post<{ ok: boolean }>("/auth/reset-password", { workerId, newPassword });
  },
};
