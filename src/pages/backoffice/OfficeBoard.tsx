import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileUp,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { jobOrderAPI } from "@/api/jobOrders";
import { jobAPI } from "@/api/jobs";
import { customerAPI } from "@/api/customers";
import type { Customer, Job, JobOrder } from "@/types";
import { useAuth } from "@/context/AuthContext";
import CreateJobOrderDialog from "@/components/office/CreateJobOrderDialog";
import LibroneImportDialog from "@/components/office/LibroneImportDialog";
import LibronePrintDialog from "@/components/office/LibronePrintDialog";
import { libroneImportAPI } from "@/api/libroneImport";
import { jobTitleDisplay } from "@/config/jobTitles";
import {
  PageHeader,
  filterBarClass,
  inputFieldClass,
  selectFieldClass,
  surfaceCardClass,
} from "@/components/layout/PageChrome";
import { Button } from "@/components/ui/Button";
import {
  OFFICE_ELENCO_SECTIONS,
  buildOfficeElenco,
  formatDeliveryWeek,
  fieldNotesPreview,
  isOfficeOrder,
  matchesElencoSearch,
  matchesWeekFilter,
  officeNotesPreview,
  parseDeliveryWeekInput,
  deliveryWeekPresetRange,
  DELIVERY_WEEK_PRESETS,
  getCurrentDeliveryWeek,
  formatDeliveryWeekInput,
  type DeliveryWeekPresetId,
  type OfficeElencoRow,
  type OfficeElencoSectionId,
} from "@/utils/officeElenco";
import { elencoNomeFromCustomerName } from "@/utils/customerCity";
import { eneaPraticaFlagTitle } from "@/utils/eneaPratica";

function FlagCell({
  active,
  label,
  highlight,
  title,
}: {
  active?: boolean;
  label: string;
  highlight?: boolean;
  title?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold ${
        active
          ? highlight
            ? "border-orange-500 bg-orange-500 text-white"
            : "border-slate-800 bg-slate-800 text-white"
          : "border-slate-200 bg-white text-slate-300"
      }`}
      title={title ?? label}
    >
      {label}
    </span>
  );
}

function ElencoTable({
  rows,
  sectionId,
  onOpenOrder,
}: {
  rows: OfficeElencoRow[];
  sectionId: OfficeElencoSectionId;
  onOpenOrder: (id: string) => void;
}) {
  const showJobs =
    sectionId === "montaggi_da_completare" || sectionId === "in_cantiere";

  return (
    <table className="office-elenco-table w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-300 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <th className="px-2 py-2" title="Settimana prevista di consegna (anno/settimana)">
            Sett. cons.
          </th>
          <th className="px-2 py-2">Comm</th>
          <th className="px-2 py-2">Nome</th>
          <th className="px-2 py-2 text-center">C</th>
          <th className="px-2 py-2 text-center">M</th>
          <th className="px-2 py-2 text-center">E</th>
          <th className="px-2 py-2">Colore</th>
          <th className="px-2 py-2 text-right">Pz</th>
          <th className="px-2 py-2">Destinazione</th>
          <th className="px-2 py-2">Note ufficio</th>
          <th className="px-2 py-2">Note commessa</th>
          {showJobs && <th className="px-2 py-2 print:hidden">Cantiere</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const o = row.order;
          const jobs =
            sectionId === "montaggi_da_completare" || sectionId === "in_cantiere"
              ? row.openFieldJobs
              : [];
          const officeNotes = officeNotesPreview(o);
          const fieldNotes = fieldNotesPreview(o);
          const nome =
            o.contactName?.trim() ||
            elencoNomeFromCustomerName(o.customerName) ||
            "";

          return (
            <tr
              key={o.id}
              className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
              onClick={() => onOpenOrder(o.id)}
            >
              <td className="whitespace-nowrap px-2 py-2 font-medium">
                {formatDeliveryWeek(o.deliveryWeekYear, o.deliveryWeekNum) || "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-2 font-semibold text-slate-900">
                {o.code}
              </td>
              <td className="px-2 py-2">{nome || "—"}</td>
              <td className="px-2 py-2 text-center">
                <FlagCell active={o.hasControcasse} label="C" />
              </td>
              <td className="px-2 py-2 text-center">
                <FlagCell active={o.hasMontaggio} label="M" />
              </td>
              <td className="px-2 py-2 text-center">
                <FlagCell
                  active={o.hasEneaPratica}
                  label="E"
                  highlight={Boolean(o.eneaPraticaPendingAt && !o.eneaPraticaCompletedAt)}
                  title={eneaPraticaFlagTitle(o)}
                />
              </td>
              <td className="px-2 py-2">{o.productColor?.trim() || "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {o.pieceCount != null ? o.pieceCount : "—"}
              </td>
              <td className="px-2 py-2">{o.destinationCity?.trim() || "—"}</td>
              <td className="max-w-xs px-2 py-2 text-xs leading-snug text-slate-700">
                {officeNotes || "—"}
              </td>
              <td className="max-w-xs px-2 py-2 text-xs leading-snug text-slate-500">
                {fieldNotes || "—"}
              </td>
              {showJobs && (
                <td
                  className="px-2 py-2 print:hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {jobs.length === 0 ? (
                    sectionId === "montaggi_da_completare" ? (
                      <span className="text-xs text-violet-700">Montaggio da creare</span>
                    ) : (
                      "—"
                    )
                  ) : (
                    <div className="flex flex-col gap-1">
                      {jobs.map((j) => (
                        <Link
                          key={j.id}
                          to={`/backoffice/jobs/${j.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                          {jobTitleDisplay(j.title)}
                          <ExternalLink size={12} />
                        </Link>
                      ))}
                    </div>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function OfficeBoard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const officeWorkflowEnabled = Boolean(user?.officeWorkflowEnabled);

  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showLibroneImport, setShowLibroneImport] = useState(false);
  const [showLibronePrint, setShowLibronePrint] = useState(false);
  const [libronePendingCount, setLibronePendingCount] = useState(0);
  const [eneaPendingCount, setEneaPendingCount] = useState(0);
  const [showTerminate, setShowTerminate] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    terminate_insolute: true,
    terminate: true,
  });
  const [weekFrom, setWeekFrom] = useState("");
  const [weekTo, setWeekTo] = useState("");
  const [weekPreset, setWeekPreset] = useState<DeliveryWeekPresetId>("");
  const [statusFilter, setStatusFilter] = useState<"all" | OfficeElencoSectionId>("all");

  const load = useCallback(async (forceFresh = false) => {
    setLoading(true);
    try {
      const cacheOpts = { cache: true as const, forceFresh };
      const [rows, j] = await Promise.all([
        jobOrderAPI.list(cacheOpts),
        jobAPI.list(cacheOpts),
      ]);
      setOrders(rows.filter((row) => isOfficeOrder(row, j)));
      setJobs(j);
      const [libronePending, eneaPending] = await Promise.all([
        libroneImportAPI.pendingCount().catch(() => 0),
        jobOrderAPI.eneaPendingCount().catch(() => 0),
      ]);
      setLibronePendingCount(libronePending);
      setEneaPendingCount(eneaPending);
    } catch (err) {
      console.error(err);
      toast.error("Errore caricamento elenco ufficio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    void customerAPI.list({ cache: true }).then(setCustomers).catch(() => {
      toast.error("Errore caricamento clienti");
    });
  }, [load]);

  const parseWeekInput = parseDeliveryWeekInput;

  const from = parseWeekInput(weekFrom);
  const to = parseWeekInput(weekTo);

  const currentWeekLabel = useMemo(() => {
    const w = getCurrentDeliveryWeek();
    return formatDeliveryWeekInput(w.year, w.week);
  }, []);

  const applyWeekPreset = (preset: DeliveryWeekPresetId) => {
    setWeekPreset(preset);
    const range = deliveryWeekPresetRange(preset);
    setWeekFrom(range.from);
    setWeekTo(range.to);
  };

  const handleWeekFromChange = (value: string) => {
    setWeekPreset("");
    setWeekFrom(value);
  };

  const handleWeekToChange = (value: string) => {
    setWeekPreset("");
    setWeekTo(value);
  };

  const elenco = useMemo(() => buildOfficeElenco(orders, jobs), [orders, jobs]);

  const hasPendingActions = libronePendingCount > 0 || eneaPendingCount > 0;

  const showClosedSectionsEffective =
    showTerminate ||
    statusFilter === "terminate" ||
    statusFilter === "terminate_insolute";

  const filteredElenco = useMemo(() => {
    const result = {} as Record<OfficeElencoSectionId, OfficeElencoRow[]>;
    for (const section of OFFICE_ELENCO_SECTIONS) {
      if (statusFilter !== "all" && section.id !== statusFilter) {
        result[section.id] = [];
        continue;
      }
      let rows = elenco[section.id];
      if (
        !showClosedSectionsEffective &&
        (section.id === "terminate" || section.id === "terminate_insolute")
      ) {
        rows = [];
      }
      rows = rows.filter(
        (row) =>
          matchesElencoSearch(row, search) &&
          matchesWeekFilter(row.order, from.year, from.week, to.year, to.week)
      );
      result[section.id] = rows;
    }
    return result;
  }, [elenco, search, from, to, showClosedSectionsEffective, statusFilter]);

  const activeCount = useMemo(
    () =>
      OFFICE_ELENCO_SECTIONS.filter(
        (s) => s.id !== "terminate" && s.id !== "terminate_insolute"
      ).reduce(
        (sum, s) => sum + filteredElenco[s.id].length,
        0
      ),
    [filteredElenco]
  );

  const visibleCount = useMemo(
    () =>
      OFFICE_ELENCO_SECTIONS.reduce(
        (sum, s) => sum + filteredElenco[s.id].length,
        0
      ),
    [filteredElenco]
  );

  const statusFilterLabel = useMemo(() => {
    if (statusFilter === "all") return null;
    return OFFICE_ELENCO_SECTIONS.find((s) => s.id === statusFilter)?.title ?? null;
  }, [statusFilter]);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const focusEneaSection = () => {
    setStatusFilter("enea_da_fare");
    setSearch("");
    setWeekFrom("");
    setWeekTo("");
    setWeekPreset("");
    setCollapsed((prev) => ({ ...prev, enea_da_fare: false }));
  };

  return (
    <div className="office-elenco-page space-y-5">
      <div className="no-print">
        <PageHeader
          title="Ufficio commesse"
          description="Elenco generale come in Access: stati pre-cantiere, montaggi da completare e archivio. Le assistenze post-vendita restano in Assistenza."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void load(true)}
                className="inline-flex items-center gap-2 py-2.5 text-sm"
              >
                <RefreshCw size={16} />
                Aggiorna
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLibroneImport(true)}
                className="inline-flex items-center gap-2 py-2.5 text-sm"
                title="Import librone PDF"
              >
                <FileUp size={16} />
                <span className="sm:hidden">Import</span>
                <span className="hidden sm:inline">Import librone PDF</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLibronePrint(true)}
                className="inline-flex items-center gap-2 py-2.5 text-sm"
                title="Stampa librone PDF"
              >
                <FileDown size={16} />
                <span className="sm:hidden">Stampa PDF</span>
                <span className="hidden sm:inline">Stampa librone PDF</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 py-2.5 text-sm font-semibold"
              >
                <Plus size={16} />
                Nuova commessa
              </Button>
            </div>
          }
        />

        {hasPendingActions && (
          <div
            className={`${surfaceCardClass} border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-md ring-2 ring-amber-200/60`}
            role="status"
          >
            <div className="mb-3 flex items-start gap-2">
              <span className="rounded-full bg-amber-100 p-1.5 text-amber-700">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="text-sm font-bold text-amber-950">Attività da completare</p>
                <p className="mt-0.5 text-xs text-amber-900/80">
                  Promemoria operativi: aprili e chiudili quando hai finito.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {libronePendingCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/backoffice/office/librone-pending")}
                  className="inline-flex items-center gap-2 border-2 border-amber-400 bg-amber-100 py-2.5 text-sm font-semibold text-amber-950 shadow-sm ring-1 ring-amber-300/80 hover:bg-amber-200"
                  title="Commesse importate dal librone con anagrafica cliente da completare"
                >
                  <AlertTriangle size={16} className="shrink-0" />
                  <span className="sm:hidden">Clienti ({libronePendingCount})</span>
                  <span className="hidden sm:inline">
                    Clienti da completare ({libronePendingCount})
                  </span>
                </Button>
              )}
              {eneaPendingCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={focusEneaSection}
                  className="inline-flex items-center gap-2 border-2 border-orange-400 bg-orange-100 py-2.5 text-sm font-semibold text-orange-950 shadow-sm ring-1 ring-orange-300/80 hover:bg-orange-200"
                  title="Commesse con pratica ENEA attiva dopo il montaggio, ancora da segnare completata in scheda"
                >
                  <AlertTriangle size={16} className="shrink-0" />
                  <span className="sm:hidden">ENEA ({eneaPendingCount})</span>
                  <span className="hidden sm:inline">
                    Pratiche ENEA da fare ({eneaPendingCount})
                  </span>
                </Button>
              )}
            </div>
          </div>
        )}

        <div className={`space-y-3 ${filterBarClass}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <input
              type="search"
              placeholder="Cerca commessa, cliente, colore, destinazione…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputFieldClass}
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | OfficeElencoSectionId)
              }
              className={selectFieldClass}
              title="Filtra per stato commessa in elenco ufficio"
            >
              <option value="all">Tutti gli stati</option>
              {OFFICE_ELENCO_SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={`Sett. consegna da (es. ${currentWeekLabel})`}
              value={weekFrom}
              onChange={(e) => handleWeekFromChange(e.target.value)}
              className={inputFieldClass}
              title="Settimana prevista di consegna — formato anno/settimana"
            />
            <input
              type="text"
              placeholder="Sett. consegna a"
              value={weekTo}
              onChange={(e) => handleWeekToChange(e.target.value)}
              className={inputFieldClass}
              title="Settimana prevista di consegna — formato anno/settimana"
            />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showTerminate}
                onChange={(e) => setShowTerminate(e.target.checked)}
              />
              Mostra chiuse ({elenco.terminate_insolute.length + elenco.terminate.length})
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              Settimana corrente: <strong>{currentWeekLabel}</strong>
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyWeekPreset("")}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  weekPreset === ""
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Tutte
              </button>
              {DELIVERY_WEEK_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.hint}
                  onClick={() => applyWeekPreset(preset.id)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    weekPreset === preset.id
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            La colonna <strong>Sett. cons.</strong> è la settimana prevista di consegna
            (come in Access). Usa i filtri per le commesse in scadenza e programmarle in
            cantiere.
            {(weekFrom || weekTo) && (
              <>
                {" "}
                · Filtro settimana:{" "}
                <strong>
                  {weekFrom || "…"} → {weekTo || "…"}
                </strong>
              </>
            )}
            {statusFilterLabel && (
              <>
                {" "}
                · Stato: <strong>{statusFilterLabel}</strong>
              </>
            )}
          </p>
          <p className="text-xs text-slate-500">
            <strong>{activeCount}</strong> commesse attive in elenco
            {filteredElenco.montaggi_da_completare.length > 0 && (
              <>
                {" "}
                · <strong>{filteredElenco.montaggi_da_completare.length}</strong> con
                montaggio da completare (collegate agli interventi)
              </>
            )}
            {filteredElenco.enea_da_fare.length > 0 && (
              <>
                {" "}
                · <strong>{filteredElenco.enea_da_fare.length}</strong> pratiche
                ENEA da fare
              </>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="animate-spin" size={20} />
          Caricamento…
        </div>
      ) : visibleCount === 0 ? (
        <div className={`py-12 text-center text-sm text-slate-500 ${surfaceCardClass}`}>
          <p className="mb-1 font-medium text-slate-700">Nessuna commessa in elenco</p>
          <p className="text-xs text-slate-400">
            {statusFilterLabel
              ? `Nessuna commessa in stato «${statusFilterLabel}» con i filtri attuali.`
              : "Crea una commessa ufficio o modifica i filtri stato / settimana / ricerca."}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowCreate(true)}
            className="no-print mt-4 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Nuova commessa ufficio
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {OFFICE_ELENCO_SECTIONS.map((section) => {
            const rows = filteredElenco[section.id];
            if (rows.length === 0) return null;
            if (
              (section.id === "terminate" || section.id === "terminate_insolute") &&
              !showClosedSectionsEffective
            ) {
              return null;
            }
            if (section.id === "enea_da_fare" && rows.length === 0) {
              return null;
            }

            const isCollapsed = collapsed[section.id] ?? false;

            return (
              <section
                key={section.id}
                className={`office-elenco-section overflow-hidden ${surfaceCardClass}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="no-print flex w-full items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-left"
                >
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {section.pdfNumber}) {section.title}
                      <span className="ml-2 font-normal text-slate-500">
                        ({rows.length})
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">{section.description}</p>
                  </div>
                  {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                </button>

                <div className="print:block px-2 py-2 hidden print:px-0">
                  <h2 className="text-sm font-bold">
                    {section.pdfNumber}) {section.title} ({rows.length})
                  </h2>
                </div>

                <div
                  className={`overflow-x-auto p-2 sm:p-3 ${isCollapsed ? "hidden print:block" : ""}`}
                >
                  <ElencoTable
                    rows={rows}
                    sectionId={section.id}
                    onOpenOrder={(id) => navigate(`/backoffice/orders/${id}`)}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      <CreateJobOrderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        customers={customers}
        officeWorkflowEnabled={officeWorkflowEnabled}
        onCreated={(order) => {
          void load(true);
          navigate(`/backoffice/orders/${order.id}`);
        }}
      />

      <LibroneImportDialog
        open={showLibroneImport}
        onClose={() => setShowLibroneImport(false)}
        onApplied={() => void load(true)}
      />

      <LibronePrintDialog
        open={showLibronePrint}
        onClose={() => setShowLibronePrint(false)}
      />
    </div>
  );
}
