import { Loader2 } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-brand" aria-label="Caricamento" />
    </div>
  );
}
