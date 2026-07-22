const DB_NAME = "ns-cantieri-upload-queue";
const DB_VERSION = 1;
const STORE = "pending";

export type QueuedUploadTarget = "job" | "order";

export type QueuedUpload = {
  id: string;
  targetType: QueuedUploadTarget;
  targetId: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      })
  );
}

export async function addQueuedUpload(entry: QueuedUpload): Promise<void> {
  await runTransaction("readwrite", (store) => store.put(entry));
}

export async function removeQueuedUpload(id: string): Promise<void> {
  await runTransaction("readwrite", (store) => store.delete(id));
}

export async function listQueuedUploads(): Promise<QueuedUpload[]> {
  const rows = await runTransaction<QueuedUpload[]>("readonly", (store) => store.getAll());
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countQueuedUploads(): Promise<number> {
  const rows = await listQueuedUploads();
  return rows.length;
}
