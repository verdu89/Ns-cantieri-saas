import { Button } from "@/components/ui/Button";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { customerAPI } from "../../api/customers";
import { jobOrderAPI } from "../../api/jobOrders";
import { jobAPI } from "../../api/jobs";
import type { Customer, JobOrder, Job } from "../../types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "react-hot-toast";
import { Edit, Trash2, Plus } from "lucide-react";
import {
  PageHeader,
  surfaceCardClass,
  modalBackdropClass,
  modalPanelClass,
  inputFieldClass,
  filterBarClass,
  tableWrapperClass,
  mobileCardListClass,
} from "@/components/layout/PageChrome";
import { ListSearchStatus } from "@/components/layout/ListSearchStatus";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(
    null
  );

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [allOrders, setAllOrders] = useState<JobOrder[]>([]);
  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<JobOrder>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  const [openConfirm, setOpenConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const reloadOrders = useCallback(async () => {
    if (!id) return;
    const all = await jobOrderAPI.listByCustomer(id);
    setAllOrders(all);
    if (debouncedSearch) {
      const filtered = await jobOrderAPI.list({
        customerId: id,
        q: debouncedSearch,
      });
      setOrders(filtered);
    } else {
      setOrders(all);
    }
  }, [id, debouncedSearch]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, o, j] = await Promise.all([
          customerAPI.getById(id),
          jobOrderAPI.listByCustomer(id),
          jobAPI.list(),
        ]);
        if (cancelled) return;
        setCustomer(c ?? null);
        setAllOrders(o);
        setOrders(o);
        setJobs(j);
      } catch (err) {
        console.error("Errore caricamento scheda cliente:", err);
        if (!cancelled) toast.error("Errore nel caricamento dati ❌");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (!debouncedSearch) {
      setOrders(allOrders);
      setListLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const filtered = await jobOrderAPI.list({
          customerId: id,
          q: debouncedSearch,
        });
        if (!cancelled) setOrders(filtered);
      } catch (err) {
        console.error("Errore ricerca commesse:", err);
        if (!cancelled) toast.error("Errore nella ricerca commesse ❌");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, allOrders, id]);

  const filteredOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        if (lastCreatedOrderId === a.id) return -1;
        if (lastCreatedOrderId === b.id) return 1;
        return sortAsc
          ? a.code.localeCompare(b.code)
          : b.code.localeCompare(a.code);
      }),
    [orders, sortAsc, lastCreatedOrderId]
  );

  if (!customer) {
    return <div className="p-6 text-red-600">Cliente non trovato ❌</div>;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "address" || name === "mapsUrl") {
      setFormData({
        ...formData,
        location: { ...(formData.location ?? {}), [name]: value },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSave = async () => {
    if (
      !formData.code ||
      (!formData.location?.address && !formData.location?.mapsUrl)
    ) {
      toast.error(
        "La commessa deve avere un indirizzo o un link Google Maps ❌"
      );
      return;
    }

    try {
      if (editingId) {
        await jobOrderAPI.update(editingId, {
          code: formData.code,
          customerId: customer.id,
          location: {
            address: formData.location?.address ?? "",
            mapsUrl: formData.location?.mapsUrl ?? "",
          },
          notes: formData.notes,
        });
        toast.success("Commessa aggiornata con successo ✅");
      } else {
        const created = await jobOrderAPI.create({
          code: formData.code!,
          customerId: customer.id,
          location: {
            address: formData.location?.address ?? "",
            mapsUrl: formData.location?.mapsUrl ?? "",
          },
          notes: formData.notes,
        });
        setLastCreatedOrderId(created.id);
        setTimeout(() => setLastCreatedOrderId(null), 10000);
        toast.success("Commessa creata con successo ✅");
      }

      await reloadOrders();
      setFormData({});
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error("❌ Errore salvataggio commessa:", err);
      toast.error("Errore durante il salvataggio della commessa ❌");
    }
  };

  const handleEdit = (order: JobOrder) => {
    setFormData(order);
    setEditingId(order.id);
    setShowForm(true);
  };

  const handleDelete = (orderId: string) => {
    const hasJobs = jobs.some((j: Job) => j.jobOrderId === orderId);
    if (hasJobs) {
      toast.error(
        "Non puoi eliminare questa commessa perché ha interventi collegati ❌"
      );
      return;
    }
    setOrderToDelete(orderId);
    setOpenConfirm(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    try {
      await jobOrderAPI.remove(orderToDelete);
      await reloadOrders();
      toast.success("Commessa eliminata con successo ✅");
    } catch (err) {
      console.error("❌ Errore eliminazione commessa:", err);
      toast.error("Errore durante l'eliminazione della commessa ❌");
    } finally {
      setOrderToDelete(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={customer.name}
        description={
          [customer.phone && `Tel. ${customer.phone}`, customer.email]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      {customer.notes ? (
        <div className={`p-4 text-sm text-slate-700 ${surfaceCardClass}`}>
          <strong className="text-slate-900">Note:</strong> {customer.notes}
        </div>
      ) : null}

      <div className={`p-4 sm:p-6 ${surfaceCardClass}`}>
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Commesse
          </h2>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setFormData({});
              setEditingId(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 py-2.5 text-sm font-semibold"
          >
            <Plus size={18} /> Nuova commessa
          </Button>
        </div>

        <div className={`mb-4 space-y-3 ${filterBarClass}`}>
          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Cerca numero, indirizzo, note commessa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputFieldClass} min-w-0 flex-1`}
              aria-label="Cerca nelle commesse del cliente"
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
          <ListSearchStatus
            loading={listLoading}
            filteredCount={filteredOrders.length}
            totalCount={allOrders.length}
            itemSingular="commessa"
            itemPlural="commesse"
            isSearchActive={Boolean(debouncedSearch)}
            isNarrowed={Boolean(debouncedSearch)}
          />
        </div>

        <div className={tableWrapperClass}>
          {filteredOrders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-sm text-slate-500">
              Nessuna commessa trovata
            </p>
          ) : (
            <table className="w-full border-collapse bg-white text-sm shadow-sm ring-1 ring-slate-900/5 rounded-lg overflow-hidden">
              <thead className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th
                    className="p-3 cursor-pointer select-none"
                    onClick={() => setSortAsc(!sortAsc)}
                  >
                    Numero {sortAsc ? "▲" : "▼"}
                  </th>
                  <th className="p-3">Indirizzo / Maps</th>
                  <th className="p-3">Note</th>
                  <th className="p-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-t border-slate-100 cursor-pointer transition-colors hover:bg-slate-50/80 ${
                      lastCreatedOrderId === o.id
                        ? "bg-emerald-50/80 animate-pulse"
                        : ""
                    }`}
                    onClick={() => navigate(`/backoffice/orders/${o.id}`)}
                  >
                    <td className="p-3 font-medium">{o.code}</td>
                    <td className="p-3">
                      {o.location?.address ? (
                        o.location.address
                      ) : o.location?.mapsUrl ? (
                        <a
                          href={o.location.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-brand hover:underline"
                        >
                          Apri in Maps
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-slate-600">
                      {o.notes ?? "-"}
                    </td>
                    <td className="p-3 flex justify-end gap-2">
                      <button
                        type="button"
                        title="Modifica"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(o);
                        }}
                        className="rounded-lg p-2 text-yellow-600 hover:bg-yellow-100"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        type="button"
                        title="Elimina"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(o.id);
                        }}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-100"
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

        <div className={`${mobileCardListClass} mt-4 md:mt-0`}>
          {filteredOrders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-sm text-slate-500">
              Nessuna commessa trovata
            </p>
          ) : (
            filteredOrders.map((o) => (
              <div
                key={o.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 transition active:bg-slate-50 ${
                  lastCreatedOrderId === o.id
                    ? "bg-emerald-50/80 animate-pulse"
                    : ""
                }`}
                onClick={() => navigate(`/backoffice/orders/${o.id}`)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{o.code}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(o);
                      }}
                      className="rounded-md p-1 text-yellow-600 hover:bg-yellow-100"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(o.id);
                      }}
                      className="rounded-md p-1 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <span className="text-xs text-slate-600">
                  {o.location?.address
                    ? `📍 ${o.location.address}`
                    : o.location?.mapsUrl
                      ? "📍 Apri in Maps"
                      : "-"}
                </span>
                {o.notes ? (
                  <span className="truncate text-xs text-slate-500">📝 {o.notes}</span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {showForm && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-md space-y-3 p-5 sm:p-6`}>
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
              placeholder="Note interne"
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
