import { useCallback, useEffect, useState } from "react";
import { Mail, Save } from "lucide-react";
import toast from "react-hot-toast";
import { saasAdminAPI, type PlatformEmailAdminView } from "@/api/saasAdmin";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { inputFieldClass } from "@/components/layout/PageChrome";
import { parseHttpErrorMessage } from "@/utils/httpError";
import { formatDateTime } from "@/utils/date";

type FormState = {
  emailEnabled: boolean;
  emailFrom: string;
};

export function PlatformEmailConfigCard() {
  const [data, setData] = useState<PlatformEmailAdminView | null>(null);
  const [form, setForm] = useState<FormState>({
    emailEnabled: false,
    emailFrom: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const view = await saasAdminAPI.getEmailPlatformStatus();
      setData(view);
      setForm({
        emailEnabled: view.config.emailEnabled,
        emailFrom: view.config.emailFrom ?? "",
      });
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore caricamento configurazione email"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!form.emailFrom.trim() && form.emailEnabled) {
      toast.error("Inserisci il mittente prima di attivare l'invio");
      return;
    }
    if (form.emailEnabled && !data?.config.hasResendApiKeyInEnv) {
      toast.error(
        "Per attivare l'invio aggiungi prima RESEND_API_KEY nel file .env del backend e riavvia il server"
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await saasAdminAPI.updateEmailPlatform({
        emailEnabled: form.emailEnabled,
        emailFrom: form.emailFrom.trim() || null,
      });
      setData(updated);
      toast.success("Configurazione email salvata");
    } catch (error) {
      console.error(error);
      toast.error(parseHttpErrorMessage(error, "Errore salvataggio"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail size={18} /> Configurazione email piattaforma (Resend)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          <strong>API key Resend</strong> solo nel file <code className="rounded bg-slate-100 px-1 text-xs">.env</code>{" "}
          del server (più sicuro). Qui configuri mittente e attivazione invio; i tenant impostano
          testi in Impostazioni.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500">Caricamento…</p>
        ) : data ? (
          <>
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                data.sendingReady
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
                  : "border-amber-200 bg-amber-50/60 text-amber-950"
              }`}
            >
              <p className="font-semibold">{data.hint}</p>
              {data.config.updatedAt && (
                <p className="mt-1 text-xs opacity-80">
                  Ultimo salvataggio UI: {formatDateTime(data.config.updatedAt)}
                  {data.config.updatedBy ? ` · ${data.config.updatedBy}` : ""}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
              <p className="font-medium text-slate-800">API key (solo .env)</p>
              {data.config.hasResendApiKeyInEnv ? (
                <p className="mt-1 text-xs text-emerald-800">
                  Rilevata sul server: <code>{data.config.resendApiKeyMasked}</code>
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-900">
                  Non configurata. Aggiungi nel backend{" "}
                  <code className="rounded bg-white/80 px-1">RESEND_API_KEY=re_…</code> e riavvia.
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.emailEnabled}
                onChange={(e) => setForm((f) => ({ ...f, emailEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
              />
              <span>
                <strong>Abilita invio email</strong> dalla piattaforma
              </span>
            </label>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="pe-from">
                Mittente (dominio verificato su Resend)
              </label>
              <input
                id="pe-from"
                className={inputFieldClass}
                placeholder="NS Cantieri <noreply@notifiche.tuodominio.it>"
                value={form.emailFrom}
                onChange={(e) => setForm((f) => ({ ...f, emailFrom: e.target.value }))}
              />
            </div>

            <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
              <li>Account Resend + verifica dominio (DNS).</li>
              <li>
                Nel <code className="rounded bg-slate-100 px-1">.env</code> del backend:{" "}
                <code>RESEND_API_KEY=re_…</code> → riavvio server.
              </li>
              <li>Qui: mittente + checkbox invio → Salva.</li>
            </ol>

            <Button
              type="button"
              variant="primary"
              disabled={saving}
              className="inline-flex items-center gap-2"
              onClick={() => void handleSave()}
            >
              <Save size={16} />
              {saving ? "Salvataggio…" : "Salva mittente e invio"}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
