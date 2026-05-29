import { httpClient } from "./httpClient";

export type PushRecipient = {
  id: string;
  name: string;
  email: string;
  role: string;
  deviceCount: number;
};

export type PushSendResult = {
  sent: number;
  failed: number;
  targetedWorkers: number;
  devices: number;
  removedDeadDevices?: number;
};

export type PushCleanupResult = {
  checked: number;
  removed: number;
  remaining: number;
};

export const pushAPI = {
  register(token: string, platform: "android" | "ios" | "web" = "android") {
    return httpClient.post<{ id: string; registered: boolean }>("/push/register", {
      token,
      platform,
    });
  },

  unregister(token: string) {
    return httpClient.delete("/push/register", { token });
  },

  listRecipients(tenantId?: string): Promise<PushRecipient[]> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    return httpClient.get<PushRecipient[]>(`/push/recipients${qs}`);
  },

  send(payload: {
    workerIds: string[];
    title: string;
    body: string;
    tenantId?: string;
  }): Promise<PushSendResult> {
    return httpClient.post<PushSendResult>("/push/send", payload);
  },

  cleanup(tenantId?: string): Promise<PushCleanupResult> {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    return httpClient.post<PushCleanupResult>(`/push/cleanup${qs}`, {});
  },
};
