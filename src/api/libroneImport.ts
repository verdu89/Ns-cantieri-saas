import { httpClient } from "./httpClient";

export type LibroneFieldChange = {
  field: string;
  label: string;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
};

export type LibroneImportPreviewRow = {
  code: string;
  action: "create" | "update" | "unchanged" | "skip";
  sectionNumber: number;
  displayName: string;
  changes: LibroneFieldChange[];
  skipReason?: string;
};

export type LibroneImportPreview = {
  parsedCount: number;
  createCount: number;
  updateCount: number;
  unchangedCount: number;
  skipCount: number;
  reconcileCount: number;
  rows: LibroneImportPreviewRow[];
  reconcileRows: LibroneOffPdfReconcileRow[];
  aiReview?: {
    enabled: boolean;
    ok: boolean;
    authError?: boolean;
    textBatches: number;
    visionPages: number;
    correctionCount: number;
    changes: Array<{
      code: string;
      fields: Array<{
        field: string;
        from: string | number | boolean | null;
        to: string | number | boolean | null;
        reason?: string;
      }>;
    }>;
    warnings: string[];
  } | null;
};

export type LibroneOffPdfReconcileRow = {
  orderId: string;
  code: string;
  from: string | null;
  to: string;
};

export type LibroneImportApplyResult = {
  created: number;
  updated: number;
  unchanged: number;
  reconciled: number;
  createdOrderIds: string[];
};

export type LibroneImportSelection = {
  codes?: string[];
  reconcileOrderIds?: string[];
};

export type LibronePendingRow = {
  orderId: string;
  code: string;
  customerId: string;
  customerName: string;
  contactName: string | null;
  deliveryWeekYear: number | null;
  deliveryWeekNum: number | null;
  productColor: string | null;
  pieceCount: number | null;
  destinationCity: string | null;
  notesBackoffice: string | null;
  hasControcasse: boolean;
  hasMontaggio: boolean;
  libroneImportedAt: string;
};

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export const libroneImportAPI = {
  async previewPdf(file: File): Promise<LibroneImportPreview> {
    const pdfBase64 = await fileToBase64(file);
    return httpClient.post<LibroneImportPreview>("/librone-import/preview", {
      pdfBase64,
    });
  },

  async applyPdf(
    file: File,
    selection?: LibroneImportSelection
  ): Promise<LibroneImportApplyResult> {
    const pdfBase64 = await fileToBase64(file);
    return httpClient.post<LibroneImportApplyResult>("/librone-import/apply", {
      pdfBase64,
      selection,
    });
  },

  async listPending(): Promise<LibronePendingRow[]> {
    return httpClient.get<LibronePendingRow[]>("/librone-import/pending");
  },

  async pendingCount(): Promise<number> {
    const res = await httpClient.get<{ count: number }>(
      "/librone-import/pending-count"
    );
    return res.count;
  },

  async dismissPending(orderId: string): Promise<void> {
    await httpClient.post(`/librone-import/pending/${orderId}/dismiss`, {});
  },
};
