import { httpClient } from "./httpClient";

export type ReportPeriodQuery = {
  from: string;
  to: string;
};

export type ReportPeriodResponse = {
  period: { from: string; to: string };
  totals: {
    jobs: number;
    jobsCompleted: number;
    completionRate: number;
    orders: number;
    expected: number;
    collected: number;
    residual: number;
  };
  byStatus: { status: string; count: number }[];
  byWorker: { id: string; name: string; jobs: number; completed: number }[];
  byDay: {
    date: string;
    jobs: number;
    completed: number;
    expected: number;
    collected: number;
  }[];
  orders: {
    id: string;
    code: string;
    customerId: string;
    customerName: string | null;
    jobs: number;
    jobsCompleted: number;
    expected: number;
    collected: number;
    residual: number;
  }[];
};

export const reportAPI = {
  overview() {
    return httpClient.get<{
      jobsCount: number;
      ordersCount: number;
      customersCount: number;
      jobsByStatus: Record<string, number>;
    }>("/reports/overview");
  },

  period(params: ReportPeriodQuery) {
    const sp = new URLSearchParams({ from: params.from, to: params.to });
    return httpClient.get<ReportPeriodResponse>(`/reports/period?${sp}`);
  },
};
