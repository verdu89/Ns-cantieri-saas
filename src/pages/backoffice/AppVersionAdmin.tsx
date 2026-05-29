import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  History,
  Info,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  fetchAdminAndroidVersion,
  updateAdminAndroidVersion,
  type AndroidVersionRecord,
} from "@/api/appVersionAdmin";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { PageHeader, inputFieldClass } from "@/components/layout/PageChrome";
import { formatDateTime } from "@/utils/date";

type FormState = {
  latestVersionCode: string;
  latestVersionName: string;
  minimumVersionCode: string;
  releaseNotes: string;
  playStoreUrl: string;
};

const DEFAULT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.saverplast.nscantieri";

function emptyForm(): FormState {
  return {
    latestVersionCode: "",
    latestVersionName: "",
    minimumVersionCode: "",
    releaseNotes: "",
    playStoreUrl: "",
  };
}

function recordToForm(record: AndroidVersionRecord | null): FormState {
  if (!record) return emptyForm();
  return {
    latestVersionCode: String(record.latestVersionCode),
    latestVersionName: record.latestVersionName ?? "",
    minimumVersionCode:
      record.minimumVersionCode != null
        ? String(record.minimumVersionCode)
        : "",
    /** Note: textarea vuota → si conservano quelle attive (vedi handleSave). */
    releaseNotes: "",
    playStoreUrl: record.playStoreUrl ?? "",
  };
}

function parseApiError(e: unknown): string {
  if (!(e instanceof Error)) return "Operazione non riuscita.";
  const raw = e.message;
  if (raw.includes("Failed to fetch")) {
    return "Impossibile contattare il server. Controlla la rete e il backend.";
  }
  if (!raw.includes(":")) return raw;
  const colon = raw.indexOf(":");
  const status = raw.slice(0, colon).trim();
  const bodyRaw = raw.slice(colon + 1).trim();
  if (status === "403")
    return "Non autorizzato: serve account Super Admin piattaforma.";
  if (status === "401") return "Sessione non valida: rifai il login.";
  try {
    const j = JSON.parse(bodyRaw) as {
      message?: string;
      issues?: { path?: (string | number)[]; message?: string }[];
    };
    if (j.message) {
      if (status === "400" && j.issues?.length) {
        const first = j.issues[0];
        const path = first.path?.filter(Boolean).join(".") ?? "";
        const detail = first.message ?? "";
        if (path && detail) return `${j.message}: ${path} — ${detail}`;
        if (detail) return `${j.message}: ${detail}`;
      }
      return j.message;
    }
  } catch {
    /* ignore */
  }
  return bodyRaw || raw;
}

/** Valori "decisi" dall'admin che la simulazione confronterà col device fittizio. */
type Decision = {
  latestVersionCode: number;
  latestVersionName: string;
  minimumVersionCode: number | null;
  releaseNotes: string;
};

type SimOutcome =
  | { kind: "incomplete"; reason: string }
  | { kind: "uptodate"; latest: number }
  | { kind: "optional"; latest: number; gap: number }
  | { kind: "mandatory"; latest: number; minimum: number };

function evaluateSimulation(
  installed: number,
  decision: Decision | null
): SimOutcome {
  if (!decision || !Number.isFinite(decision.latestVersionCode)) {
    return { kind: "incomplete", reason: "Manca l'ultima versione disponibile." };
  }
  if (!Number.isFinite(installed) || installed < 1) {
    return {
      kind: "incomplete",
      reason: "Inserisci un versionCode installato valido (intero ≥ 1).",
    };
  }
  if (installed >= decision.latestVersionCode) {
    return { kind: "uptodate", latest: decision.latestVersionCode };
  }
  if (
    decision.minimumVersionCode != null &&
    installed < decision.minimumVersionCode
  ) {
    return {
      kind: "mandatory",
      latest: decision.latestVersionCode,
      minimum: decision.minimumVersionCode,
    };
  }
  return {
    kind: "optional",
    latest: decision.latestVersionCode,
    gap: decision.latestVersionCode - installed,
  };
}

export default function AppVersionAdminPage() {
  const [current, setCurrent] = useState<AndroidVersionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [simInstalled, setSimInstalled] = useState<string>("");
  /** Quale set di valori sta verificando il simulatore: SERVER attivo o BOZZA non salvata. */
  const [simSource, setSimSource] = useState<"server" | "draft">("server");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchAdminAndroidVersion();
        if (!active) return;
        setCurrent(r);
        setForm(recordToForm(r));
        if (r?.latestVersionCode) {
          setSimInstalled(String(Math.max(1, r.latestVersionCode - 1)));
        } else {
          setSimInstalled("1");
        }
      } catch (e) {
        toast.error(parseApiError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const validation = useMemo(() => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    const latest = Number(form.latestVersionCode);
    if (!Number.isFinite(latest) || latest < 1) {
      errors.latestVersionCode = "Versione obbligatoria, intero ≥ 1.";
    }
    if (form.minimumVersionCode.trim() !== "") {
      const minimum = Number(form.minimumVersionCode);
      if (!Number.isFinite(minimum) || minimum < 1) {
        errors.minimumVersionCode = "Intero ≥ 1 oppure vuoto.";
      } else if (Number.isFinite(latest) && minimum > latest) {
        errors.minimumVersionCode =
          "Versione minima non può superare l'ultima.";
      }
    }
    if (form.playStoreUrl.trim() !== "") {
      try {
        const u = new URL(form.playStoreUrl);
        if (!/^https?:$/.test(u.protocol)) {
          errors.playStoreUrl = "URL non valido.";
        }
      } catch {
        errors.playStoreUrl = "URL non valido.";
      }
    }
    return errors;
  }, [form]);

  const hasErrors = Object.keys(validation).length > 0;

  const isDirty = useMemo(() => {
    const notesTouched =
      form.releaseNotes.trim() !== "" &&
      form.releaseNotes.trim() !== (current?.releaseNotes ?? "").trim();
    if (!current) {
      return (
        form.latestVersionCode !== "" ||
        form.latestVersionName !== "" ||
        form.minimumVersionCode !== "" ||
        notesTouched ||
        form.playStoreUrl !== ""
      );
    }
    return (
      form.latestVersionCode !== String(current.latestVersionCode) ||
      form.latestVersionName !== (current.latestVersionName ?? "") ||
      form.minimumVersionCode !==
        (current.minimumVersionCode != null
          ? String(current.minimumVersionCode)
          : "") ||
      notesTouched ||
      form.playStoreUrl !== (current.playStoreUrl ?? "")
    );
  }, [current, form]);

  /** Decisione "server" attiva ora sugli APK in produzione. */
  const serverDecision: Decision | null = useMemo(() => {
    if (!current) return null;
    return {
      latestVersionCode: current.latestVersionCode,
      latestVersionName: current.latestVersionName ?? "",
      minimumVersionCode: current.minimumVersionCode ?? null,
      releaseNotes: current.releaseNotes ?? "",
    };
  }, [current]);

  /** Decisione "bozza": ciò che verrà salvato premendo Pubblica. */
  const draftDecision: Decision | null = useMemo(() => {
    const latest = Number(form.latestVersionCode);
    if (!Number.isFinite(latest) || latest < 1) return null;
    const minimumRaw = form.minimumVersionCode.trim();
    const minimum =
      minimumRaw === "" ? null : Number(minimumRaw);
    return {
      latestVersionCode: latest,
      latestVersionName: form.latestVersionName.trim(),
      minimumVersionCode:
        minimum != null && Number.isFinite(minimum) ? minimum : null,
      releaseNotes:
        form.releaseNotes.trim() !== ""
          ? form.releaseNotes.trim()
          : (current?.releaseNotes ?? ""),
    };
  }, [form, current]);

  const activeDecision =
    simSource === "server" ? serverDecision : draftDecision;
  const simInstalledNum = Number(simInstalled);
  const simOutcome = evaluateSimulation(simInstalledNum, activeDecision);

  async function handleSave() {
    if (hasErrors) {
      toast.error("Correggi i campi evidenziati prima di salvare.");
      return;
    }
    setSaving(true);
    try {
      const trimmedNotes = form.releaseNotes.trim();
      const releaseNotesPayload =
        trimmedNotes === "" ? (current?.releaseNotes ?? null) : trimmedNotes;
      const updated = await updateAdminAndroidVersion({
        latestVersionCode: Number(form.latestVersionCode),
        latestVersionName: form.latestVersionName.trim() || null,
        minimumVersionCode:
          form.minimumVersionCode.trim() === ""
            ? null
            : Number(form.minimumVersionCode),
        releaseNotes: releaseNotesPayload,
        playStoreUrl: form.playStoreUrl.trim() || null,
      });
      setCurrent(updated);
      setForm(recordToForm(updated));
      toast.success("Versione app pubblicata.");
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    setLoading(true);
    try {
      const r = await fetchAdminAndroidVersion();
      setCurrent(r);
      setForm(recordToForm(r));
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }

  function handleResetForm() {
    setForm(recordToForm(current));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Aggiornamento app"
        description="Decidi quale versione dell'app Android è la 'minima accettata' e quale è l'ultima disponibile. Gli APK installati ricevono di conseguenza la modale 'Aggiorna ora'."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleReload()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
              aria-hidden
            />
            Ricarica
          </Button>
        }
      />

      <CurrentValuesPanel current={current} loading={loading} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone size={20} className="text-[var(--ns-brand)]" />
              Pubblica una nuova versione
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Compila i campi e premi <strong>Pubblica subito</strong>. Le
              modifiche sono immediate: nessun riavvio del backend, nessun
              rebuild dell'app.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Ultima versione disponibile *"
                hint="versionCode Android dell'APK appena caricato sul Play Store. Numero intero."
                error={validation.latestVersionCode}
              >
                <input
                  className={inputFieldClass}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.latestVersionCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      latestVersionCode: e.target.value,
                    }))
                  }
                  disabled={loading || saving}
                />
              </Field>

              <Field
                label="Nome versione"
                hint="Mostrato all'utente nella modale (es. 1.0.7). Facoltativo."
              >
                <input
                  className={inputFieldClass}
                  value={form.latestVersionName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      latestVersionName: e.target.value,
                    }))
                  }
                  placeholder="1.0.7"
                  disabled={loading || saving}
                />
              </Field>

              <Field
                label="Versione minima richiesta"
                hint="Sotto questo versionCode la modale diventa bloccante (no 'Continua per ora'). Vuoto = mai bloccante."
                error={validation.minimumVersionCode}
              >
                <input
                  className={inputFieldClass}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.minimumVersionCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minimumVersionCode: e.target.value,
                    }))
                  }
                  placeholder="es. 6"
                  disabled={loading || saving}
                />
              </Field>

              <Field
                label="URL Play Store"
                hint="Lascia vuoto per usare il default."
                error={validation.playStoreUrl}
              >
                <input
                  className={inputFieldClass}
                  value={form.playStoreUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, playStoreUrl: e.target.value }))
                  }
                  placeholder={DEFAULT_PLAY_STORE_URL}
                  disabled={loading || saving}
                />
              </Field>

              <Field
                label="Nuove note di rilascio"
                className="sm:col-span-2"
                hint="Lascia vuoto per mantenere le note attuali. Scrivi un nuovo testo per sostituirle."
              >
                <textarea
                  className={`${inputFieldClass} min-h-[96px] resize-y`}
                  value={form.releaseNotes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, releaseNotes: e.target.value }))
                  }
                  placeholder="Cosa cambia in questa release…"
                  disabled={loading || saving}
                />
              </Field>
            </div>

            {isDirty ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
                <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  Hai modifiche non ancora pubblicate. Gli APK continueranno a
                  ricevere i valori attuali finché non premi{" "}
                  <strong>Pubblica subito</strong>.
                </span>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetForm}
                disabled={loading || saving || !isDirty}
              >
                Annulla modifiche
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSave()}
                disabled={loading || saving || hasErrors || !isDirty}
                className="gap-2"
              >
                <Sparkles size={16} aria-hidden />
                {saving ? "Pubblicazione…" : "Pubblica subito"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle size={20} className="text-[var(--ns-brand)]" />
              Verifica scenari
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Scegli un&apos;ipotetica versione installata su un telefono e
              guarda cosa vedrebbe l&apos;utente.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <SimSourceToggle
              value={simSource}
              onChange={setSimSource}
              hasDraft={isDirty}
              draftValid={!hasErrors && draftDecision != null}
            />

            <SimInstalledField
              value={simInstalled}
              onChange={setSimInstalled}
              decision={activeDecision}
            />

            <SimResult outcome={simOutcome} />

            {simOutcome.kind === "optional" ||
            simOutcome.kind === "mandatory" ? (
              <ModalPreviewCard
                latestVersionCode={activeDecision!.latestVersionCode}
                latestVersionName={activeDecision!.latestVersionName}
                mandatory={simOutcome.kind === "mandatory"}
                releaseNotes={activeDecision!.releaseNotes}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? ""}>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function CurrentValuesPanel({
  current,
  loading,
}: {
  current: AndroidVersionRecord | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="bg-gradient-to-br from-slate-50 to-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <History size={20} className="text-slate-500" />
            Cosa serve oggi agli APK
          </CardTitle>
          {current?.updatedAt ? (
            <span className="text-xs text-slate-500">
              Aggiornato il {formatDateTime(current.updatedAt)}
              {current.updatedBy ? ` da ${current.updatedBy}` : ""}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading && !current ? (
          <p className="text-sm text-slate-500">Caricamento…</p>
        ) : !current ? (
          <p className="text-sm text-slate-600">
            Nessuna versione ancora configurata. Compila il form sotto e premi{" "}
            <strong>Pubblica subito</strong> per attivare la modale "Aggiorna
            ora" sugli APK.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatTile
              tone="brand"
              label="Ultima disponibile"
              big={String(current.latestVersionCode)}
              sub={
                current.latestVersionName
                  ? `versionName ${current.latestVersionName}`
                  : "versionCode Android"
              }
            />
            <StatTile
              tone={current.minimumVersionCode != null ? "warning" : "muted"}
              label="Minima richiesta"
              big={
                current.minimumVersionCode != null
                  ? String(current.minimumVersionCode)
                  : "—"
              }
              sub={
                current.minimumVersionCode != null
                  ? "Sotto questa: aggiornamento obbligatorio"
                  : "Nessun aggiornamento obbligatorio"
              }
            />
            <StatTile
              tone={current.minimumVersionCode != null ? "warning" : "ok"}
              label="Comportamento attuale"
              big={
                current.minimumVersionCode != null
                  ? "Bloccante"
                  : "Soft update"
              }
              sub={
                current.minimumVersionCode != null
                  ? "Gli APK sotto la minima non possono usare l'app"
                  : "L'utente può sempre continuare per ora"
              }
            />
            <div className="md:col-span-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Note di rilascio attive
              </p>
              <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                {current.releaseNotes?.trim() ? (
                  current.releaseNotes
                ) : (
                  <span className="italic text-slate-400">
                    Nessuna nota impostata
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  big,
  sub,
  tone,
}: {
  label: string;
  big: string;
  sub?: string;
  tone: "brand" | "ok" | "warning" | "muted";
}) {
  const palette: Record<typeof tone, string> = {
    brand:
      "border-orange-200 bg-orange-50/70 text-orange-900 ring-orange-200/60",
    ok: "border-emerald-200 bg-emerald-50/70 text-emerald-900 ring-emerald-200/60",
    warning:
      "border-amber-200 bg-amber-50/70 text-amber-900 ring-amber-200/60",
    muted: "border-slate-200 bg-slate-50/70 text-slate-700 ring-slate-200/60",
  };
  return (
    <div
      className={`rounded-2xl border p-3 ring-1 ${palette[tone]}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold leading-tight">{big}</p>
      {sub ? <p className="mt-1 text-xs opacity-80">{sub}</p> : null}
    </div>
  );
}

function SimSourceToggle({
  value,
  onChange,
  hasDraft,
  draftValid,
}: {
  value: "server" | "draft";
  onChange: (v: "server" | "draft") => void;
  hasDraft: boolean;
  draftValid: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Confronta con
      </p>
      <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => onChange("server")}
          className={`flex-1 rounded-lg px-3 py-1.5 transition ${
            value === "server"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Server attivo
        </button>
        <button
          type="button"
          onClick={() => onChange("draft")}
          disabled={!hasDraft || !draftValid}
          className={`flex-1 rounded-lg px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
            value === "draft"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
          title={
            !hasDraft
              ? "Nessuna modifica in bozza da verificare"
              : !draftValid
                ? "Correggi gli errori del form per simulare la bozza"
                : undefined
          }
        >
          Bozza non salvata
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {value === "server"
          ? "Stai vedendo cosa succede agli APK ORA, con i valori realmente pubblicati."
          : "Stai vedendo cosa succederebbe DOPO il salvataggio della bozza in alto."}
      </p>
    </div>
  );
}

function SimInstalledField({
  value,
  onChange,
  decision,
}: {
  value: string;
  onChange: (v: string) => void;
  decision: Decision | null;
}) {
  const presets: { label: string; value: number; hint: string }[] = useMemo(() => {
    if (!decision) return [];
    const out: { label: string; value: number; hint: string }[] = [];
    out.push({
      label: "= ultima",
      value: decision.latestVersionCode,
      hint: "APK già aggiornato",
    });
    if (decision.latestVersionCode > 1) {
      out.push({
        label: "ultima − 1",
        value: decision.latestVersionCode - 1,
        hint: "APK appena indietro",
      });
    }
    if (decision.minimumVersionCode != null) {
      if (decision.minimumVersionCode > 1) {
        out.push({
          label: "minima − 1",
          value: decision.minimumVersionCode - 1,
          hint: "APK bloccato",
        });
      }
      out.push({
        label: "= minima",
        value: decision.minimumVersionCode,
        hint: "APK al limite",
      });
    } else if (decision.latestVersionCode > 2) {
      out.push({
        label: "molto vecchio",
        value: 1,
        hint: "APK molto indietro",
      });
    }
    return out;
  }, [decision]);

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        versionCode installato sul telefono fittizio
      </label>
      <input
        className={inputFieldClass}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1 text-xs text-slate-500">
        Numero che identifica una versione installata su un dispositivo. Lo
        scegli liberamente: è solo per la simulazione, non cambia nulla in
        produzione.
      </p>
      {presets.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={`${p.label}-${p.value}`}
              type="button"
              onClick={() => onChange(String(p.value))}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              title={p.hint}
            >
              <span className="text-slate-500">{p.label}</span>
              <span className="font-mono font-semibold text-slate-900">
                {p.value}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SimResult({ outcome }: { outcome: SimOutcome }) {
  if (outcome.kind === "incomplete") {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span>{outcome.reason}</span>
      </div>
    );
  }
  if (outcome.kind === "uptodate") {
    return (
      <ResultBanner
        tone="ok"
        icon={<CheckCircle2 size={18} aria-hidden />}
        title="Nessuna modale"
        message={`L'APK è già allineato (versionCode ≥ ${outcome.latest}). Non viene mostrato nulla.`}
      />
    );
  }
  if (outcome.kind === "optional") {
    return (
      <ResultBanner
        tone="info"
        icon={<AlertTriangle size={18} aria-hidden />}
        title="Modale di aggiornamento (opzionale)"
        message={`L'APK è ${outcome.gap} versione/i indietro rispetto alla ${outcome.latest}. L'utente può comunque scegliere "Continua per ora".`}
      />
    );
  }
  return (
    <ResultBanner
      tone="danger"
      icon={<ShieldAlert size={18} aria-hidden />}
      title="Modale obbligatoria (bloccante)"
      message={`L'APK è sotto la versione minima ${outcome.minimum}: l'utente deve aggiornare per continuare a usare l'app.`}
    />
  );
}

function ResultBanner({
  tone,
  icon,
  title,
  message,
}: {
  tone: "ok" | "info" | "danger";
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  const palette: Record<typeof tone, string> = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
    info: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-red-300 bg-red-50 text-red-900",
  };
  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${palette[tone]}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed opacity-90">{message}</p>
      </div>
    </div>
  );
}

function ModalPreviewCard({
  latestVersionCode,
  latestVersionName,
  mandatory,
  releaseNotes,
}: {
  latestVersionCode: number;
  latestVersionName: string;
  mandatory: boolean;
  releaseNotes: string;
}) {
  const targetName = latestVersionName || String(latestVersionCode);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Cosa vedrebbe l&apos;utente
      </p>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100/90">
                Ns-cantieri
              </p>
              <h4 className="text-sm font-semibold leading-tight">
                Aggiornamento disponibile
              </h4>
            </div>
          </div>
        </div>
        <div className="space-y-3 px-4 py-3 text-xs text-slate-700">
          <p className="leading-relaxed">
            È disponibile una nuova versione dell&apos;app (
            <span className="font-semibold text-slate-900">{targetName}</span>
            ). Aggiorna per continuare a usare al meglio Ns-cantieri.
          </p>
          {releaseNotes ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Novità di questa versione
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">
                {releaseNotes}
              </p>
            </div>
          ) : null}
          {mandatory ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700">
              Questo aggiornamento è necessario per continuare a usare
              l&apos;app.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          {!mandatory ? (
            <span className="text-xs font-medium text-slate-500">
              Continua per ora
            </span>
          ) : null}
          <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
            <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden />
            Aggiorna ora
          </span>
        </div>
      </div>
    </div>
  );
}
