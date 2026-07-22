import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { tenantStorageAPI, type TenantStorageSummary } from "@/api/tenantStorageAPI";
import { useAuth } from "@/context/AuthContext";

type Props = {
  /** Incrementa dopo upload/delete per aggiornare i contatori. */
  refreshKey?: number;
  className?: string;
};

export default function StorageUsageBanner({ refreshKey = 0, className = "" }: Props) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantStorageSummary | null>(null);

  useEffect(() => {
    if (!user?.tenantId || user.isPlatformAdmin) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    void tenantStorageAPI
      .getSummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.tenantId, user?.isPlatformAdmin, refreshKey]);

  if (!summary || summary.isUnlimited) return null;
  if (!summary.atLimit && !summary.nearLimit) return null;

  const quotaLabel =
    summary.quotaMb != null ? `${summary.quotaMb} MB` : "il limite incluso";

  const text = summary.atLimit
    ? `Limite upload raggiunto (${summary.usedMb} / ${quotaLabel} utilizzati). Contatta l'assistenza per aggiungere spazio storage.`
    : `Stai per raggiungere il limite upload (${summary.usedMb} / ${quotaLabel}, ${summary.percentUsed}%). Contatta l'assistenza per aggiungere spazio prima che gli upload vengano bloccati.`;

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${
        summary.atLimit
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-950"
      } ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>{text}</p>
    </div>
  );
}
