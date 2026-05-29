import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { pushAPI, type PushRecipient } from "@/api/pushAPI";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { inputFieldClass } from "@/components/layout/PageChrome";
import { toast } from "react-hot-toast";

const roleLabel: Record<string, string> = {
  worker: "Montatore",
  backoffice: "Backoffice",
  admin: "Admin",
};

type PushBroadcastPanelProps = {
  /** Super-admin: tenant già selezionato (es. scheda nel modal cliente). */
  tenantId?: string;
  /** Senza Card esterna quando incorporato nel modal Super Admin. */
  embedded?: boolean;
};

export default function PushBroadcastPanel({
  tenantId: tenantIdProp,
  embedded = false,
}: PushBroadcastPanelProps) {
  const platformScoped = Boolean(tenantIdProp);

  const [recipients, setRecipients] = useState<PushRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const loadRecipients = useCallback(async () => {
    if (platformScoped && !tenantIdProp) {
      setRecipients([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await pushAPI.listRecipients(
        platformScoped ? tenantIdProp : undefined
      );
      setRecipients(rows);
    } catch {
      toast.error("Impossibile caricare gli utenti");
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, [platformScoped, tenantIdProp]);

  useEffect(() => {
    setSelected(new Set());
    setTitle("");
    setBody("");
    if (platformScoped && !tenantIdProp) {
      setRecipients([]);
      return;
    }
    void loadRecipients();
  }, [loadRecipients, platformScoped, tenantIdProp]);

  const withDevices = useMemo(
    () => recipients.filter((r) => r.deviceCount > 0),
    [recipients]
  );

  function toggleWorker(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllWithDevices() {
    setSelected(new Set(withDevices.map((r) => r.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleCleanup() {
    if (cleaning) return;
    const confirmed = window.confirm(
      "Rimuovere i dispositivi che FCM segnala come non più validi? Verifico ogni token con un test silenzioso."
    );
    if (!confirmed) return;

    setCleaning(true);
    try {
      const r = await pushAPI.cleanup(
        platformScoped ? tenantIdProp : undefined
      );
      if (r.removed > 0) {
        toast.success(
          `Rimossi ${r.removed} dispositivi non più raggiungibili (${r.remaining} attivi).`
        );
      } else {
        toast.success(`Nessun dispositivo da pulire (${r.checked} controllati).`);
      }
      await loadRecipients();
      setSelected(new Set());
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "";
      if (raw.includes("FCM_UNAVAILABLE")) {
        toast.error("Push non configurato sul server (Firebase FCM)");
      } else {
        toast.error("Pulizia non riuscita");
      }
    } finally {
      setCleaning(false);
    }
  }

  async function handleSend() {
    if (selected.size === 0) {
      toast.error("Seleziona almeno un utente");
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error("Inserisci titolo e messaggio");
      return;
    }

    setSending(true);
    try {
      const result = await pushAPI.send({
        workerIds: [...selected],
        title: title.trim(),
        body: body.trim(),
        ...(platformScoped && tenantIdProp ? { tenantId: tenantIdProp } : {}),
      });
      if (result.sent > 0) {
        const removedNote =
          result.removedDeadDevices && result.removedDeadDevices > 0
            ? ` · puliti ${result.removedDeadDevices} dispositivi vecchi`
            : "";
        toast.success(
          `Notifica inviata a ${result.sent} dispositivo/i (${result.targetedWorkers} utenti)${removedNote}`
        );
        setTitle("");
        setBody("");
        clearSelection();
        if (result.removedDeadDevices && result.removedDeadDevices > 0) {
          await loadRecipients();
        }
      } else {
        toast.error("Nessuna notifica consegnata. Controlla FCM sul server.");
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "";
      const jsonPart = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : "";
      let code = "";
      try {
        const parsed = JSON.parse(jsonPart) as { code?: string; message?: string };
        code = parsed.code ?? "";
        if (parsed.message) {
          toast.error(parsed.message);
          return;
        }
      } catch {
        /* ignore */
      }
      if (code === "NO_PUSH_TOKENS" || raw.includes("NO_PUSH_TOKENS")) {
        toast.error("Gli utenti selezionati non hanno notifiche attive sul telefono");
      } else if (code === "FCM_UNAVAILABLE" || raw.includes("FCM_UNAVAILABLE")) {
        toast.error("Push non configurato sul server (Firebase FCM)");
      } else {
        toast.error("Invio non riuscito");
      }
    } finally {
      setSending(false);
    }
  }

  const listMaxHeight = embedded ? "max-h-56" : "max-h-48";

  const content = (
    <div className="space-y-4 text-sm">
      {loading ? (
        <p className="flex items-center gap-2 text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Caricamento utenti…
        </p>
      ) : recipients.length === 0 ? (
        <p className="text-slate-500">Nessun utente in questo tenant.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              onClick={selectAllWithDevices}
              disabled={withDevices.length === 0}
            >
              Seleziona con notifiche ({withDevices.length})
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={clearSelection}
              disabled={selected.size === 0}
            >
              Deseleziona tutti
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => void loadRecipients()}
            >
              Aggiorna elenco
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="gap-1 text-xs text-rose-600 hover:text-rose-700"
              onClick={() => void handleCleanup()}
              disabled={cleaning || recipients.length === 0}
              title="Verifica con FCM e rimuove i dispositivi non più validi (app disinstallate, token rinnovati)"
            >
              {cleaning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {cleaning ? "Pulizia…" : "Pulisci dispositivi vecchi"}
            </Button>
          </div>

          <ul
            className={`${listMaxHeight} space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-2`}
          >
            {recipients.map((r) => {
              const disabled = r.deviceCount === 0;
              const checked = selected.has(r.id);
              return (
                <li key={r.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition ${
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : checked
                          ? "bg-orange-50 ring-1 ring-orange-200"
                          : "hover:bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleWorker(r.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-slate-900">{r.name}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {roleLabel[r.role] ?? r.role}
                      </span>
                      {r.email && (
                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                          {r.email}
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        r.deviceCount > 0 ? "text-green-700" : "text-slate-400"
                      }`}
                    >
                      {r.deviceCount > 0 ? `${r.deviceCount} disp.` : "no push"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Titolo notifica"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className={inputFieldClass}
            />
            <textarea
              placeholder="Messaggio"
              value={body}
              maxLength={500}
              rows={3}
              onChange={(e) => setBody(e.target.value)}
              className={`${inputFieldClass} resize-y min-h-[88px]`}
            />
            <Button
              type="button"
              variant="primary"
              disabled={sending || selected.size === 0}
              className="w-full gap-2 sm:w-auto"
              onClick={() => void handleSend()}
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {sending ? "Invio…" : "Invia notifica"}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card>
      <CardContent className="pt-6">{content}</CardContent>
    </Card>
  );
}
