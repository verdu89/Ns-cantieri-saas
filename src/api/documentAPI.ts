import type { Documento } from "../types";
import { httpClient, type HttpRequestOptions } from "./httpClient";

const UPLOAD_REQUEST_OPTIONS: HttpRequestOptions = {
  timeoutMs: 120_000,
  retries: 3,
};

const defaultBaseUrl = "http://localhost:4000/api";
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  defaultBaseUrl;
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export function resolveDocumentUrl(fileUrl: string): string {
  if (!fileUrl) return fileUrl;
  if (fileUrl.startsWith("data:")) return fileUrl;
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const absolute = fileUrl.startsWith("/")
    ? `${API_ORIGIN}${fileUrl}`
    : `${API_BASE_URL}/${fileUrl}`;
  const token = localStorage.getItem("auth_token");
  if (!token || !absolute.includes("/api/files/")) return absolute;
  const separator = absolute.includes("?") ? "&" : "?";
  return `${absolute}${separator}token=${encodeURIComponent(token)}`;
}

export const documentAPI = {
  async listByOrder(orderId: string): Promise<Documento[]> {
    const rows = await httpClient.get<Documento[]>(
      `/order-documents?orderId=${encodeURIComponent(orderId)}`
    );
    return rows || [];
  },

  async addToOrder(
    orderId: string,
    payload: Pick<Documento, "fileName" | "fileUrl">
  ): Promise<Documento> {
    return httpClient.post<Documento>(
      "/order-documents",
      {
        orderId,
        fileName: payload.fileName,
        fileUrl: payload.fileUrl,
      },
      UPLOAD_REQUEST_OPTIONS
    );
  },

  async deleteFromOrder(docId: string): Promise<void> {
    await httpClient.delete(`/order-documents/${docId}`);
  },

  async setOrderDocumentShowOnField(
    docId: string,
    showOnField: boolean
  ): Promise<Documento> {
    return httpClient.patch<Documento>(`/order-documents/${docId}`, {
      showOnField,
    });
  },

  async setOrderDocumentHiddenOnField(
    docId: string,
    hideOnField: boolean
  ): Promise<Documento> {
    return this.setOrderDocumentShowOnField(docId, !hideOnField);
  },

  async listByJob(jobId: string): Promise<Documento[]> {
    const rows = await httpClient.get<Documento[]>(
      `/job-documents?jobId=${encodeURIComponent(jobId)}`
    );
    return rows || [];
  },

  async addToJob(
    jobId: string,
    payload: Pick<Documento, "fileName" | "fileUrl"> & {
      checkoutIndex?: number;
    }
  ): Promise<Documento> {
    return httpClient.post<Documento>(
      "/job-documents",
      {
        jobId,
        fileName: payload.fileName,
        fileUrl: payload.fileUrl,
        ...(payload.checkoutIndex !== undefined
          ? { checkoutIndex: payload.checkoutIndex }
          : {}),
      },
      UPLOAD_REQUEST_OPTIONS
    );
  },

  async patchJobDocument(
    docId: string,
    patch: { checkoutIndex: number | null }
  ): Promise<Documento> {
    return httpClient.patch<Documento>(`/job-documents/${docId}`, patch);
  },

  async deleteFromJob(docId: string): Promise<void> {
    await httpClient.delete(`/job-documents/${docId}`);
  },
};
