import { httpClient } from "./httpClient";

export type EconomicJobOrderRow = {
  id: string;
  code: string;
  createdAt: string;
  customerId: string;
  customerName: string | null;
  expected: number;
  collected: number;
  residual: number;
  paymentCount: number;
  settled: boolean;
};

export type EconomicOverviewQuery = {
  q?: string;
  customerId?: string;
  year?: number;
  from?: string;
  to?: string;
  settlement?: "all" | "open" | "settled";
  sort?: "createdAt" | "code" | "customer" | "expected" | "collected" | "residual";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type EconomicOverviewResponse = {
  rows: EconomicJobOrderRow[];
  totals: {
    expected: number;
    collected: number;
    residual: number;
    orderCount: number;
  };
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    customers: { id: string; name: string }[];
    years: number[];
  };
};

function toQueryString(params: EconomicOverviewQuery): string {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.customerId) sp.set("customerId", params.customerId);
  if (params.year != null) sp.set("year", String(params.year));
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.settlement) sp.set("settlement", params.settlement);
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  if (params.page != null) sp.set("page", String(params.page));
  if (params.pageSize != null) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const economicsAPI = {
  jobOrdersOverview(params: EconomicOverviewQuery = {}) {
    return httpClient.get<EconomicOverviewResponse>(
      `/economics/job-orders${toQueryString(params)}`
    );
  },
};
