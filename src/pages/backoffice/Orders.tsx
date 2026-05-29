import { Button } from "@/components/ui/Button";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobOrderAPI } from "../../api/jobOrders";
import { customerAPI } from "../../api/customers";
import { jobAPI } from "../../api/jobs";
import type { JobOrder, Customer, Job } from "../../types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "react-hot-toast";
import { Edit, Trash2, Plus } from "lucide-react";
import {
  PageHeader,
  filterBarClass,
  inputFieldClass,
  selectFieldClass,
  surfaceCardClass,
  modalBackdropClass,
  modalPanelClass,
} from "@/components/layout/PageChrome";
import { ListSearchStatus } from "@/components/layout/ListSearchStatus";

export default function Orders() {
  const navigate = useNavigate();

  // Data
  const [allOrders, setAllOrders] = useState<JobOrder[]>([]);
  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Evidenziazione nuova commessa
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(
    null
  );

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<JobOrder>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Autocomplete cliente nel form
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");

  // Filtri lista
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  // Conferma eliminazione
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, j, all] = await Promise.all([
          customerAPI.list(),
          jobAPI.list(),
          jobOrderAPI.list(),
        ]);
        if (cancelled) return;
        setCustomers(c);
        setJobs(j);
        setAllOrders(all);
      } catch (err) {
        console.error("Errore caricamento dati:", err);
        if (!cancelled) toast.error("Errore nel caricamento dati ❌");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const narrowed = Boolean(debouncedSearch || filterCustomerId);
    if (!narrowed) {
      setOrders(allOrders);
      setListLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const o = await jobOrderAPI.list({
          q: debouncedSearch || undefined,
          customerId: filterCustomerId || undefined,
        });
        if (!cancelled) setOrders(o);
      } catch (err) {
        console.error("Errore caricamento commesse:", err);
        if (!cancelled) toast.error("Errore nel caricamento commesse ❌");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, filterCustomerId, allOrders]);

  const getCustomerName = (order: JobOrder) =>
    order.customerName ??
    customers.find((c) => c.id === order.customerId)?.name ??
    "N/D";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "address" || name === "mapsUrl") {
      setFormData((prev) => ({
        ...prev,
        location: { ...(prev.location ?? {}), [name]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (
      !formData.code ||
      !selectedCustomer ||
      (!formData.location?.address && !formData.location?.mapsUrl)
    ) {
      toast.error("Numero, cliente e indirizzo/Maps sono obbligatori ❌");
      return;
    }

    try {
      if (editingId) {
        const updated = await jobOrderAPI.update(editingId, {
          code: formData.code,
          customerId: selectedCustomer,
          location: {
            address: formData.location?.address ?? "",
            mapsUrl: formData.location?.mapsUrl ?? "",
          },
          notes: formData.notes,
          notesBackoffice: formData.notesBackoffice,
        });
        const nextAll = allOrders.map((o) => (o.id === editingId ? updated : o));
        setAllOrders(nextAll);
        setOrders((prev) =>
          prev.map((o) => (o.id === editingId ? updated : o))
        );
        toast.success("Commessa aggiornata ✅");
      } else {
        const created = await jobOrderAPI.create({
          code: formData.code!,
          customerId: selectedCustomer,
          location: {
            address: formData.location?.address ?? "",
            mapsUrl: formData.location?.mapsUrl ?? "",
          },
          notes: formData.notes,
          notesBackoffice: formData.notesBackoffice,
          payments: [], // se il tipo lo prevede, altrimenti rimuovi
        } as Omit<JobOrder, "id" | "createdAt">);

        // in cima + evidenziazione verde per 10s
        const nextAll = [created, ...allOrders];
        setAllOrders(nextAll);
        setOrders(
          debouncedSearch || filterCustomerId ? [created, ...orders] : nextAll
        );
        setLastCreatedOrderId(created.id);
        setTimeout(() => setLastCreatedOrderId(null), 10000);

        toast.success("Commessa creata ✅");
      }

      // reset form
      setFormData({});
      setSelectedCustomer("");
      setCustomerSearch("");
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error("Errore salvataggio commessa:", err);
      toast.error("Errore durante il salvataggio ❌");
    }
  };

  const handleEdit = (order: JobOrder) => {
    setFormData(order);
    setSelectedCustomer(order.customerId);
    setCustomerSearch(getCustomerName(order));
    setEditingId(order.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const hasJobs = jobs.some((j) => j.jobOrderId === id);
    if (hasJobs) {
      toast.error("Non puoi eliminare la commessa: ha interventi collegati ❌");
      return;
    }
    setSelectedOrderId(id);
    setOpenConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedOrderId) return;
    try {
      await jobOrderAPI.remove(selectedOrderId);
      const nextAll = allOrders.filter((o) => o.id !== selectedOrderId);
      setAllOrders(nextAll);
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrderId));
      toast.success("Commessa eliminata ✅");
    } catch (err) {
      console.error("Errore eliminazione commessa:", err);
      toast.error("Errore durante l'eliminazione ❌");
    } finally {
      setSelectedOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      if (lastCreatedOrderId === a.id) return -1;
      if (lastCreatedOrderId === b.id) return 1;
      return sortAsc
        ? a.code.localeCompare(b.code)
        : b.code.localeCompare(a.code);
    });
  }, [orders, sortAsc, lastCreatedOrderId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Commesse"
        description="Ordini di lavoro e cantieri."
        actions={
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setFormData({});
              setSelectedCustomer("");
              setCustomerSearch("");
              setEditingId(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 py-2.5 text-sm font-semibold"
          >
            <Plus size={18} /> Nuova commessa
          </Button>
        }
      />

      <div className={`space-y-3 ${filterBarClass}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex gap-2 sm:col-span-2">
            <input
              type="search"
              placeholder="Cerca numero, cliente, indirizzo, telefono, note…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputFieldClass} min-w-0 flex-1`}
            />
            {search.trim() ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSearch("")}
                className="shrink-0 px-3 py-2.5 text-sm"
              >
                Azzera
              </Button>
            ) : null}
          </div>
          <select
            value={filterCustomerId}
            onChange={(e) => setFilterCustomerId(e.target.value)}
            className={selectFieldClass}
            aria-label="Filtra per cliente"
          >
            <option value="">Tutti i clienti</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <ListSearchStatus
          loading={listLoading}
          filteredCount={filteredOrders.length}
          totalCount={allOrders.length}
          itemSingular="commessa"
          itemPlural="commesse"
          isSearchActive={Boolean(debouncedSearch)}
          isNarrowed={Boolean(debouncedSearch || filterCustomerId)}
        />
      </div>

      {/* Desktop: tabella */}
      <div className="hidden md:block">
        {filteredOrders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-sm text-slate-500">
            Nessuna commessa trovata
          </p>
        ) : (
          <table className={`w-full border-collapse text-sm ${surfaceCardClass}`}>
            <thead className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th
                  className="p-3 cursor-pointer select-none"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  Numero {sortAsc ? "▲" : "▼"}
                </th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Indirizzo / Maps</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr
                  key={o.id}
                  className={`cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/80 ${
                    lastCreatedOrderId === o.id
                      ? "bg-green-100 animate-pulse"
                      : ""
                  }`}
                  onClick={() => navigate(`/backoffice/orders/${o.id}`)}
                >
                  <td className="p-3">{o.code}</td>
                  <td className="p-3">{getCustomerName(o)}</td>
                  <td className="p-3">
                    {o.location.address ? (
                      o.location.address
                    ) : o.location.mapsUrl ? (
                      <a
                        href={o.location.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 underline"
                      >
                        Apri in Maps
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-3 flex gap-2 justify-end">
                    <button
                      title="Modifica"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(o);
                      }}
                      className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      title="Elimina"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(o.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile: cards compatte = stile rubrica */}
      <div className="md:hidden space-y-2">
        {filteredOrders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-6 text-center text-sm text-slate-500">
            Nessuna commessa trovata
          </p>
        ) : (
          filteredOrders.map((o) => (
            <div
              key={o.id}
              className={`cursor-pointer rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 transition active:bg-slate-50 ${
                lastCreatedOrderId === o.id ? "animate-pulse bg-emerald-50/80" : ""
              }`}
              onClick={() => navigate(`/backoffice/orders/${o.id}`)}
            >
              {/* Codice commessa */}
              <div className="font-semibold text-sm">{o.code}</div>

              {/* Cliente */}
              <div className="text-gray-600 text-xs mt-0.5">
                👤 {getCustomerName(o)}
              </div>

              {/* Indirizzo */}
              <div className="text-gray-500 text-xs mt-0.5">
                📍{" "}
                {o.location.address
                  ? o.location.address
                  : o.location.mapsUrl
                  ? "Apri in Maps"
                  : "-"}
              </div>

              {/* Note */}
              {o.notes && (
                <div className="text-gray-500 text-xs mt-0.5 truncate">
                  📝 {o.notes}
                </div>
              )}

              {/* Azioni */}
              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(o);
                  }}
                  className="p-1 rounded-md hover:bg-yellow-100 text-yellow-600"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(o.id);
                  }}
                  className="p-1 rounded-md hover:bg-red-100 text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal nuova/modifica */}
      {showForm && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-3 p-5 sm:p-6`}>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {editingId ? "Modifica commessa" : "Nuova commessa"}
            </h2>

            <input
              type="text"
              name="code"
              placeholder="Numero commessa (es. 25-003) *"
              value={formData.code ?? ""}
              onChange={handleChange}
              className={inputFieldClass}
            />

            {/* Cliente (autocomplete semplice, solo nome) */}
            <div className="relative mb-0">
              <input
                type="text"
                placeholder="Cerca cliente *"
                value={
                  selectedCustomer
                    ? customers.find((c) => c.id === selectedCustomer)?.name ??
                      ""
                    : customerSearch
                }
                onChange={(e) => {
                  setSelectedCustomer("");
                  setCustomerSearch(e.target.value);
                }}
                className={inputFieldClass}
              />
              {customerSearch && !selectedCustomer && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5">
                  {customers
                    .filter((c) =>
                      c.name
                        .toLowerCase()
                        .includes(customerSearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map((c) => (
                      <li
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c.id);
                          setCustomerSearch(c.name);
                        }}
                        className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <div className="font-medium text-slate-900">
                          {c.name}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <input
              type="text"
              name="address"
              placeholder="Indirizzo lavoro"
              value={formData.location?.address ?? ""}
              onChange={handleChange}
              className={inputFieldClass}
            />

            <input
              type="url"
              name="mapsUrl"
              placeholder="Link Google Maps"
              value={formData.location?.mapsUrl ?? ""}
              onChange={handleChange}
              className={inputFieldClass}
            />

            <textarea
              name="notes"
              placeholder="Note commessa"
              value={formData.notes ?? ""}
              onChange={handleChange}
              className={inputFieldClass}
              rows={3}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setFormData({});
                  setSelectedCustomer("");
                  setCustomerSearch("");
                  setEditingId(null);
                }}
                className="py-2.5 text-sm font-medium"
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                className="py-2.5 text-sm font-semibold"
              >
                Salva
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conferma eliminazione */}
      <ConfirmDialog
        open={openConfirm}
        setOpen={setOpenConfirm}
        title="Elimina commessa"
        description="Sei sicuro di voler eliminare questa commessa? L'azione non può essere annullata."
        confirmText="Elimina"
        cancelText="Annulla"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
