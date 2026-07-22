import { httpClient } from "./httpClient";
import type { PaymentCategoryId } from "@/utils/paymentCategory";

export type EconomicMoneyBucket = {
  expected: number;
  collected: number;
  residual: number;
  lineCount: number;
};

export type EconomicCategoryTotal = EconomicMoneyBucket & {
  id: PaymentCategoryId;
  label: string;
};

export type EconomicPaymentLine = {
  id: string;
  label: string;
  category: PaymentCategoryId;
  categoryLabel: string;
  amount: number;
  collected: boolean;
  partial: boolean;
  collectedAmount: number;
  residual: number;
  showOnField: boolean;
  source: "order" | "job";
};

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
  usesOrderPlan?: boolean;
  settled: boolean;
  expectedDeliveryDate?: string | null;
  deliveryWeekYear?: number | null;
  deliveryWeekNum?: number | null;
  officeStatus?: string | null;
  referenceDate?: string;
  byCategory?: EconomicCategoryTotal[];
  payments?: EconomicPaymentLine[];
};

export type EconomicLabelTotal = {
  label: string;
  category: PaymentCategoryId;
  expected: number;
  collected: number;
  residual: number;
  lineCount: number;
};

export type EconomicOverviewQuery = {
  q?: string;
  customerId?: string;
  year?: number;
  from?: string;
  to?: string;
  dateAxis?: "createdAt" | "delivery";
  settlement?: "all" | "open" | "settled";
  category?: "all" | PaymentCategoryId;
  visibility?: "all" | "field" | "office";
  sort?:
    | "createdAt"
    | "referenceDate"
    | "code"
    | "customer"
    | "expected"
    | "collected"
    | "residual";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type EconomicDebtorOrder = {
  id: string;
  code: string;
  residual: number;
  expected: number;
  collected: number;
  referenceDate: string;
  deliveryWeekYear: number | null;
  deliveryWeekNum: number | null;
  unpaidLines: {
    id: string;
    label: string;
    category: PaymentCategoryId;
    categoryLabel: string;
    residual: number;
    amount: number;
    collectedAmount: number;
  }[];
};

export type EconomicDebtor = {
  customerId: string;
  customerName: string;
  orderCount: number;
  expected: number;
  collected: number;
  residual: number;
  orders: EconomicDebtorOrder[];
};

export type EconomicOverviewResponse = {
  rows: EconomicJobOrderRow[];
  totals: {
    expected: number;
    collected: number;
    residual: number;
    collectedPct: number;
    orderCount: number;
    openOrderCount: number;
    byCategory: EconomicCategoryTotal[];
    byLabel: EconomicLabelTotal[];
    debtors: EconomicDebtor[];
  };
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    customers: { id: string; name: string }[];
    years: number[];
    dateAxis?: "createdAt" | "delivery";
    category?: string;
    visibility?: string;
  };
};

function toQueryString(params: EconomicOverviewQuery): string {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.customerId) sp.set("customerId", params.customerId);
  if (params.year != null) sp.set("year", String(params.year));
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.dateAxis) sp.set("dateAxis", params.dateAxis);
  if (params.settlement) sp.set("settlement", params.settlement);
  if (params.category) sp.set("category", params.category);
  if (params.visibility) sp.set("visibility", params.visibility);
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
