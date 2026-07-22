import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";
import { workerAPI } from "../../api/workers";
import type { Worker } from "../../types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CheckoutCelebration } from "@/components/job/CheckoutCelebration";
import { resolveDocumentUrl } from "@/api/documentAPI";
import toast from "react-hot-toast";
import { Edit, Trash2, Phone, ImageIcon } from "lucide-react";
import imageCompression from "browser-image-compression";
import { fileToDataUrl } from "@/utils/file";
import {
  PageHeader,
  surfaceCardClass,
  modalBackdropClass,
  modalPanelClass,
  modalSafeFooterClass,
  inputFieldClass,
} from "@/components/layout/PageChrome";

interface WorkerRow extends Worker {
  user_id: string;
  email?: string; // da Auth
}

export default function MontatoriPage() {
  const [montatori, setMontatori] = useState<WorkerRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkerRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    celebrationMessage: "",
  });
  const [celebrationPreviewUrl, setCelebrationPreviewUrl] = useState<string | null>(null);
  const [celebrationImageFile, setCelebrationImageFile] = useState<File | null>(null);
  const [removeCelebrationImage, setRemoveCelebrationImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // conferma eliminazione
  const [openConfirm, setOpenConfirm] = useState(false);
  const [selected, setSelected] = useState<WorkerRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const workers = await workerAPI.list();
      setMontatori(
        workers.map((w) => ({
          ...w,
          user_id: w.userId || w.id,
        }))
      );
    } catch (err) {
      console.error("Errore caricamento montatori:", err);
      toast.error("Errore di connessione ❌");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({ name: "", email: "", phone: "", celebrationMessage: "" });
    setCelebrationPreviewUrl(null);
    setCelebrationImageFile(null);
    setRemoveCelebrationImage(false);
    setEditing(null);
  }

  function openEditModal(m: WorkerRow) {
    setEditing(m);
    setForm({
      name: m.name,
      email: m.email ?? "",
      phone: m.phone ?? "",
      celebrationMessage: m.checkoutCelebrationMessage ?? "",
    });
    setCelebrationPreviewUrl(
      m.checkoutCelebrationImageUrl
        ? resolveDocumentUrl(m.checkoutCelebrationImageUrl)
        : null
    );
    setCelebrationImageFile(null);
    setRemoveCelebrationImage(false);
    setModalOpen(true);
  }

  async function handleCelebrationImagePick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un file immagine (JPG, PNG, WebP)");
      return;
    }
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      setCelebrationImageFile(compressed);
      setCelebrationPreviewUrl(URL.createObjectURL(compressed));
      setRemoveCelebrationImage(false);
    } catch (e) {
      console.error(e);
      toast.error("Impossibile elaborare l'immagine");
    }
  }

  async function handleSave() {
    if (!editing) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome ed email sono obbligatori ❌");
      return;
    }

    setSaving(true);
    try {
      let checkoutCelebrationImage: string | undefined;
      if (celebrationImageFile) {
        checkoutCelebrationImage = await fileToDataUrl(celebrationImageFile);
      }

      await workerAPI.update(editing.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        checkoutCelebrationMessage: form.celebrationMessage.trim() || null,
        ...(checkoutCelebrationImage ? { checkoutCelebrationImage } : {}),
        ...(removeCelebrationImage ? { removeCheckoutCelebrationImage: true } : {}),
      });

      await load();
      setModalOpen(false);
      resetForm();
      toast.success("Montatore aggiornato");
    } catch (e) {
      console.error("Errore salvataggio montatore", e);
      toast.error("Errore durante il salvataggio ❌");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!selected) return;
    try {
      await workerAPI.remove(selected.id);

      setMontatori((prev) => prev.filter((x) => x.id !== selected.id));
      toast.success("Montatore eliminato con successo ✅");
    } catch (e) {
      console.error("Errore eliminazione montatore", e);
      toast.error("Errore durante l'eliminazione ❌");
    } finally {
      setSelected(null);
    }
  }

  return (
    <main className="space-y-5">
      <PageHeader
        title="Gestione montatori"
        description="Anagrafica squadre operative."
      />

      {/* Desktop: tabella */}
      <div className={`hidden overflow-hidden md:block ${surfaceCardClass}`}>
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-3 text-left">Nome</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Telefono</th>
              <th className="p-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-600">
                  ⏳ Caricamento…
                </td>
              </tr>
            ) : montatori.length > 0 ? (
              montatori.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                >
                  <td className="p-3 font-medium">{m.name}</td>
                  <td className="p-3">{m.email}</td>
                  <td className="p-3 flex items-center gap-2 text-gray-700">
                    <Phone size={16} className="opacity-70" />
                    {m.phone || "-"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEditModal(m)}
                        className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600"
                        title="Modifica"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setSelected(m);
                          setOpenConfirm(true);
                        }}
                        className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                        title="Elimina"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="p-4 text-center text-gray-500 italic"
                >
                  Nessun montatore presente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: card compatte */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="text-center text-gray-500">⏳ Caricamento…</div>
        ) : montatori.length > 0 ? (
          montatori.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-1 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 transition hover:bg-slate-50/80 active:bg-slate-50"
            >
              {/* Nome */}
              <div className="font-semibold text-sm">{m.name}</div>

              {/* Email */}
              <div className="text-xs text-gray-600">{m.email}</div>

              {/* Telefono */}
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <Phone size={13} className="opacity-70" />
                {m.phone || "-"}
              </div>

              {/* Azioni */}
              <div className="flex gap-1 mt-1 justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(m);
                  }}
                  className="p-1 rounded-md hover:bg-yellow-100 text-yellow-600"
                  title="Modifica"
                >
                  <Edit size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(m);
                    setOpenConfirm(true);
                  }}
                  className="p-1 rounded-md hover:bg-red-100 text-red-600"
                  title="Elimina"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500">
            Nessun montatore presente
          </div>
        )}
      </div>

      {/* Modal modifica */}
      {modalOpen && (
        <div className={modalBackdropClass}>
          <div
            className={`${modalPanelClass} ${modalSafeFooterClass} max-w-3xl space-y-4 p-5 sm:p-6`}
          >
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Modifica montatore
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nome
                </label>
                <input
                  type="text"
                  className={inputFieldClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email (Auth)
                </label>
                <input
                  type="email"
                  className={inputFieldClass}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Telefono
                </label>
                <input
                  type="tel"
                  className={inputFieldClass}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Schermata dopo checkout
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Messaggio e foto opzionale mostrati al montatore quando chiude un intervento in
                  cantiere.
                </p>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Frase personalizzata
                  </label>
                  <textarea
                    className={inputFieldClass + " min-h-[4.5rem] resize-y"}
                    maxLength={200}
                    placeholder="Es. Grande lavoro, a domani!"
                    value={form.celebrationMessage}
                    onChange={(e) =>
                      setForm({ ...form, celebrationMessage: e.target.value })
                    }
                  />
                  <p className="mt-1 text-right text-[11px] text-slate-500">
                    {form.celebrationMessage.length}/200
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                    <ImageIcon size={16} />
                    {celebrationPreviewUrl ? "Cambia foto sfondo" : "Carica foto sfondo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        void handleCelebrationImagePick(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {celebrationPreviewUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-sm"
                      onClick={() => {
                        setCelebrationPreviewUrl(null);
                        setCelebrationImageFile(null);
                        setRemoveCelebrationImage(true);
                      }}
                    >
                      Rimuovi foto
                    </Button>
                  )}
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <p className="bg-white px-3 py-2 text-xs font-medium text-slate-600">
                    Anteprima
                  </p>
                  <CheckoutCelebration
                    outcome="completato"
                    workerName={form.name || "Montatore"}
                    customMessage={form.celebrationMessage}
                    backgroundImageUrl={
                      celebrationPreviewUrl && !removeCelebrationImage
                        ? celebrationPreviewUrl
                        : null
                    }
                    jobTitle="Intervento di esempio"
                    orderCode="DEMO-001"
                    customerName="Cliente esempio"
                    footnotes={[{ id: "demo", text: "2 allegati caricati" }]}
                    onClose={() => {}}
                    preview
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="py-2.5 text-sm font-medium"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  className="py-2.5 text-sm font-semibold"
                >
                  {saving ? "Salvataggio…" : "Salva"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conferma eliminazione */}
      <ConfirmDialog
        open={openConfirm}
        setOpen={setOpenConfirm}
        title="Elimina montatore"
        description="Sei sicuro di voler eliminare questo montatore? Questa azione è irreversibile."
        confirmText="Elimina"
        cancelText="Annulla"
        onConfirm={confirmDelete}
      />
    </main>
  );
}
