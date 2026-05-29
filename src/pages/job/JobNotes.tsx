import { Button } from "@/components/ui/Button";
import { useState, useRef, useEffect } from "react";
import type { Job } from "@/types";
import { jobAPI } from "@/api/jobs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { toast } from "react-hot-toast";
import { inputFieldClass } from "@/components/layout/PageChrome";

interface JobNotesProps {
  job: Job;
  setJob: React.Dispatch<React.SetStateAction<Job | null>>;
  orderNotes?: string;
  readOnly?: boolean; // 👈 nuovo flag
}

export default function JobNotes({
  job,
  setJob,
  orderNotes,
  readOnly = false,
}: JobNotesProps) {
  const [notes, setNotes] = useState(job.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const editRef = useRef<HTMLDivElement>(null);

  // 👇 quando attivo la modalità editing scrollo alla sezione
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [editing]);

  const handleSave = async () => {
    if (readOnly) return; // 🔒 blocco in sola lettura
    setSaving(true);
    try {
      const updated = await jobAPI.update(job.id, { notes });
      if (updated) {
        setJob((prev) =>
          prev ? { ...prev, ...updated, events: prev.events } : updated
        );
        toast.success("📝 Note intervento aggiornate");
        setEditing(false);
      }
    } catch (err) {
      console.error("Errore salvataggio note:", err);
      toast.error("Errore durante il salvataggio delle note ❌");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="scroll-on-open">
      <CardHeader>
        <CardTitle>📝 Note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* NOTE COMMESSA */}
        <div>
          <h3 className="text-md font-semibold mb-2 pt-8">📋 Note commessa</h3>
          <div className="text-slate-700 whitespace-pre-line min-h-[60px] bg-slate-50 rounded-md p-2">
            {orderNotes && orderNotes.trim() !== ""
              ? orderNotes
              : "Nessuna nota presente."}
          </div>
        </div>

        {/* NOTE INTERVENTO */}
        <div ref={editRef}>
          <h3 className="text-md font-semibold mb-2 pt-2">
            🛠️ Note intervento corrente
          </h3>

          {!editing ? (
            <>
              <div className="text-slate-700 whitespace-pre-line min-h-[60px]">
                {job.notes && job.notes.trim() !== ""
                  ? job.notes
                  : "Nessuna nota presente."}
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="warning"
                  onClick={() => {
                    setNotes(job.notes ?? "");
                    setEditing(true);
                  }}
                  className="mt-3 w-full sm:w-auto font-semibold"
                >
                  ✏️ Modifica
                </Button>
              )}
            </>
          ) : (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Scrivi le note dell'intervento..."
                className={inputFieldClass + " mb-2 min-h-[88px]"}
                rows={4}
                disabled={readOnly} // 🔒 disabilito textarea
              />
              {!readOnly && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full font-semibold sm:w-auto"
                  >
                    {saving ? "⏳ Salvataggio..." : "💾 Salva"}
                  </Button>
                  <Button
                    type="button"
                    variant="neutral"
                    onClick={() => {
                      setNotes(job.notes ?? "");
                      setEditing(false);
                    }}
                    className="w-full bg-slate-200 hover:bg-slate-300 sm:w-auto"
                  >
                    Annulla
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
