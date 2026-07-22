import type { Payment } from "@/types";
import { modalInputFieldClass } from "@/components/layout/PageChrome";
import { paymentAmountClass } from "@/utils/payments";

type Props = {
  payments: Payment[];
  onChange: (rows: Payment[]) => void;
  disabled?: boolean;
};

export function CheckoutPaymentsEditor({ payments, onChange, disabled }: Props) {
  const updateRow = (id: string, changes: Partial<Payment>) => {
    onChange(payments.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  };

  if (payments.length === 0) {
    return <p className="text-sm text-slate-500">Nessun pagamento registrato</p>;
  }

  return (
    <ul className="space-y-2">
      {payments.map((p) => (
        <li
          key={p.id}
          className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{p.label}</p>
              <p className={`text-sm font-semibold ${paymentAmountClass(p)}`}>
                {p.amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </p>
            </div>
            {p.collected ? (
              <span className="text-xs font-semibold text-green-700">Incassato</span>
            ) : p.partial && (p.collectedAmount ?? 0) > 0 ? (
              <span className="text-xs font-semibold text-amber-700">Parziale</span>
            ) : (
              <span className="text-xs font-semibold text-slate-500">Da incassare</span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 active:bg-slate-50">
              <input
                type="checkbox"
                checked={p.collected}
                disabled={disabled}
                onChange={(e) =>
                  updateRow(p.id, {
                    collected: e.target.checked,
                    partial: false,
                    collectedAmount: e.target.checked ? p.amount : 0,
                  })
                }
                className="h-5 w-5 shrink-0 rounded border-slate-300 accent-brand"
              />
              Incassato (totale)
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 active:bg-slate-50">
              <input
                type="checkbox"
                checked={p.partial && !p.collected}
                disabled={disabled}
                onChange={(e) =>
                  updateRow(p.id, {
                    collected: false,
                    partial: e.target.checked,
                    collectedAmount: e.target.checked ? p.collectedAmount || 0 : 0,
                  })
                }
                className="h-5 w-5 shrink-0 rounded border-slate-300 accent-brand"
              />
              Incasso parziale
            </label>
            {p.partial && !p.collected && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Importo incassato ora
                </label>
                <input
                  type="number"
                  min={0}
                  max={p.amount}
                  step="0.01"
                  disabled={disabled}
                  value={p.collectedAmount ?? ""}
                  onChange={(e) =>
                    updateRow(p.id, {
                      collectedAmount: parseFloat(e.target.value || "0"),
                    })
                  }
                  className={modalInputFieldClass + " w-full max-w-[10rem]"}
                />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
