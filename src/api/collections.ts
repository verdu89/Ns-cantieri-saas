import { httpClient } from "./httpClient";

export type CollectionRow = {
  id: string;
  jobId: string | null;
  jobOrderId: string;
  customerId: string;
  customerName: string;
  orderCode: string;
  label: string;
  plannedDate: string | null;
  amount: number;
  collectedAmount: number;
  residualAmount: number;
  status: "insoluto" | "in_scadenza" | "futuro" | "incassato" | "senza_data";
  source: "order" | "job";
};

export const collectionsAPI = {
  overview(windowDays = 7) {
    return httpClient.get<{ rows: CollectionRow[]; windowDays: number }>(
      `/collections/overview?windowDays=${windowDays}`
    );
  },
};
