// src/pages/job/JobStatusEditor.tsx
import { Button } from "@/components/ui/Button";
import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import type { Job, Worker } from "@/types";
import { jobAPI } from "@/api/jobs";
import { STATUS_CONFIG, getJobDisplayStatus } from "@/config/statusConfig";
import { toast } from "react-hot-toast";
import { inputFieldClass } from "@/components/layout/PageChrome";
import { toDbDate, toInputDateTime } from "@/utils/date";

interface JobStatusEditorProps {
  job: Job;
  setJob: (job: Job) => void;
  workers: Worker[];
  assignedWorkers: string[];
  setAssignedWorkers: (ids: string[]) => void;
  status: Job["status"];
  setStatus: (s: Job["status"]) => void;
  plannedLocal: string;
  setPlannedLocal: (val: string) => void;
}

export default function JobStatusEditor({
  job,
  setJob,
  workers,
  assignedWorkers,
  setAssignedWorkers,
  status,
  setStatus,
  plannedLocal,
  setPlannedLocal,
}: JobStatusEditorProps) {
  const parseApiError = (err: unknown, fallback: string) => {
    const raw = (err as { message?: string } | undefined)?.message;
    if (!raw) return fallback;
    const payload = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : raw;
    try {
      const parsed = JSON.parse(payload) as { message?: string };
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore parse error and use raw
    }
    return raw;
  };

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const persistedStatus = job.persistedStatus ?? status;
  const displayStatus = getJobDisplayStatus(persistedStatus, job.plannedDate);

  const [selectedStatus, setSelectedStatus] = useState<Job["status"]>(persistedStatus);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedStatus(job.persistedStatus ?? status);
  }, [job.persistedStatus, job.id, status]);

  // 🔹 scroll automatico quando appare un form
  useEffect(() => {
    if ((showAssignForm || showOverride) && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showAssignForm, showOverride]);

  const cfg = STATUS_CONFIG[displayStatus] ?? {
    color: "bg-slate-200 text-slate-700",
    label: "Stato sconosciuto",
    icon: "❓",
  };

  const teamWorkers = useMemo(
    () => workers.filter((w) => assignedWorkers.includes(w.id)),
    [workers, assignedWorkers]
  );

  type JobUpdatePayload = {
    status?: Job["status"];
    planned_date?: string | null;
    assigned_workers?: string[];
  };

  const handleSave = async (updates: JobUpdatePayload, successMsg: string) => {
    try {
      setSaving(true);
      const data = await jobAPI.update(job.id, {
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.planned_date !== undefined
          ? { plannedDate: updates.planned_date }
          : {}),
        ...(updates.assigned_workers !== undefined
          ? { assignedWorkers: updates.assigned_workers }
          : {}),
      });

      // Risposta API = stato salvato in DB (+ regole UI per la visualizzazione)
      if (data) {
        setJob(data);
      }

      if (updates.status !== undefined) {
        setStatus(data?.status ?? updates.status);
      }

      if (updates.planned_date !== undefined) {
        setPlannedLocal(
          updates.planned_date ? toInputDateTime(updates.planned_date) : ""
        );
      }

      if (updates.assigned_workers !== undefined) {
        setAssignedWorkers(updates.assigned_workers ?? []);
      }

      toast.success(successMsg);
    } catch (err: unknown) {
      console.error(err);
      toast.error(parseApiError(err, "Errore durante il salvataggio"));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = () => {
    if (!plannedLocal || assignedWorkers.length === 0) {
      toast.error("Seleziona data e almeno un montatore");
      return;
    }

    handleSave(
      {
        status: "assegnato",
        planned_date: toDbDate(plannedLocal),
        assigned_workers: assignedWorkers,
      },
      "Lavoro assegnato con successo"
    );

    setShowAssignForm(false);
  };

  const handleSaveOverride = () => {
    const keepPlanning: Job["status"][] = [
      "assegnato",
      "in_corso",
      "in_ritardo",
    ];
    const updates: JobUpdatePayload = { status: selectedStatus };

    if (!keepPlanning.includes(selectedStatus)) {
      updates.planned_date = null;
      updates.assigned_workers = [];
    }

    handleSave(updates, "Stato aggiornato con successo");
    setShowOverride(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stato & Assegnazioni</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stato attuale */}
        <div>
          <span className={`px-3 py-1 rounded-full text-sm ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>

        {/* Squadra attuale */}
        <div className="text-sm">
          <div className="font-medium mb-1">Squadra assegnata</div>
          {teamWorkers.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1">
              {teamWorkers.map((w) => (
                <li key={w.id}>👷 {w.name}</li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-500">Nessun tecnico assegnato</div>
          )}
        </div>

        {/* Azioni */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setShowAssignForm(!showAssignForm);
              setShowOverride(false);
            }}
            className="w-full font-semibold sm:w-auto"
          >
            📌 Assegna lavoro
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              setShowOverride(!showOverride);
              setShowAssignForm(false);
            }}
            className="w-full font-semibold sm:w-auto"
          >
            📝 Modifica stato
          </Button>
        </div>

        {/* Form assegnazione */}
        {showAssignForm && (
          <div ref={formRef} className="space-y-4 border rounded-md p-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Data programmata
              </label>
              <input
                type="datetime-local"
                value={plannedLocal}
                onChange={(e) => setPlannedLocal(e.target.value)}
                className={inputFieldClass}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Montatori assegnati
              </label>
              <div className="flex flex-col gap-1">
                {workers.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={assignedWorkers.includes(w.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedWorkers([...assignedWorkers, w.id]);
                        } else {
                          setAssignedWorkers(
                            assignedWorkers.filter((id) => id !== w.id)
                          );
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 accent-brand"
                    />
                    {w.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="neutral"
                onClick={() => setShowAssignForm(false)}
                className="w-full bg-slate-200 hover:bg-slate-300 sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleAssign}
                disabled={saving}
                className="w-full font-semibold sm:w-auto"
              >
                {saving ? "⏳ Salvataggio..." : "Conferma assegnazione"}
              </Button>
            </div>
          </div>
        )}

        {/* Override stato */}
        {showOverride && (
          <div ref={formRef} className="space-y-2 border rounded-md p-4">
            <label className="block text-sm font-medium text-slate-700">
              Seleziona nuovo stato
            </label>
            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as Job["status"])
              }
              className={inputFieldClass}
            >
              {(
                Object.entries(STATUS_CONFIG) as [
                  Job["status"],
                  (typeof STATUS_CONFIG)[Job["status"]],
                ][]
              ).map(
                ([key, val]) => (
                  <option key={key} value={key}>
                    {val.icon} {val.label}
                  </option>
                )
              )}
            </select>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button
                type="button"
                variant="neutral"
                onClick={() => setShowOverride(false)}
                className="w-full bg-slate-200 hover:bg-slate-300 sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="warning"
                onClick={handleSaveOverride}
                disabled={saving}
                className="w-full font-semibold sm:w-auto"
              >
                {saving ? "⏳ Salvataggio..." : "Salva stato"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
