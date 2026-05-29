import { Button } from "@/components/ui/Button";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { customerAPI } from "../../api/customers";
import type { Customer } from "../../types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "react-hot-toast";
import { Edit, Trash2, Plus, Loader2 } from "lucide-react";
import {
  PageHeader,
  filterBarClass,
  inputFieldClass,
  surfaceCardClass,
  tableWrapperClass,
  mobileCardListClass,
  modalBackdropClass,
  modalPanelClass,
} from "@/components/layout/PageChrome";
import { ListSearchStatus } from "@/components/layout/ListSearchStatus";

export default function Customers() {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  // conferma eliminazione
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const reloadLists = useCallback(async () => {
    const all = await customerAPI.list({ cache: true, forceFresh: true });
    setAllCustomers(all);
    if (debouncedSearch) {
      const filtered = await customerAPI.list({ q: debouncedSearch });
      setCustomers(filtered);
    } else {
      setCustomers(all);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      try {
        const data = await customerAPI.list({ cache: true });
        if (!cancelled) {
          setAllCustomers(data);
          setCustomers(data);
        }
      } catch (err) {
        console.error("Errore caricamento clienti:", err);
        if (!cancelled) toast.error("Errore nel caricamento clienti ❌");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!debouncedSearch) {
      setCustomers(allCustomers);
      setListLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const data = await customerAPI.list({ q: debouncedSearch });
        if (!cancelled) setCustomers(data);
      } catch (err) {
        console.error("Errore ricerca clienti:", err);
        if (!cancelled) toast.error("Errore nella ricerca clienti ❌");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, allCustomers]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Il nome cliente è obbligatorio ❌");
      return;
    }

    try {
      if (editingId) {
        await customerAPI.update(editingId, formData);
        toast.success("Cliente aggiornato ✅");
      } else {
        const created = await customerAPI.create(
          formData as Omit<Customer, "id">
        );
        setLastCreatedId(created.id);
        setTimeout(() => setLastCreatedId(null), 10000);
        toast.success("Cliente creato ✅");
      }

      await reloadLists();

      setFormData({});
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error("❌ Errore salvataggio cliente:", err);
      toast.error("Errore durante il salvataggio del cliente ❌");
    }
  };

  const handleEdit = (customer: Customer) => {
    setFormData(customer);
    setEditingId(customer.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setSelectedId(id);
    setOpenConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedId) return;
    try {
      await customerAPI.remove(selectedId);
      await reloadLists();
      toast.success("Cliente eliminato con successo ✅");
    } catch (err) {
      console.error("❌ Errore eliminazione cliente:", err);
      const raw = err instanceof Error ? err.message : "";
      let message = "Errore durante l'eliminazione del cliente ❌";
      if (raw.includes("409:")) {
        try {
          const body = JSON.parse(raw.split("409:")[1] ?? "{}") as {
            message?: string;
          };
          if (body.message) message = body.message;
        } catch {
          /* ignore */
        }
      }
      toast.error(message);
    } finally {
      setSelectedId(null);
    }
  };

  const filteredCustomers = useMemo(
    () =>
      [...customers].sort((a, b) => {
        if (lastCreatedId === a.id) return -1;
        if (lastCreatedId === b.id) return 1;
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }),
    [customers, sortAsc, lastCreatedId]
  );

  // ✅ BLOCCO AVATAR INSERITO QUI
  const getColorFromName = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const AvatarCircle = ({ name }: { name: string }) => (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
      style={{ backgroundColor: getColorFromName(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
  // ✅ FINE BLOCCO AVATAR

  const listBusy = initialLoading || listLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clienti"
        description="Anagrafica e contatti."
        actions={
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
            <Plus size={18} /> Nuovo cliente
          </Button>
        }
      />

      <div className={`space-y-3 ${filterBarClass}`}>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Cerca nome, telefono, email, indirizzo, città commesse, note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputFieldClass} min-w-0 flex-1`}
            aria-label="Cerca nella lista clienti"
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
          loading={listBusy}
          filteredCount={filteredCustomers.length}
          totalCount={allCustomers.length}
          itemSingular="cliente"
          itemPlural="clienti"
          isSearchActive={Boolean(debouncedSearch)}
          isNarrowed={Boolean(debouncedSearch)}
        />
      </div>

      {/* Desktop: tabella */}
      <div className={tableWrapperClass}>
        {initialLoading ? (
          <div
            className={`p-6 text-center text-slate-500 ${surfaceCardClass}`}
          >
            <Loader2 className="inline animate-spin" size={16} /> Caricamento…
          </div>
        ) : filteredCustomers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-sm text-slate-500">
            Nessun cliente trovato
          </p>
        ) : (
        <table className={`w-full border-collapse text-sm ${surfaceCardClass}`}>
          <thead className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th
                className="p-3 cursor-pointer select-none"
                onClick={() => setSortAsc(!sortAsc)}
              >
                Cliente {sortAsc ? "▲" : "▼"}
              </th>
              <th className="p-3">Contatti</th>
              <th className="p-3">Note</th>
              <th className="p-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr
                key={c.id}
                className={`cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/80 ${
                  lastCreatedId === c.id ? "animate-pulse bg-emerald-50/80" : ""
                }`}
                onClick={() => navigate(`/backoffice/customers/${c.id}`)}
              >
                <td className="p-3 flex items-center gap-3">
                  <AvatarCircle name={c.name} />
                  <span className="font-medium">{c.name}</span>
                </td>
                <td className="p-3 text-gray-700">
                  <div>📞 {c.phone ?? "-"}</div>
                  <div>✉️ {c.email ?? "-"}</div>
                  {c.address ? (
                    <div className="text-slate-600">📍 {c.address}</div>
                  ) : null}
                </td>
                <td className="p-3 text-gray-600">{c.notes ?? "-"}</td>
                <td className="p-3 flex gap-2 justify-end">
                  <button
                    title="Modifica"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(c);
                    }}
                    className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    title="Elimina"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c.id);
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

      {/* Mobile: cards */}
      <div className={mobileCardListClass}>
        {initialLoading ? (
          <div
            className={`p-6 text-center text-slate-500 ${surfaceCardClass}`}
          >
            <Loader2 className="inline animate-spin" size={16} /> Caricamento…
          </div>
        ) : filteredCustomers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-sm text-slate-500">
            Nessun cliente trovato
          </p>
        ) : (
        filteredCustomers.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 transition active:bg-slate-50 ${
              lastCreatedId === c.id ? "animate-pulse bg-emerald-50/80" : ""
            }`}
            onClick={() => navigate(`/backoffice/customers/${c.id}`)}
          >
            {/* Avatar + Info */}
            <div className="flex items-center gap-3">
              <AvatarCircle name={c.name} />
              <div className="flex flex-col">
                <span className="font-semibold">{c.name}</span>
                <span className="text-xs text-gray-600">{c.phone ?? "-"}</span>
                <span className="text-xs text-gray-600">{c.email ?? "-"}</span>
                {c.address ? (
                  <span className="text-xs text-slate-600">{c.address}</span>
                ) : null}
              </div>
            </div>

            {/* Azioni */}
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(c);
                }}
                className="p-1 rounded-md hover:bg-yellow-100 text-yellow-600"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(c.id);
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

      {/* Modal nuovo/modifica cliente */}
      {showForm && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-md space-y-3 p-5 sm:p-6`}>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {editingId ? "Modifica cliente" : "Nuovo cliente"}
            </h2>

            <input
              type="text"
              name="name"
              placeholder="Nome / Ragione sociale *"
              value={formData.name ?? ""}
              onChange={handleChange}
              className={inputFieldClass}
            />
            <input
              type="text"
              name="phone"
              placeholder="Telefono"
              value={formData.phone ?? ""}
              onChange={handleChange}
              className={inputFieldClass}
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email ?? ""}
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

      {/* Conferma eliminazione */}
      <ConfirmDialog
        open={openConfirm}
        setOpen={setOpenConfirm}
        title="Elimina cliente"
        description="Sei sicuro di voler eliminare questo cliente? L'azione non può essere annullata."
        confirmText="Elimina"
        cancelText="Annulla"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
