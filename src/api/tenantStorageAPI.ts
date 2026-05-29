import { httpClient } from "./httpClient";

export type TenantStorageSummary = {
  usedBytes: number;
  quotaBytes: number | null;
  usedMb: number;
  quotaMb: number | null;
  documentsStorageEnabled: boolean;
  isUnlimited: boolean;
  percentUsed: number;
  atLimit: boolean;
  nearLimit: boolean;
};

export const tenantStorageAPI = {
  getSummary(): Promise<TenantStorageSummary> {
    return httpClient.get<TenantStorageSummary>("/tenant/storage");
  },
};
