import type { Job, JobFollowUp, JobPriority } from "@/types";
import { httpClient } from "./httpClient";
import {
  invalidateJobsCache,
  jobAPI,
  type JobListOptions,
  type JobListQuery,
  type PaginatedJobs,
} from "./jobs";
import { emitJobsUpdated } from "@/lib/appEvents";
import type { AssistenzaListFilter } from "@/config/assistenzaConfig";

export type AssistenzaOpenJob = {
  id: string;
  jobOrderId: string;
  orderCode: string;
  status: string;
  plannedDate: string | null;
  priority: string;
  followUpCount: number;
  notes: string | null;
  createdAt: string;
};

export type AssistenzaOpenResponse = {
  customerId: string | null;
  items: AssistenzaOpenJob[];
};

export function assistenzaFilterToQuery(
  filter: AssistenzaListFilter,
  q: string,
  page: number,
  pageSize: number
): JobListQuery {
  const base: JobListQuery = {
    title: "assistenza",
    page,
    pageSize,
    ...(q.trim() ? { q: q.trim() } : {}),
  };

  switch (filter) {
    case "all":
      return base;
    case "open":
      return { ...base, openOnly: true };
    case "urgent":
      return { ...base, openOnly: true, priority: "urgente" };
    case "sollecitati":
      return { ...base, openOnly: true, sollecitati: true };
    case "in_attesa_programmazione":
    case "assegnato":
    case "in_corso":
    case "da_completare":
      return { ...base, status: filter, openOnly: true };
    default:
      return { ...base, openOnly: true };
  }
}

export type AssistenzaSummary = {
  totalOpen: number;
  urgent: number;
  sollecitati: number;
  byStatus: {
    in_attesa_programmazione: number;
    assegnato: number;
    in_corso: number;
    da_completare: number;
  };
  completatoLast30Days: number;
};

export const assistenzaAPI = {
  async summary(): Promise<AssistenzaSummary> {
    return httpClient.get<AssistenzaSummary>("/jobs/assistenza/summary");
  },

  async list(options?: JobListOptions): Promise<Job[]> {
    return jobAPI.listAssistenza(options);
  },

  async listPaginated(
    filter: AssistenzaListFilter,
    q: string,
    page: number,
    pageSize = 50
  ): Promise<PaginatedJobs> {
    return jobAPI.listAssistenzaPaginated({
      query: assistenzaFilterToQuery(filter, q, page, pageSize),
    });
  },

  async openByCustomer(params: {
    customerId?: string;
    phone?: string;
  }): Promise<AssistenzaOpenResponse> {
    const search = new URLSearchParams();
    if (params.customerId) search.set("customerId", params.customerId);
    if (params.phone?.trim()) search.set("phone", params.phone.trim());
    return httpClient.get<AssistenzaOpenResponse>(
      `/jobs/assistenza/open?${search.toString()}`
    );
  },

  async listFollowUps(jobId: string): Promise<JobFollowUp[]> {
    return httpClient.get<JobFollowUp[]>(`/jobs/${jobId}/follow-ups`);
  },

  async registerFollowUp(
    jobId: string,
    body: {
      note?: string;
      markUrgent?: boolean;
      priority?: JobPriority;
    }
  ): Promise<{ followUp: JobFollowUp; job: Pick<Job, "id" | "priority" | "followUpCount" | "lastFollowUpAt"> }> {
    const result = await httpClient.post<{
      followUp: JobFollowUp;
      job: Pick<Job, "id" | "priority" | "followUpCount" | "lastFollowUpAt">;
    }>(`/jobs/${jobId}/follow-up`, body);
    invalidateJobsCache();
    emitJobsUpdated();
    return result;
  },

  async setPriority(
    jobId: string,
    priority: JobPriority
  ): Promise<Pick<Job, "id" | "priority" | "followUpCount" | "lastFollowUpAt">> {
    const result = await httpClient.put<Pick<Job, "id" | "priority" | "followUpCount" | "lastFollowUpAt">>(
      `/jobs/${jobId}/assistenza-priority`,
      { priority }
    );
    invalidateJobsCache();
    emitJobsUpdated();
    return result;
  },
};
