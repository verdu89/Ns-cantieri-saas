import type { Payment } from "@/types";
import { emitJobsUpdated } from "@/lib/appEvents";
import { invalidateJobsCache } from "./jobs";
import { httpClient } from "./httpClient";

export const paymentAPI = {
  /** Tutti i pagamenti del tenant (una sola richiesta). */
  async listAll(): Promise<Payment[]> {
    return httpClient.get<Payment[]>("/payments");
  },

  async listByJob(jobId: string): Promise<Payment[]> {
    return httpClient.get<Payment[]>(`/payments?jobId=${encodeURIComponent(jobId)}`);
  },

  async bulkReplace(
    jobId: string,
    rows: Array<{
      label: string;
      amount: number;
      collected: boolean;
      partial: boolean;
      collectedAmount: number;
    }>
  ): Promise<Payment[]> {
    const result = await httpClient.post<Payment[]>("/payments/bulk-replace", {
      jobId,
      rows,
    });
    invalidateJobsCache();
    emitJobsUpdated();
    return result;
  },

  async update(id: string, patch: Partial<Payment>): Promise<Payment> {
    const result = await httpClient.put<Payment>(`/payments/${id}`, patch);
    invalidateJobsCache();
    emitJobsUpdated();
    return result;
  },
};
