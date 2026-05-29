import type { CheckoutFormData } from "@/config/checkoutForm";
import {
  SILICONE_ACRILICO_CUSTOMER_NOTICE,
  SILICONE_ACRILICO_FIELD_LABEL,
} from "@/config/checkoutForm";
import { modalInputFieldClass } from "@/components/layout/PageChrome";

type Props = {
  value: CheckoutFormData;
  onChange: (next: CheckoutFormData) => void;
  disabled?: boolean;
  /** Blocca modifica se il cantiere ha già un checkout precedente. */
  mountingStartReadOnly?: boolean;
};

export function CheckoutDigitalForm({
  value,
  onChange,
  disabled,
  mountingStartReadOnly = false,
}: Props) {
  const set = <K extends keyof CheckoutFormData>(key: K, v: CheckoutFormData[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="font-medium text-slate-700">Data inizio montaggio</span>
          <input
            type="date"
            className={modalInputFieldClass}
            value={value.dataInizioMontaggio}
            disabled={disabled || mountingStartReadOnly}
            onChange={(e) => set("dataInizioMontaggio", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="font-medium text-slate-700">Data fine montaggio</span>
          <input
            type="date"
            className={modalInputFieldClass}
            value={value.dataFineMontaggio}
            disabled={disabled}
            onChange={(e) => set("dataFineMontaggio", e.target.value)}
          />
        </label>
      </div>

      <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">
          Controllo serramenti in cantiere
        </legend>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5 active:bg-slate-50">
          <input
            type="radio"
            name="serramenti"
            disabled={disabled}
            className="mt-1 h-5 w-5 shrink-0 accent-brand"
            checked={value.serramentiControllo === "si_completo"}
            onChange={() => set("serramentiControllo", "si_completo")}
          />
          <span>Sì, tutti funzionali e privi di difetti</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5 active:bg-slate-50">
          <input
            type="radio"
            name="serramenti"
            disabled={disabled}
            className="mt-1 h-5 w-5 shrink-0 accent-brand"
            checked={value.serramentiControllo === "no_parziale"}
            onChange={() => set("serramentiControllo", "no_parziale")}
          />
          <span>No, controllo non completo (vedi note)</span>
        </label>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <YesNoField
          label="Vetri integri e privi di difetti?"
          value={value.vetriIntegri}
          disabled={disabled}
          onChange={(v) => set("vetriIntegri", v)}
        />
        <YesNoField
          label={SILICONE_ACRILICO_FIELD_LABEL}
          hint={SILICONE_ACRILICO_CUSTOMER_NOTICE}
          value={value.siliconeAcrilico}
          disabled={disabled}
          onChange={(v) => set("siliconeAcrilico", v)}
        />
      </div>

      <label className="block space-y-1">
        <span className="font-medium text-slate-700">Note montatore (modulo cliente)</span>
        <p className="text-xs text-slate-500">
          Testo che compare sul foglio fine lavori / PDF. Non è la stessa cosa delle note
          cantiere in scheda intervento.
        </p>
        <textarea
          className={modalInputFieldClass + " min-h-[88px]"}
          value={value.noteMontatore}
          disabled={disabled}
          onChange={(e) => set("noteMontatore", e.target.value)}
          placeholder="Es. lavori eseguiti, particolarità da far constare al cliente…"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-medium text-slate-700">Note cliente</span>
        <textarea
          className={modalInputFieldClass + " min-h-[72px]"}
          value={value.noteCliente}
          disabled={disabled}
          onChange={(e) => set("noteCliente", e.target.value)}
        />
      </label>
    </div>
  );
}

function YesNoField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold text-slate-800">{label}</legend>
      {hint ? (
        <p className="px-1 text-[11px] leading-snug text-slate-500">{hint}</p>
      ) : null}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 active:bg-slate-50">
        <input
          type="radio"
          disabled={disabled}
          className="h-5 w-5 shrink-0 accent-brand"
          checked={value === true}
          onChange={() => onChange(true)}
        />
        Sì
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 active:bg-slate-50">
        <input
          type="radio"
          disabled={disabled}
          className="h-5 w-5 shrink-0 accent-brand"
          checked={value === false}
          onChange={() => onChange(false)}
        />
        No
      </label>
    </fieldset>
  );
}
