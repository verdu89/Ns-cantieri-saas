import type { OrderPayment } from "@/types";
import { httpClient } from "./httpClient";

export const orderPaymentAPI = {
  async listByOrder(orderId: string): Promise<OrderPayment[]> {
    return httpClient.get<OrderPayment[]>(
      `/order-payments?orderId=${encodeURIComponent(orderId)}`
    );
  },

  async bulkReplace(
    orderId: string,
    rows: Array<{
      label: string;
      amount: number;
      collected: boolean;
      partial: boolean;
      collectedAmount: number;
      showOnField?: boolean;
    }>
  ): Promise<OrderPayment[]> {
    return httpClient.post<OrderPayment[]>("/order-payments/bulk-replace", {
      orderId,
      rows,
    });
  },

  async setShowOnField(
    paymentId: string,
    showOnField: boolean
  ): Promise<OrderPayment> {
    return httpClient.patch<OrderPayment>(`/order-payments/${paymentId}`, {
      showOnField,
    });
  },

  async setHiddenOnField(
    paymentId: string,
    hideOnField: boolean
  ): Promise<OrderPayment> {
    return this.setShowOnField(paymentId, !hideOnField);
  },
};
