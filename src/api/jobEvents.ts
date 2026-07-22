import { httpClient } from "./httpClient";
import type { JobEvent } from "@/types";

export const jobEventAPI = {
  async listByJob(jobId: string): Promise<JobEvent[]> {
    return httpClient.get<JobEvent[]>(`/job-events?jobId=${encodeURIComponent(jobId)}`);
  },

  async create(payload: {
    jobId: string;
    date: string;
    type: string;
    notes?: string;
  }): Promise<JobEvent> {
    return httpClient.post<JobEvent>("/job-events", payload);
  },
};
