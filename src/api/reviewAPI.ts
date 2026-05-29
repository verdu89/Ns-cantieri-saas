import { httpClient } from "./httpClient";

export type ReviewRequestResult = {
  success: boolean;
  channel?: "google_sheet" | "email_app";
  emailSent?: boolean;
  emailSkippedReason?: string;
};

export const reviewAPI = {
  submitForJob(jobId: string): Promise<ReviewRequestResult> {
    return httpClient.post<ReviewRequestResult>(`/jobs/${jobId}/review-request`, {});
  },
};
