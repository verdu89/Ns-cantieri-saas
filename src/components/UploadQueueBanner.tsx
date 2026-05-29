import { CloudUpload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import UploadProgressBar from "@/components/ui/UploadProgressBar";
import { useUploadQueue } from "@/context/UploadQueueContext";

export default function UploadQueueBanner() {
  const { pendingCount, syncing, syncProgress, flushQueue } = useUploadQueue();

  if (pendingCount === 0 && !syncing) return null;

  const progressTotal = syncProgress?.total ?? pendingCount;
  const progressDone = syncProgress?.completed ?? 0;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-3 right-3 z-[9998] mx-auto max-w-lg rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <CloudUpload className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium">
            {syncing
              ? "Sincronizzazione allegati in corso…"
              : `${pendingCount} allegat${pendingCount === 1 ? "o" : "i"} in attesa di caricamento`}
          </p>
          {(syncing || pendingCount > 0) && progressTotal > 0 && (
            <UploadProgressBar
              completed={progressDone}
              total={progressTotal}
              label={syncProgress?.fileName}
            />
          )}
          {!syncing && pendingCount > 0 && (
            <p className="text-xs text-sky-800">
              I file verranno inviati automaticamente al ripristino della connessione.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 !px-2 !py-2"
          disabled={syncing}
          onClick={() => void flushQueue()}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          <span className="sr-only">Riprova ora</span>
        </Button>
      </div>
    </div>
  );
}
