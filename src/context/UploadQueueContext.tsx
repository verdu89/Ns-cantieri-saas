import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { countQueuedUploads } from "@/lib/uploadQueueStore";
import { flushUploadQueue, type UploadProgressCallback } from "@/utils/uploadQueueService";
import { watchNetworkStatus } from "@/utils/networkStatus";

type UploadQueueContextValue = {
  pendingCount: number;
  syncing: boolean;
  syncProgress: { completed: number; total: number; fileName?: string } | null;
  refreshPendingCount: () => Promise<void>;
  flushQueue: () => Promise<void>;
  notifyQueued: (count: number) => void;
};

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    completed: number;
    total: number;
    fileName?: string;
  } | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await countQueuedUploads();
    setPendingCount(count);
  }, []);

  const flushQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = await countQueuedUploads();
    setPendingCount(pending);
    if (pending === 0) {
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    const onProgress: UploadProgressCallback = (completed, total, fileName) => {
      setSyncProgress({ completed, total, fileName });
    };
    try {
      const result = await flushUploadQueue(onProgress);
      await refreshPendingCount();
      if (result.uploaded > 0) {
        toast.success(
          `${result.uploaded} file in coda caricati sul server`,
          { duration: 4000 }
        );
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [refreshPendingCount]);

  const notifyQueued = useCallback(
    (count: number) => {
      if (count <= 0) return;
      void refreshPendingCount();
      toast(
        `${count} file in coda: verranno caricati automaticamente quando la rete è disponibile`,
        { duration: 5000, icon: "📤" }
      );
    },
    [refreshPendingCount]
  );

  useEffect(() => {
    void refreshPendingCount();
    const unwatch = watchNetworkStatus(() => {
      void flushQueue();
    });
    void flushQueue();
    return unwatch;
  }, [flushQueue, refreshPendingCount]);

  const value = useMemo(
    () => ({
      pendingCount,
      syncing,
      syncProgress,
      refreshPendingCount,
      flushQueue,
      notifyQueued,
    }),
    [pendingCount, syncing, syncProgress, refreshPendingCount, flushQueue, notifyQueued]
  );

  return (
    <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>
  );
}

export function useUploadQueue(): UploadQueueContextValue {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) {
    throw new Error("useUploadQueue must be used within UploadQueueProvider");
  }
  return ctx;
}
