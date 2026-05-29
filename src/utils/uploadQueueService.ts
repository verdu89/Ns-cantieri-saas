import { documentAPI } from "@/api/documentAPI";
import type { Documento } from "@/types";
import {
  addQueuedUpload,
  listQueuedUploads,
  removeQueuedUpload,
  type QueuedUpload,
  type QueuedUploadTarget,
} from "@/lib/uploadQueueStore";
import { fileToDataUrl } from "@/utils/file";
import { resolveUploadFileName } from "@/utils/fileNames";
import { isDeviceOnline } from "@/utils/networkStatus";
import { withRetry } from "@/utils/retry";

export type UploadProgressCallback = (
  completed: number,
  total: number,
  currentFileName?: string
) => void;

let flushInProgress = false;

export async function enqueueUpload(
  targetType: QueuedUploadTarget,
  targetId: string,
  file: File,
  saveAs?: string
): Promise<QueuedUpload> {
  const dataUrl = await fileToDataUrl(file);
  const entry: QueuedUpload = {
    id: crypto.randomUUID(),
    targetType,
    targetId,
    fileName: resolveUploadFileName(file, saveAs),
    mimeType: file.type || "application/octet-stream",
    dataUrl,
    createdAt: Date.now(),
  };
  await addQueuedUpload(entry);
  return entry;
}

async function uploadQueuedEntry(entry: QueuedUpload): Promise<Documento> {
  return withRetry(async () => {
    if (entry.targetType === "job") {
      return documentAPI.addToJob(entry.targetId, {
        fileName: entry.fileName,
        fileUrl: entry.dataUrl,
      });
    }
    return documentAPI.addToOrder(entry.targetId, {
      fileName: entry.fileName,
      fileUrl: entry.dataUrl,
    });
  }, { label: `queue sync ${entry.fileName}` });
}

export type FlushQueueResult = {
  uploaded: number;
  failed: number;
  remaining: number;
};

export async function flushUploadQueue(
  onProgress?: UploadProgressCallback
): Promise<FlushQueueResult> {
  if (flushInProgress) {
    const remaining = await listQueuedUploads();
    return { uploaded: 0, failed: 0, remaining: remaining.length };
  }

  const online = await isDeviceOnline();
  if (!online) {
    const remaining = await listQueuedUploads();
    return { uploaded: 0, failed: 0, remaining: remaining.length };
  }

  flushInProgress = true;
  let uploaded = 0;
  let failed = 0;

  try {
    const pending = await listQueuedUploads();
    const total = pending.length;

    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i]!;
      onProgress?.(i, total, entry.fileName);
      try {
        await uploadQueuedEntry(entry);
        await removeQueuedUpload(entry.id);
        uploaded++;
      } catch {
        failed++;
      }
    }

    onProgress?.(total, total);

    const remaining = await listQueuedUploads();
    return { uploaded, failed, remaining: remaining.length };
  } finally {
    flushInProgress = false;
  }
}
