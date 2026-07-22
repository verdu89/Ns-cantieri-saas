import { documentAPI } from "@/api/documentAPI";
import type { Documento } from "@/types";
import { fileToDataUrl } from "@/utils/file";
import { parseHttpErrorMessage } from "@/utils/httpError";
import { isDeviceOnline } from "@/utils/networkStatus";
import { isRetryableHttpError, withRetry } from "@/utils/retry";
import { resolveUploadFileName } from "@/utils/fileNames";
import { enqueueUpload, type UploadProgressCallback } from "@/utils/uploadQueueService";

export type UploadFileItem = {
  file: File;
  /** Nome salvato sul server; default: file.name */
  saveAs?: string;
  /** Associa subito alla sessione checkout corrente */
  checkoutIndex?: number;
};

export type UploadBatchResult = {
  succeeded: Array<{ fileName: string; doc: Documento }>;
  failed: Array<{ fileName: string; error: string }>;
  queued: Array<{ fileName: string }>;
};

type BatchOptions = {
  onFileSuccess?: (fileName: string) => void;
  onStorageChange?: () => void;
  onProgress?: UploadProgressCallback;
  /** Se true, non lancia eccezione se almeno un file è ok */
  allowPartial?: boolean;
  /** Mette in coda offline i file non caricati per errore di rete (default: true) */
  queueOnFailure?: boolean;
};

async function uploadSingleToJob(jobId: string, item: UploadFileItem): Promise<Documento> {
  const fileName = resolveUploadFileName(item.file, item.saveAs);
  return withRetry(
    async () => {
      const dataUrl = await fileToDataUrl(item.file);
      return documentAPI.addToJob(jobId, {
        fileName,
        fileUrl: dataUrl,
        ...(item.checkoutIndex !== undefined
          ? { checkoutIndex: item.checkoutIndex }
          : {}),
      });
    },
    { label: `upload job ${fileName}` }
  );
}

async function uploadSingleToOrder(orderId: string, item: UploadFileItem): Promise<Documento> {
  const fileName = resolveUploadFileName(item.file, item.saveAs);
  return withRetry(
    async () => {
      const dataUrl = await fileToDataUrl(item.file);
      return documentAPI.addToOrder(orderId, { fileName, fileUrl: dataUrl });
    },
    { label: `upload order ${fileName}` }
  );
}

async function processBatch(
  items: UploadFileItem[],
  uploadFn: (item: UploadFileItem) => Promise<Documento>,
  targetType: "job" | "order",
  targetId: string,
  options: BatchOptions
): Promise<UploadBatchResult> {
  const succeeded: UploadBatchResult["succeeded"] = [];
  const failed: UploadBatchResult["failed"] = [];
  const queued: UploadBatchResult["queued"] = [];
  const total = items.length;
  const queueOnFailure = options.queueOnFailure !== false;
  const online = await isDeviceOnline();

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const displayName = resolveUploadFileName(item.file, item.saveAs);
    options.onProgress?.(i, total, displayName);

    if (!online) {
      await enqueueUpload(targetType, targetId, item.file, item.saveAs);
      queued.push({ fileName: displayName });
      continue;
    }

    try {
      const doc = await uploadFn(item);
      succeeded.push({ fileName: displayName, doc });
      options.onFileSuccess?.(displayName);
      options.onStorageChange?.();
    } catch (err) {
      if (queueOnFailure && isRetryableHttpError(err)) {
        await enqueueUpload(targetType, targetId, item.file, item.saveAs);
        queued.push({ fileName: displayName });
      } else {
        failed.push({
          fileName: displayName,
          error: parseHttpErrorMessage(err, "Errore di rete durante il caricamento"),
        });
      }
    }
  }

  options.onProgress?.(total, total);

  if (failed.length > 0 && succeeded.length === 0 && queued.length === 0 && !options.allowPartial) {
    throw new Error(failed[0]!.error);
  }

  return { succeeded, failed, queued };
}

export async function uploadDocumentsToJob(
  jobId: string,
  items: UploadFileItem[],
  options: BatchOptions = {}
): Promise<UploadBatchResult> {
  return processBatch(items, (item) => uploadSingleToJob(jobId, item), "job", jobId, options);
}

export async function uploadDocumentsToOrder(
  orderId: string,
  items: UploadFileItem[],
  options: BatchOptions = {}
): Promise<UploadBatchResult> {
  return processBatch(
    items,
    (item) => uploadSingleToOrder(orderId, item),
    "order",
    orderId,
    options
  );
}
