import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { customerAPI } from "@/api/customers";
import type { Customer } from "@/types";
import { Button } from "@/components/ui/Button";
import { inputFieldClass } from "@/components/layout/PageChrome";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const MIN_SEARCH_LEN = 2;

type Props = {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  /** Cliente preimpostato (solo lettura). */
  locked?: Customer | null;
  disabled?: boolean;
  onCustomerSelected?: (customer: Customer) => void;
};

export default function CustomerPicker({
  value,
  onChange,
  locked,
  disabled = false,
  onCustomerSelected,
}: Props) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 400);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [creating, setCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    if (mode !== "existing" || debouncedSearch.length < MIN_SEARCH_LEN) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    void (async () => {
      try {
        const rows = await customerAPI.list({ q: debouncedSearch });
        if (!cancelled) setSearchResults(rows);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, mode]);

  const selectCustomer = (customer: Customer) => {
    onChange(customer);
    setSearchTerm(customer.name);
    onCustomerSelected?.(customer);
  };

  const createCustomer = async () => {
    if (!newCustomer.name.trim()) return false;
    setCreating(true);
    try {
      const created = await customerAPI.create({
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || undefined,
        email: newCustomer.email.trim() || undefined,
        address: newCustomer.address.trim() || undefined,
      });
      onChange(created);
      setSearchTerm(created.name);
      onCustomerSelected?.(created);
      setMode("existing");
      toast.success("Cliente creato");
      return true;
    } finally {
      setCreating(false);
    }
  };

  if (locked) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Cliente: </span>
        <span className="font-semibold text-slate-900">{locked.name}</span>
        {locked.phone ? (
          <span className="text-slate-600"> · {locked.phone}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === "existing" ? "primary" : "outline"}
          disabled={disabled}
          onClick={() => setMode("existing")}
          className="text-xs sm:text-sm"
        >
          Cliente esistente
        </Button>
        <Button
          type="button"
          variant={mode === "new" ? "primary" : "outline"}
          disabled={disabled}
          onClick={() => {
            setMode("new");
            onChange(null);
            setSearchTerm("");
          }}
          className="text-xs sm:text-sm"
        >
          Nuovo cliente
        </Button>
      </div>

      {value && mode === "existing" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
          Selezionato: <strong>{value.name}</strong>
          {value.phone ? ` · ${value.phone}` : ""}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setSearchTerm("");
            }}
            className="ml-2 text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            Cambia
          </button>
        </div>
      )}

      {mode === "existing" && !value && (
        <>
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Cerca cliente *
            </label>
            <input
              type="text"
              disabled={disabled}
              placeholder="Nome o telefono — ricerca automatica"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputFieldClass}
              aria-label="Cerca cliente"
            />
            {searching && (
              <Loader2
                size={18}
                className="absolute right-3 top-[calc(50%+0.5rem)] -translate-y-1/2 animate-spin text-slate-400"
              />
            )}
          </div>
          {searchTerm.length > 0 && searchTerm.length < MIN_SEARCH_LEN && (
            <p className="text-xs text-slate-500">Digita almeno 2 caratteri…</p>
          )}
          {debouncedSearch.length >= MIN_SEARCH_LEN &&
            !searching &&
            searchResults.length === 0 && (
              <p className="text-sm text-slate-600">
                Nessun cliente trovato. Passa a «Nuovo cliente» per crearlo ora.
              </p>
            )}
          {searchResults.length > 0 && (
            <ul className="max-h-48 divide-y overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
              {searchResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => selectCustomer(c)}
                  >
                    <div className="font-medium text-slate-900">{c.name}</div>
                    {(c.phone || c.address) && (
                      <div className="text-xs text-slate-500">
                        {[c.phone, c.address].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {mode === "new" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-xs font-medium text-slate-600">Anagrafica nuovo cliente</p>
          <input
            className={inputFieldClass}
            disabled={disabled}
            placeholder="Nome *"
            value={newCustomer.name}
            onChange={(e) =>
              setNewCustomer((p) => ({ ...p, name: e.target.value }))
            }
          />
          <input
            className={inputFieldClass}
            disabled={disabled}
            placeholder="Telefono"
            value={newCustomer.phone}
            onChange={(e) =>
              setNewCustomer((p) => ({ ...p, phone: e.target.value }))
            }
          />
          <input
            className={inputFieldClass}
            disabled={disabled}
            placeholder="Email"
            value={newCustomer.email}
            onChange={(e) =>
              setNewCustomer((p) => ({ ...p, email: e.target.value }))
            }
          />
          <input
            className={inputFieldClass}
            disabled={disabled}
            placeholder="Indirizzo"
            value={newCustomer.address}
            onChange={(e) =>
              setNewCustomer((p) => ({ ...p, address: e.target.value }))
            }
          />
          <Button
            type="button"
            variant="primary"
            disabled={disabled || creating || !newCustomer.name.trim()}
            onClick={() => void createCustomer()}
            className="w-full text-sm sm:w-auto"
          >
            {creating ? "Creazione…" : "Crea cliente"}
          </Button>
        </div>
      )}
    </div>
  );
}
