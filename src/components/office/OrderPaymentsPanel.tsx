import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { OrderPayment } from "@/types";
import { orderPaymentAPI } from "@/api/orderPayments";
import {
  isOrderPaymentVisibleOnField,
  parseMoneyAmount,
  paymentAmountClass,
} from "@/utils/payments";
import { inputFieldClass } from "@/components/layout/PageChrome";
import toast from "react-hot-toast";
import { Plus, Save, X } from "lucide-react";

type Props = {
  orderId: string;
  payments: OrderPayment[];
  onChange: (payments: OrderPayment[]) => void;
};

type PaymentDraft = Omit<OrderPayment, "amount"> & { amount: string };

function paymentsToDraft(payments: OrderPayment[]): PaymentDraft[] {
  return payments.map((p) => ({
    ...p,
    amount: p.amount > 0 ? String(p.amount) : "",
  }));
}

export default function OrderPaymentsPanel({ orderId, payments, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PaymentDraft[]>(paymentsToDraft(payments));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(paymentsToDraft(payments));
  }, [payments, editing]);

  const startEdit = () => {
    setDraft(paymentsToDraft(payments));
    setEditing(true);
  };

  const save = async () => {
    const parsedRows = draft
      .map((p) => {
        const amount = parseMoneyAmount(p.amount);
        if (amount == null || amount <= 0) return null;
        return {
          label: p.label.trim() || "Pagamento",
          amount,
          collected: p.collected,
          partial: p.partial,
          collectedAmount: p.collected ? amount : p.collectedAmount ?? 0,
          showOnField: p.showOnField !== false,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (draft.some((row) => row.amount.trim() && parseMoneyAmount(row.amount) == null)) {
      toast.error("Controlla gli importi dei pagamenti");
      return;
    }

    if (draft.some((row) => row.amount.trim() && (parseMoneyAmount(row.amount) ?? 0) <= 0)) {
      toast.error("Gli importi devono essere maggiori di zero");
      return;
    }

    try {
      setSaving(true);
      const fresh = await orderPaymentAPI.bulkReplace(orderId, parsedRows);
      onChange(fresh);
      setEditing(false);
      toast.success("Pagamenti commessa salvati");
    } catch (err) {
      console.error(err);
      toast.error("Errore salvataggio pagamenti");
    } finally {
      setSaving(false);
    }
  };

  const toggleHideOnField = async (paymentId: string, hide: boolean) => {
    try {
      const updated = await orderPaymentAPI.setHiddenOnField(paymentId, hide);
      onChange(payments.map((p) => (p.id === paymentId ? updated : p)));
    } catch (err) {
      console.error(err);
      toast.error("Errore aggiornamento visibilità");
    }
  };

  const list = editing ? draft : payments;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Piano pagamenti commessa (solo ufficio). Di default visibili in cantiere;
          spunta &quot;Nascondi in cantiere&quot; per acconti già incassati o voci
          riservate all&apos;ufficio.
        </p>
        {!editing ? (
          <Button type="button" variant="outline" onClick={startEdit} className="text-sm">
            Modifica
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
              className="text-sm"
            >
              <X size={14} /> Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => void save()}
              className="text-sm"
            >
              <Save size={14} /> Salva
            </Button>
          </div>
        )}
      </div>

      {list.length === 0 && !editing ? (
        <p className="text-sm text-slate-500">Nessun pagamento sulla commessa.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm"
            >
              {editing ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className={inputFieldClass}
                    value={p.label}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev.map((row) =>
                          row.id === p.id ? { ...row, label: e.target.value } : row
                        )
                      )
                    }
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputFieldClass}
                    placeholder="€"
                    value={p.amount}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev.map((row) =>
                          row.id === p.id
                            ? {
                                ...row,
                                amount: e.target.value,
                              }
                            : row
                        )
                      )
                    }
                  />
                  <label className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={p.collected}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((row) =>
                            row.id === p.id
                              ? {
                                  ...row,
                                  collected: e.target.checked,
                                  partial: false,
                                  collectedAmount: e.target.checked
                                    ? parseMoneyAmount(row.amount) ?? 0
                                    : 0,
                                  showOnField: e.target.checked
                                    ? false
                                    : row.showOnField,
                                }
                              : row
                          )
                        )
                      }
                    />
                    Già incassato
                  </label>
                  <label className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={p.showOnField === false}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((row) =>
                            row.id === p.id
                              ? { ...row, showOnField: !e.target.checked }
                              : row
                          )
                        )
                      }
                    />
                    Nascondi in cantiere
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {p.label} —{" "}
                      <span className={`font-bold ${paymentAmountClass(p)}`}>
                        {p.amount.toLocaleString("it-IT", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </span>
                    <span className="text-xs">
                      {p.collected ? (
                        <span className="font-semibold text-green-700">Incassato</span>
                      ) : p.partial ? (
                        <span className="font-semibold text-yellow-600">Parziale</span>
                      ) : (
                        <span className="font-semibold text-red-600">Da incassare</span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {!isOrderPaymentVisibleOnField(p) && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                        Nascosto in cantiere
                      </span>
                    )}
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={!isOrderPaymentVisibleOnField(p)}
                        onChange={(e) =>
                          void toggleHideOnField(p.id, e.target.checked)
                        }
                      />
                      Nascondi in cantiere
                    </label>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setDraft((prev) => [
              ...prev,
              {
                id: `tmp-${Date.now()}`,
                jobOrderId: orderId,
                label: "Nuovo pagamento",
                amount: "",
                collected: false,
                partial: false,
                collectedAmount: 0,
                showOnField: true,
              },
            ])
          }
          className="inline-flex items-center gap-2 text-sm"
        >
          <Plus size={14} /> Aggiungi riga
        </Button>
      )}
    </div>
  );
}
