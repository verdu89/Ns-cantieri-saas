import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";

import { customerAPI } from "@/api/customers";
import { jobOrderAPI } from "@/api/jobOrders";
import { jobAPI } from "@/api/jobs";
import { assistenzaAPI } from "@/api/assistenza";
import type { Customer, Job, JobOrder, JobTitle } from "@/types";
import { ASSISTENZA_TITLE } from "@/config/assistenzaConfig";
import { JOB_TITLE_SELECT_OPTIONS } from "@/config/jobTitles";
import { Button } from "@/components/ui/Button";
import {
  PageHeader,
  inputFieldClass,
  selectFieldClass,
  surfaceCardClass,
} from "@/components/layout/PageChrome";
import { toDbDate } from "@/utils/date";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const MIN_SEARCH_LEN = 2;

type Step = "customer" | "order" | "job";

export default function NewJob() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCustomerId = searchParams.get("customerId") ?? "";
  const presetTitle = (searchParams.get("title") as JobTitle) || ASSISTENZA_TITLE;

  const [step, setStep] = useState<Step>("customer");
  const [saving, setSaving] = useState(false);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    presetCustomerId ? "existing" : "existing"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 400);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [orderId, setOrderId] = useState("");
  const [newOrderCode, setNewOrderCode] = useState("");
  const [newOrderAddress, setNewOrderAddress] = useState("");
  const [createNewOrder, setCreateNewOrder] = useState(false);

  const [title, setTitle] = useState<JobTitle>(presetTitle);
  const [notes, setNotes] = useState("");
  const [plannedLocal, setPlannedLocal] = useState("");
  const [openWarnings, setOpenWarnings] = useState<
    Awaited<ReturnType<typeof assistenzaAPI.openByCustomer>>["items"]
  >([]);

  const loadCustomer = useCallback(async (id: string) => {
    const row = await customerAPI.getById(id);
    if (row) {
      setCustomer(row);
      setStep("order");
      const ords = await jobOrderAPI.listByCustomer(id);
      setOrders(ords);
      if (ords.length === 1) setOrderId(ords[0].id);
    }
  }, []);

  useEffect(() => {
    if (presetCustomerId) void loadCustomer(presetCustomerId);
  }, [presetCustomerId, loadCustomer]);

  useEffect(() => {
    if (!customer?.id || title !== ASSISTENZA_TITLE) {
      setOpenWarnings([]);
      return;
    }
    void assistenzaAPI
      .openByCustomer({ customerId: customer.id, phone: customer.phone })
      .then((r) => setOpenWarnings(r.items))
      .catch(() => setOpenWarnings([]));
  }, [customer, title]);

  useEffect(() => {
    if (customerMode !== "existing" || debouncedSearch.length < MIN_SEARCH_LEN) {
      setSearchResults([]);
      setSearchingCustomer(false);
      return;
    }
    let cancelled = false;
    setSearchingCustomer(true);
    void (async () => {
      try {
        const rows = await customerAPI.list({ q: debouncedSearch });
        if (!cancelled) setSearchResults(rows);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchingCustomer(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, customerMode]);

  const saveNewCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast.error("Nome cliente obbligatorio");
      return;
    }
    setSaving(true);
    try {
      const created = await customerAPI.create({
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || undefined,
        email: newCustomer.email.trim() || undefined,
        address: newCustomer.address.trim() || undefined,
      });
      setCustomer(created);
      setOrders([]);
      setCreateNewOrder(true);
      setNewOrderAddress(created.address ?? "");
      setStep("order");
      toast.success("Cliente creato");
    } catch {
      toast.error("Errore creazione cliente");
    } finally {
      setSaving(false);
    }
  };

  const goToJobStep = () => {
    if (!customer) return;
    if (createNewOrder) {
      if (!newOrderCode.trim() || !newOrderAddress.trim()) {
        toast.error("Codice commessa e indirizzo obbligatori");
        return;
      }
    } else if (!orderId) {
      toast.error("Seleziona una commessa");
      return;
    }
    setStep("job");
  };

  const submitJob = async () => {
    if (!customer) return;
    if (!title) {
      toast.error("Seleziona la tipologia intervento");
      return;
    }

    setSaving(true);
    try {
      let targetOrderId = orderId;

      if (createNewOrder) {
        const order = await jobOrderAPI.create({
          code: newOrderCode.trim(),
          customerId: customer.id,
          location: { address: newOrderAddress.trim() },
          notes: "",
        });
        targetOrderId = order.id;
      }

      const order = await jobOrderAPI.getById(targetOrderId);
      const created = await jobAPI.create({
        jobOrderId: targetOrderId,
        createdAt: new Date().toISOString(),
        title,
        status: "in_attesa_programmazione",
        assignedWorkers: [],
        notes: notes.trim(),
        location: order?.location ?? { address: newOrderAddress },
        plannedDate: plannedLocal ? toDbDate(plannedLocal) : null,
        files: [],
      } as Omit<Job, "id" | "events" | "payments" | "docs" | "team" | "customer">);

      toast.success("Intervento creato");
      navigate(`/backoffice/jobs/${created.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Errore durante la creazione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Nuovo intervento"
        description="Cliente → commessa → intervento. Per l'assistenza post-vendita la tipologia è preimpostata."
      />

      <div className="flex gap-2 text-xs font-medium text-slate-500">
        <span className={step === "customer" ? "text-brand" : ""}>1. Cliente</span>
        <span>→</span>
        <span className={step === "order" ? "text-brand" : ""}>2. Commessa</span>
        <span>→</span>
        <span className={step === "job" ? "text-brand" : ""}>3. Intervento</span>
      </div>

      {step === "customer" && (
        <div className={`space-y-4 p-5 ${surfaceCardClass}`}>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={customerMode === "existing" ? "primary" : "outline"}
              onClick={() => setCustomerMode("existing")}
            >
              Cliente esistente
            </Button>
            <Button
              type="button"
              variant={customerMode === "new" ? "primary" : "outline"}
              onClick={() => setCustomerMode("new")}
            >
              Nuovo cliente
            </Button>
          </div>

          {customerMode === "existing" ? (
            <>
              <div className="relative">
                <input
                  className={inputFieldClass}
                  placeholder="Nome o telefono — ricerca automatica"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Cerca cliente"
                />
                {searchingCustomer && (
                  <Loader2
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                  />
                )}
              </div>
              {debouncedSearch.length > 0 &&
                debouncedSearch.length < MIN_SEARCH_LEN && (
                  <p className="text-xs text-slate-500">Digita almeno 2 caratteri…</p>
                )}
              {debouncedSearch.length >= MIN_SEARCH_LEN &&
                !searchingCustomer &&
                searchResults.length === 0 && (
                  <p className="text-sm font-medium text-slate-600">
                    Cliente esistente non trovato. Puoi passare a «Nuovo cliente».
                  </p>
                )}
              <ul className="divide-y rounded-lg border">
                {searchResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => void loadCustomer(c.id)}
                    >
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="space-y-3">
              <input
                className={inputFieldClass}
                placeholder="Nome *"
                value={newCustomer.name}
                onChange={(e) =>
                  setNewCustomer((p) => ({ ...p, name: e.target.value }))
                }
              />
              <input
                className={inputFieldClass}
                placeholder="Telefono"
                value={newCustomer.phone}
                onChange={(e) =>
                  setNewCustomer((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <input
                className={inputFieldClass}
                placeholder="Email"
                value={newCustomer.email}
                onChange={(e) =>
                  setNewCustomer((p) => ({ ...p, email: e.target.value }))
                }
              />
              <input
                className={inputFieldClass}
                placeholder="Indirizzo"
                value={newCustomer.address}
                onChange={(e) =>
                  setNewCustomer((p) => ({ ...p, address: e.target.value }))
                }
              />
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => void saveNewCustomer()}
              >
                Crea cliente e continua
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "order" && customer && (
        <div className={`space-y-4 p-5 ${surfaceCardClass}`}>
          <p className="text-sm">
            Cliente: <strong>{customer.name}</strong>
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>

          {orders.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!createNewOrder}
                onChange={() => setCreateNewOrder(false)}
              />
              Commessa esistente
            </label>
          )}
          {!createNewOrder && orders.length > 0 && (
            <select
              className={selectFieldClass}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">Seleziona commessa</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code}
                  {o.location?.address ? ` — ${o.location.address}` : ""}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={createNewOrder || orders.length === 0}
              onChange={() => setCreateNewOrder(true)}
            />
            Nuova commessa
          </label>
          {(createNewOrder || orders.length === 0) && (
            <div className="space-y-2">
              <input
                className={inputFieldClass}
                placeholder="Codice commessa *"
                value={newOrderCode}
                onChange={(e) => setNewOrderCode(e.target.value)}
              />
              <input
                className={inputFieldClass}
                placeholder="Indirizzo cantiere *"
                value={newOrderAddress}
                onChange={(e) => setNewOrderAddress(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("customer")}>
              Indietro
            </Button>
            <Button type="button" variant="primary" onClick={goToJobStep}>
              Avanti
            </Button>
          </div>
        </div>
      )}

      {step === "job" && customer && (
        <div className={`space-y-4 p-5 ${surfaceCardClass}`}>
          {title === ASSISTENZA_TITLE && openWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="flex items-center gap-1 font-semibold">
                <AlertTriangle size={16} />
                Attenzione: assistenze già aperte per questo cliente
              </p>
              <ul className="mt-2 list-disc pl-5">
                {openWarnings.map((j) => (
                  <li key={j.id}>
                    <Link
                      to={`/backoffice/jobs/${j.id}`}
                      className="text-brand underline"
                    >
                      Commessa {j.orderCode}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Tipologia *
          </label>
          <select
            className={selectFieldClass}
            value={title}
            onChange={(e) => setTitle(e.target.value as JobTitle)}
          >
            {JOB_TITLE_SELECT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Data/ora prevista (opzionale)
          </label>
          <input
            type="datetime-local"
            className={inputFieldClass}
            value={plannedLocal}
            onChange={(e) => setPlannedLocal(e.target.value)}
          />

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Note
          </label>
          <textarea
            className={inputFieldClass}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo richiesta, dettagli telefonata…"
          />

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("order")}>
              Indietro
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={() => void submitJob()}
            >
              <Save size={16} />
              {saving ? "Salvataggio…" : "Crea intervento"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
