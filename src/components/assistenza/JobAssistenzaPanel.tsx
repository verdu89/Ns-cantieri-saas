import { useCallback, useEffect, useState } from "react";
import type { Job, JobFollowUp } from "@/types";
import { assistenzaAPI } from "@/api/assistenza";
import { isAssistenzaJob } from "@/config/assistenzaConfig";
import { JOB_PRIORITY_CONFIG } from "@/config/assistenzaConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RegisterFollowUpModal } from "./RegisterFollowUpModal";
import { formatDateTime } from "@/utils/date";
import { PhoneCall } from "lucide-react";

type Props = {
  job: Job;
  onJobPatch: (patch: Partial<Job>) => void;
};

export function JobAssistenzaPanel({ job, onJobPatch }: Props) {
  const [followUps, setFollowUps] = useState<JobFollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadFollowUps = useCallback(async () => {
    if (!isAssistenzaJob({ title: job.title })) return;
    setLoading(true);
    try {
      const rows = await assistenzaAPI.listFollowUps(job.id);
      setFollowUps(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [job.id, job.title]);

  useEffect(() => {
    void loadFollowUps();
  }, [loadFollowUps]);

  if (!isAssistenzaJob(job)) return null;

  const priority = job.priority ?? "normale";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneCall size={18} /> Assistenza / solleciti
          </CardTitle>
          <Button type="button" className="px-3 py-1.5 text-xs" onClick={() => setModalOpen(true)}>
            Registra sollecito
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ${JOB_PRIORITY_CONFIG[priority].className}`}
            >
              Priorità: {JOB_PRIORITY_CONFIG[priority].label}
            </span>
            {(job.followUpCount ?? 0) > 0 && (
              <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900">
                {job.followUpCount} sollecit{(job.followUpCount ?? 0) === 1 ? "o" : "i"}
                {job.lastFollowUpAt
                  ? ` · ultimo ${formatDateTime(job.lastFollowUpAt)}`
                  : ""}
              </span>
            )}
          </div>

          {loading && <p className="text-slate-500">Caricamento storico…</p>}
          {!loading && followUps.length === 0 && (
            <p className="text-slate-500">Nessun sollecito registrato.</p>
          )}
          {!loading && followUps.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {followUps.map((f) => (
                <li key={f.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-medium text-slate-800">
                      {formatDateTime(f.createdAt)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {f.actorName ?? "Ufficio"}
                      {f.markUrgent ? " · marcato urgente" : ""}
                    </span>
                  </div>
                  {f.note && (
                    <p className="mt-1 text-slate-600 whitespace-pre-wrap">{f.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RegisterFollowUpModal
        job={job}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(patch) => {
          onJobPatch(patch);
          void loadFollowUps();
        }}
      />
    </>
  );
}
