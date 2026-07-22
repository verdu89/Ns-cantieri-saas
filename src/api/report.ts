import { httpClient } from "./httpClient";
import type { PaymentCategoryId } from "@/utils/paymentCategory";

export type ReportPeriodQuery = {
  from: string;
  to: string;
};

export type ReportMoneyCategory = {
  id: PaymentCategoryId;
  label: string;
  expected: number;
  collected: number;
  residual: number;
  lineCount: number;
};

export type ReportPaymentLine = {
  label: string;
  category: PaymentCategoryId;
  categoryLabel: string;
  expected: number;
  collected: number;
  residual: number;
  settled: boolean;
};

export type ReportOrderRow = {
  id: string;
  code: string;
  customerId: string;
  customerName: string | null;
  jobs: number;
  jobsCompleted: number;
  expected: number;
  collected: number;
  residual: number;
  byCategory: ReportMoneyCategory[];
  payments: ReportPaymentLine[];
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
  byCategory: ReportMoneyCategory[];
  byLabel: {
    label: string;
    category: PaymentCategoryId;
    expected: number;
    collected: number;
    residual: number;
    lineCount: number;
  }[];
  byStatus: { status: string; count: number }[];
  byWorker: { id: string; name: string; jobs: number; completed: number }[];
  byDay: {
    date: string;
    jobs: number;
    completed: number;
    expected: number;
    collected: number;
  }[];
  orders: ReportOrderRow[];
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
