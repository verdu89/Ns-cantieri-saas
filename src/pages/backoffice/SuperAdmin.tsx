import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Receipt,
  Users,
  History,
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronRight,
  Wallet,
  HardDrive,
  Bell,
  Download,
} from "lucide-react";
import PushBroadcastPanel from "@/components/admin/PushBroadcastPanel";
import {
  TenantFeatureBadges,
  tenantFeatureServicesSummary,
} from "@/components/admin/TenantFeatureBadges";
import {
  buildAllActionItems,
  csvExportErrorMessage,
  exportActionItemsCsv,
  exportBillingEventsCsv,
  exportCollectionsCsv,
  exportMrrSummaryCsv,
  exportSuperAdminFullPackage,
  exportTenantUsersCsv,
  exportTenantsRegistryCsv,
} from "@/utils/superAdminCsvExports";
import {
  saasAdminAPI,
  type BillingEventItem,
  type TenantListItem,
  type TenantUserItem,
} from "@/api/saasAdmin";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import {
  PageHeader,
  modalBackdropClass,
  modalBackdropElevatedClass,
  modalPanelClass,
  inputFieldClass,
  selectFieldClass,
  surfaceCardClass,
  filterBarClass,
} from "@/components/layout/PageChrome";

type TenantTab = "overview" | "billing" | "users" | "notifications" | "timeline";
type PaymentStatus = "pending" | "paid" | "overdue";
type PaymentDialogMode = "register" | "undo";

type BillingSituation = {
  label: string;
  detail: string;
  tone: "red" | "amber" | "green" | "gray" | "blue";
};

type SuspensionBadge = {
  label: string;
  toneClass: string;
};

type ActionItem = {
  tenantId: string;
  tenantName: string;
  priority: "high" | "medium";
  reason: string;
};

type FocusFilter =
  | "all"
  | "autoSuspended"
  | "trialUrgent"
  | "overdueOnly"
  | "dueSoon"
  | "trialExpiringOnly"
  | "overdueExpiredOnly";
type CollectionsFilter = "all" | "overdue" | "dueSoon" | "upcoming";

type CollectionRow = {
  tenantId: string;
  tenantName: string;
  amount: number;
  billingCycle: "monthly" | "yearly";
  paymentStatus: PaymentStatus;
  dueAt: string | null;
  dueInDays: number | null;
  priority: "critical" | "high" | "normal";
  lastPaymentAt: string | null;
};

function planLabelIt(plan: string) {
  if (plan === "trial") return "Trial";
  if (plan === "basic") return "Basic";
  if (plan === "pro") return "Pro";
  return plan;
}

function tenantStatusLabelIt(status: string) {
  if (status === "active") return "Attivo";
  if (status === "suspended") return "Sospeso";
  if (status === "archived") return "Archiviato";
  return status;
}

function roleLabelIt(role: string) {
  if (role === "worker") return "Operatore";
  if (role === "backoffice") return "Backoffice";
  if (role === "admin") return "Amministratore";
  return role;
}

const TENANT_MODAL_TABS: {
  id: TenantTab;
  label: string;
  hint: string;
  Icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Panoramica", hint: "Stato sintetico e priorità", Icon: LayoutDashboard },
  { id: "billing", label: "Abbonamento", hint: "Piano, date e incassi", Icon: Receipt },
  { id: "users", label: "Team", hint: "Utenti e ruoli", Icon: Users },
  {
    id: "notifications",
    label: "Notifiche",
    hint: "Push al team del cliente",
    Icon: Bell,
  },
  { id: "timeline", label: "Cronologia", hint: "Eventi e note operative", Icon: History },
];

export default function SuperAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const collectionsSectionRef = useRef<HTMLElement | null>(null);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantUsers, setTenantUsers] = useState<TenantUserItem[]>([]);
  const [billingEvents, setBillingEvents] = useState<BillingEventItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingBillingEvents, setLoadingBillingEvents] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<TenantTab>("overview");
  const [paymentDialogMode, setPaymentDialogMode] = useState<PaymentDialogMode | null>(null);
  const [savingPaymentAction, setSavingPaymentAction] = useState(false);
  const [paymentActionReason, setPaymentActionReason] = useState("");
  const [trialExtensionDays, setTrialExtensionDays] = useState("14");
  const [trialExtensionReason, setTrialExtensionReason] = useState("");
  const [savingTrialExtension, setSavingTrialExtension] = useState(false);
  const [timelineNote, setTimelineNote] = useState("");
  const [timelineFollowUpAt, setTimelineFollowUpAt] = useState("");
  const [savingTimelineNote, setSavingTimelineNote] = useState(false);
  const [collectionsWindowDays, setCollectionsWindowDays] = useState<7 | 15 | 30>(15);
  const [collectionsFilter, setCollectionsFilter] = useState<CollectionsFilter>("all");
  const [collectionsFromDate, setCollectionsFromDate] = useState("");
  const [collectionsToDate, setCollectionsToDate] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "archived">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [sortBy, setSortBy] = useState<"priority" | "name" | "nextBillingAt" | "trialEndsAt" | "monthlyPrice">(
    "priority"
  );
  const [urgentOnly, setUrgentOnly] = useState(false);

  const [tenantForm, setTenantForm] = useState({
    slug: "",
    displayName: "",
    plan: "basic" as "trial" | "basic" | "pro",
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [billingForm, setBillingForm] = useState({
    plan: "basic" as "trial" | "basic" | "pro",
    billingCycle: "monthly" as "monthly" | "yearly",
    monthlyPrice: "0",
    trialEndsAt: "",
    nextBillingAt: "",
    paymentStatus: "pending" as "pending" | "paid" | "overdue",
    reviewRequestEnabled: false,
    reviewDeliveryMode: "google_sheet" as "google_sheet" | "email_app",
    reviewGoogleSheetUrl: "",
    documentsStorageEnabled: false,
    storageQuotaGb: "0",
    checkoutDigitalEnabled: false,
    officeWorkflowEnabled: false,
    checkoutEmailEnabled: false,
  });
  /** Evita di sovrascrivere il form billing (es. ragione sociale non salvata) al reload tenant dopo upload logo. */
  const syncedBillingTenantIdRef = useRef<string | null>(null);
  const [editingTenantUser, setEditingTenantUser] = useState<TenantUserItem | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: "",
    email: "",
    role: "worker" as "admin" | "backoffice" | "worker",
  });
  const [savingTenantUserEdit, setSavingTenantUserEdit] = useState(false);
  const [userForm, setUserForm] = useState({
    tenantId: "",
    fullName: "",
    email: "",
    password: "",
    role: "worker" as "admin" | "backoffice" | "worker",
  });

  function toDateInput(iso: string | null) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function fromDateInput(value: string) {
    if (!value) return null;
    return new Date(`${value}T00:00:00.000Z`).toISOString();
  }

  function daysUntil(iso: string | null) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const diff = date.getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  }

  function formatDate(iso: string | null) {
    if (!iso) return "-";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString();
  }

  function paymentStatusLabel(status: PaymentStatus) {
    if (status === "paid") return "Pagato";
    if (status === "overdue") return "Insoluto";
    return "In attesa";
  }

  function paymentStatusTone(status: PaymentStatus) {
    if (status === "paid") return "bg-green-100 text-green-700";
    if (status === "overdue") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  }

  function formatCurrency(value: number) {
    return `€ ${value.toFixed(2)}`;
  }

  function getUrgencyBadge(days: number | null, context: "trial" | "payment") {
    if (days === null) return { label: "Data mancante", toneClass: "bg-gray-100 text-gray-700" };
    if (days < 0) return { label: `${context === "trial" ? "Trial" : "Scadenza"} scaduto`, toneClass: "bg-red-100 text-red-700" };
    if (days === 0) return { label: "Scade oggi", toneClass: "bg-red-100 text-red-700" };
    if (days === 1) return { label: "Scade domani", toneClass: "bg-amber-100 text-amber-700" };
    if (days <= 3) return { label: `Scade tra ${days}g`, toneClass: "bg-amber-100 text-amber-700" };
    if (days <= 7) return { label: `Scade tra ${days}g`, toneClass: "bg-blue-100 text-blue-700" };
    return { label: `Scade tra ${days}g`, toneClass: "bg-gray-100 text-gray-700" };
  }

  function bytesToGbLabel(bytes: number) {
    return (bytes / (1024 ** 3)).toFixed(2);
  }

  function getBillingSituation(tenant: TenantListItem): BillingSituation {
    if (tenant.plan === "trial") {
      const trialDays = daysUntil(tenant.trialEndsAt);
      if (trialDays === null) {
        return {
          label: "Trial",
          detail: "Fine trial non impostata",
          tone: "gray",
        };
      }
      if (trialDays < 0) {
        return {
          label: "Trial scaduto",
          detail: `Scaduto da ${Math.abs(trialDays)} giorni`,
          tone: "red",
        };
      }
      return {
        label: "Trial attivo",
        detail: `Termina il ${formatDate(tenant.trialEndsAt)}`,
        tone: trialDays <= 7 ? "amber" : "blue",
      };
    }

    if (!tenant.nextBillingAt) {
      return {
        label: "Scadenza mancante",
        detail: "Imposta la prossima data di pagamento",
        tone: "gray",
      };
    }

    const dueInDays = daysUntil(tenant.nextBillingAt);
    if (tenant.paymentStatus === "overdue") {
      return {
        label: "Da contattare ora",
        detail: dueInDays !== null && dueInDays < 0 ? `Scaduto da ${Math.abs(dueInDays)} giorni` : "Pagamento insoluto",
        tone: "red",
      };
    }

    if (dueInDays !== null && dueInDays < 0) {
      return {
        label: tenant.paymentStatus === "paid" ? "Da aggiornare" : "Scaduto",
        detail:
          tenant.paymentStatus === "paid"
            ? "Pagamento registrato ma scadenza non avanzata"
            : `Scaduto da ${Math.abs(dueInDays)} giorni`,
        tone: tenant.paymentStatus === "paid" ? "amber" : "red",
      };
    }

    if (dueInDays !== null && dueInDays <= 7) {
      return {
        label: "In scadenza",
        detail: `Scade il ${formatDate(tenant.nextBillingAt)}`,
        tone: "amber",
      };
    }

    return {
      label: tenant.paymentStatus === "paid" ? "Regolare" : "Programmato",
      detail: `Prossima scadenza ${formatDate(tenant.nextBillingAt)}`,
      tone: tenant.paymentStatus === "paid" ? "green" : "blue",
    };
  }

  function billingToneClass(tone: BillingSituation["tone"]) {
    if (tone === "red") return "bg-red-100 text-red-700";
    if (tone === "amber") return "bg-amber-100 text-amber-700";
    if (tone === "green") return "bg-green-100 text-green-700";
    if (tone === "blue") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  }

  function getPriorityScore(tenant: TenantListItem) {
    let score = 0;
    const trialDays = daysUntil(tenant.trialEndsAt);
    const billingDays = daysUntil(tenant.nextBillingAt);
    if (tenant.paymentStatus === "overdue") score += 100;
    else if (tenant.paymentStatus === "pending" && billingDays !== null && billingDays <= 7) score += 50;
    if (tenant.plan === "trial" && trialDays !== null && trialDays <= 7) score += 20;
    if (tenant.status === "suspended") score += 10;
    return score;
  }

  function getSuspensionBadge(tenant: TenantListItem): SuspensionBadge | null {
    if (tenant.status !== "suspended") return null;
    const trialDays = daysUntil(tenant.trialEndsAt);
    if (tenant.plan === "trial" && trialDays !== null && trialDays < 0) {
      return {
        label: "Sospeso automatico: trial scaduto",
        toneClass: "bg-amber-100 text-amber-800",
      };
    }
    if (tenant.paymentStatus === "overdue") {
      return {
        label: "Sospeso automatico: insoluto",
        toneClass: "bg-red-100 text-red-800",
      };
    }
    return {
      label: "Sospeso",
      toneClass: "bg-gray-100 text-gray-700",
    };
  }

  async function loadTenants() {
    try {
      setLoadingTenants(true);
      const rows = await saasAdminAPI.listTenants();
      setTenants(rows);
      if (!selectedTenantId && rows.length > 0) setSelectedTenantId(rows[0].id);
    } catch (error) {
      console.error(error);
      const raw = error instanceof Error ? error.message : "";
      if (raw.startsWith("403:")) {
        toast.error("Accesso negato: account non configurato come Super Admin piattaforma");
      } else if (raw.startsWith("500:")) {
        toast.error(
          "Errore server (verifica migration DB: checkoutHeaderLayout / checkoutBrandColor)"
        );
      } else {
        toast.error("Errore caricamento clienti SaaS");
      }
    } finally {
      setLoadingTenants(false);
    }
  }

  async function loadTenantUsers(tenantId: string) {
    if (!tenantId) return;
    try {
      setLoadingUsers(true);
      setTenantUsers(await saasAdminAPI.listTenantUsers(tenantId));
    } catch (error) {
      console.error(error);
      toast.error("Errore caricamento utenti cliente");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadBillingEvents(tenantId: string) {
    if (!tenantId) return;
    try {
      setLoadingBillingEvents(true);
      setBillingEvents(await saasAdminAPI.listTenantBillingEvents(tenantId));
    } catch (error) {
      console.error(error);
      toast.error("Errore caricamento storico billing");
    } finally {
      setLoadingBillingEvents(false);
    }
  }

  useEffect(() => {
    void loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (!selectedTenantId) {
      setTenantUsers([]);
      setBillingEvents([]);
      return;
    }
    setUserForm((prev) => ({ ...prev, tenantId: selectedTenantId }));
    loadTenantUsers(selectedTenantId);
    loadBillingEvents(selectedTenantId);
  }, [selectedTenantId]);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [tenants, selectedTenantId]
  );

  useEffect(() => {
    syncedBillingTenantIdRef.current = null;
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedTenant) return;
    if (syncedBillingTenantIdRef.current === selectedTenant.id) return;
    syncedBillingTenantIdRef.current = selectedTenant.id;
    setBillingForm({
      plan: selectedTenant.plan,
      billingCycle: selectedTenant.billingCycle,
      monthlyPrice: String(selectedTenant.monthlyPrice),
      trialEndsAt: toDateInput(selectedTenant.trialEndsAt),
      nextBillingAt: toDateInput(selectedTenant.nextBillingAt),
      paymentStatus: selectedTenant.paymentStatus,
      reviewRequestEnabled: selectedTenant.reviewRequestEnabled,
      reviewDeliveryMode: selectedTenant.reviewDeliveryMode ?? "google_sheet",
      reviewGoogleSheetUrl: selectedTenant.reviewGoogleSheetId
        ? `https://docs.google.com/spreadsheets/d/${selectedTenant.reviewGoogleSheetId}/edit`
        : "",
      documentsStorageEnabled: selectedTenant.documentsStorageEnabled,
      storageQuotaGb: String(selectedTenant.storageQuotaBytes / (1024 ** 3)),
      checkoutDigitalEnabled: selectedTenant.checkoutDigitalEnabled ?? false,
      officeWorkflowEnabled: selectedTenant.officeWorkflowEnabled ?? false,
      checkoutEmailEnabled: selectedTenant.checkoutEmailEnabled ?? false,
    });
    setTrialExtensionReason("");
    setTrialExtensionDays("14");
  }, [selectedTenant]);

  useEffect(() => {
    if (searchParams.get("focus") !== "collections") return;
    collectionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const dashboard = useMemo(() => {
    const trialExpiringSoon = tenants.filter((t) => t.plan === "trial" && (daysUntil(t.trialEndsAt) ?? 999) <= 7).length;
    const overdue = tenants.filter((t) => t.paymentStatus === "overdue").length;
    const dueSoon = tenants.filter((t) => t.paymentStatus !== "overdue" && (daysUntil(t.nextBillingAt) ?? 999) <= 7).length;
    const mrr = tenants.reduce((sum, t) => sum + (t.billingCycle === "yearly" ? t.monthlyPrice / 12 : t.monthlyPrice), 0);
    const actionNow = tenants.filter((t) => {
      const situation = getBillingSituation(t);
      return situation.tone === "red";
    }).length;
    const trialCandidates = tenants
      .filter((t) => t.plan === "trial" && t.trialEndsAt)
      .map((t) => ({
        tenantName: t.displayName,
        trialEndsAt: t.trialEndsAt as string,
        daysLeft: daysUntil(t.trialEndsAt),
      }))
      .filter((row) => row.daysLeft !== null)
      .sort((a, b) => (a.daysLeft as number) - (b.daysLeft as number));
    const nextTrial = trialCandidates[0] ?? null;
    return { trialExpiringSoon, overdue, dueSoon, mrr, actionNow, nextTrial };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getBillingSituation is stable helper
  }, [tenants]);

  const allActionItems = useMemo(() => buildAllActionItems(tenants), [tenants]);

  const actionItems = useMemo<ActionItem[]>(
    () =>
      allActionItems.slice(0, 12).map((item) => ({
        tenantId: item.tenantId,
        tenantName: item.tenantName,
        priority: item.priority,
        reason: item.reason,
      })),
    [allActionItems]
  );

  const collectionsRows = useMemo<CollectionRow[]>(() => {
    const hasCustomRange = Boolean(collectionsFromDate && collectionsToDate);
    const fromTs = collectionsFromDate ? new Date(`${collectionsFromDate}T00:00:00`).getTime() : null;
    const toTs = collectionsToDate ? new Date(`${collectionsToDate}T23:59:59`).getTime() : null;

    const rows = tenants
      .map((tenant): CollectionRow => {
        const dueInDays = daysUntil(tenant.nextBillingAt);
        let priority: CollectionRow["priority"] = "normal";
        if (tenant.paymentStatus === "overdue") priority = "critical";
        else if (dueInDays !== null && dueInDays <= 3) priority = "high";
        return {
          tenantId: tenant.id,
          tenantName: tenant.displayName,
          amount: tenant.monthlyPrice,
          billingCycle: tenant.billingCycle,
          paymentStatus: tenant.paymentStatus,
          dueAt: tenant.nextBillingAt,
          dueInDays,
          priority,
          lastPaymentAt: tenant.lastPaymentAt,
        };
      })
      .filter((row) => row.dueAt);

    return rows
      .filter((row) => {
        const dueTs = row.dueAt ? new Date(row.dueAt).getTime() : null;
        if (hasCustomRange && dueTs !== null && fromTs !== null && toTs !== null) {
          const inCustomRange = dueTs >= fromTs && dueTs <= toTs;
          if (!inCustomRange && row.paymentStatus !== "overdue") return false;
        }
        if (row.paymentStatus === "overdue") {
          return collectionsFilter === "all" || collectionsFilter === "overdue";
        }
        const dueIn = row.dueInDays ?? 9999;
        const inWindow = dueIn >= 0 && dueIn <= collectionsWindowDays;
        if (collectionsFilter === "all") return inWindow;
        if (collectionsFilter === "dueSoon") return dueIn >= 0 && dueIn <= 3;
        if (collectionsFilter === "upcoming") return dueIn >= 4 && dueIn <= collectionsWindowDays;
        return false;
      })
      .sort((a, b) => {
        const rank = { critical: 0, high: 1, normal: 2 } as const;
        if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
        return (a.dueInDays ?? 9999) - (b.dueInDays ?? 9999);
      });
  }, [tenants, collectionsWindowDays, collectionsFilter, collectionsFromDate, collectionsToDate]);

  const collectionsSummary = useMemo(() => {
    const total = collectionsRows.reduce((sum, row) => sum + row.amount, 0);
    const overdue = collectionsRows
      .filter((row) => row.paymentStatus === "overdue")
      .reduce((sum, row) => sum + row.amount, 0);
    const dueSoon = collectionsRows
      .filter((row) => row.paymentStatus !== "overdue" && (row.dueInDays ?? 999) <= 3)
      .reduce((sum, row) => sum + row.amount, 0);
    const fromTs = collectionsFromDate ? new Date(`${collectionsFromDate}T00:00:00`).getTime() : null;
    const toTs = collectionsToDate ? new Date(`${collectionsToDate}T23:59:59`).getTime() : null;
    const hasCustomRange = Boolean(fromTs && toTs);
    const collectedEffective = tenants.reduce((sum, tenant) => {
      if (!tenant.lastPaymentAt) return sum;
      const paymentTs = new Date(tenant.lastPaymentAt).getTime();
      if (Number.isNaN(paymentTs)) return sum;
      if (hasCustomRange && fromTs !== null && toTs !== null) {
        if (paymentTs < fromTs || paymentTs > toTs) return sum;
      }
      return sum + tenant.monthlyPrice;
    }, 0);
    return {
      total,
      overdue,
      dueSoon,
      collectedEffective,
      delta: collectedEffective - total,
    };
  }, [collectionsRows, tenants, collectionsFromDate, collectionsToDate]);

  function runCsvExport(fn: () => void, emptyMessage: string) {
    try {
      fn();
      toast.success("CSV scaricato");
    } catch (err) {
      toast.error(csvExportErrorMessage(err, emptyMessage));
    }
  }

  function handleExportCollections() {
    runCsvExport(
      () => exportCollectionsCsv(collectionsRows),
      "Nessun dato incassi da esportare"
    );
  }

  function handleExportTenants() {
    runCsvExport(
      () => exportTenantsRegistryCsv(visibleTenants),
      "Nessun tenant con i filtri attuali"
    );
  }

  function handleExportActions() {
    runCsvExport(
      () => exportActionItemsCsv(allActionItems),
      "Nessuna azione prioritaria da esportare"
    );
  }

  function handleExportMrr() {
    runCsvExport(() => exportMrrSummaryCsv(tenants), "Nessun tenant da esportare");
  }

  function handleExportModalUsers() {
    if (!selectedTenant) return;
    runCsvExport(
      () => exportTenantUsersCsv(selectedTenant, tenantUsers),
      "Nessun utente in questo tenant"
    );
  }

  function handleExportModalBilling() {
    if (!selectedTenant) return;
    runCsvExport(
      () => exportBillingEventsCsv(selectedTenant, billingEvents),
      "Nessun evento in cronologia"
    );
  }

  async function handleExportFullPackage() {
    if (exportBusy) return;
    setExportBusy(true);
    const toastId = toast.loading("Preparazione export completo…");
    try {
      const fileCount = await exportSuperAdminFullPackage(
        {
          tenants,
          visibleTenants,
          collectionsRows,
          allActionItems,
        },
        (message) => toast.loading(message, { id: toastId })
      );
      if (fileCount === 0) {
        toast.error("Nessun dato disponibile per l'export", { id: toastId });
      } else {
        toast.success(
          `Export completato: ${fileCount} file scaricati (consenti download multipli se richiesto)`,
          { id: toastId, duration: 6000 }
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Export interrotto", { id: toastId });
    } finally {
      setExportBusy(false);
    }
  }

  function clearCollectionsDateRange() {
    setCollectionsFromDate("");
    setCollectionsToDate("");
  }

  const visibleTenants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rows = tenants.filter((t) => {
      const searchOk = !term || t.displayName.toLowerCase().includes(term) || t.slug.toLowerCase().includes(term);
      const statusOk = statusFilter === "all" || t.status === statusFilter;
      const paymentOk = paymentFilter === "all" || t.paymentStatus === paymentFilter;
      const trialDays = daysUntil(t.trialEndsAt);
      const billingDays = daysUntil(t.nextBillingAt);
      const autoSuspended =
        t.status === "suspended" &&
        ((t.plan === "trial" && (trialDays ?? 0) < 0) || t.paymentStatus === "overdue");
      const trialUrgent = t.plan === "trial" && (trialDays ?? 999) <= 3;
      const dueSoon = t.paymentStatus === "pending" && billingDays !== null && billingDays <= 3;
      const trialExpiringOnly = t.plan === "trial" && trialDays !== null && trialDays >= 0 && trialDays <= 7;
      const overdueExpiredOnly =
        t.paymentStatus === "overdue" && billingDays !== null && billingDays < 0;
      const focusOk =
        focusFilter === "all" ||
        (focusFilter === "autoSuspended" && autoSuspended) ||
        (focusFilter === "trialUrgent" && trialUrgent) ||
        (focusFilter === "overdueOnly" && t.paymentStatus === "overdue") ||
        (focusFilter === "dueSoon" && dueSoon) ||
        (focusFilter === "trialExpiringOnly" && trialExpiringOnly) ||
        (focusFilter === "overdueExpiredOnly" && overdueExpiredOnly);
      const urgentMatch =
        autoSuspended ||
        trialUrgent ||
        overdueExpiredOnly ||
        dueSoon ||
        (t.paymentStatus === "overdue");
      const urgentOk = !urgentOnly || urgentMatch;
      return searchOk && statusOk && paymentOk && focusOk && urgentOk;
    });
    const toTs = (value: string | null) => (value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER);
    rows.sort((a, b) => {
      if (sortBy === "name") return a.displayName.localeCompare(b.displayName);
      if (sortBy === "nextBillingAt") return toTs(a.nextBillingAt) - toTs(b.nextBillingAt);
      if (sortBy === "trialEndsAt") return toTs(a.trialEndsAt) - toTs(b.trialEndsAt);
      if (sortBy === "monthlyPrice") return b.monthlyPrice - a.monthlyPrice;
      return getPriorityScore(b) - getPriorityScore(a);
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getPriorityScore is stable helper
  }, [tenants, searchTerm, statusFilter, paymentFilter, focusFilter, sortBy, urgentOnly]);

  function extractApiErrorMessage(error: unknown, fallback: string) {
    const raw = (error as { message?: string } | undefined)?.message;
    if (!raw) return fallback;
    const parts = raw.split(":");
    const maybeJson = parts.slice(1).join(":").trim();
    try {
      const parsed = JSON.parse(maybeJson) as { message?: string };
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore
    }
    return raw;
  }

  function shiftBillingDate(baseIso: string | null, cycle: "monthly" | "yearly", direction: 1 | -1) {
    if (!baseIso) return null;
    const date = new Date(baseIso);
    if (Number.isNaN(date.getTime())) return null;
    if (cycle === "yearly") date.setFullYear(date.getFullYear() + direction);
    else date.setMonth(date.getMonth() + direction);
    return date.toISOString();
  }

  async function handleCreateTenant() {
    if (!tenantForm.slug || !tenantForm.displayName || !tenantForm.adminFullName || !tenantForm.adminEmail || !tenantForm.adminPassword) {
      toast.error("Compila tutti i campi");
      return;
    }
    try {
      const created = await saasAdminAPI.createTenant({
        slug: tenantForm.slug.trim().toLowerCase(),
        displayName: tenantForm.displayName.trim(),
        plan: tenantForm.plan,
        admin: {
          fullName: tenantForm.adminFullName.trim(),
          email: tenantForm.adminEmail.trim().toLowerCase(),
          password: tenantForm.adminPassword,
        },
      });
      toast.success("Tenant creato");
      setTenantForm({
        slug: "",
        displayName: "",
        plan: "basic",
        adminFullName: "",
        adminEmail: "",
        adminPassword: "",
      });
      setShowCreateModal(false);
      await loadTenants();
      setSelectedTenantId(created.tenant.id);
    } catch (error) {
      console.error(error);
      toast.error(extractApiErrorMessage(error, "Errore creazione tenant"));
    }
  }

  async function handleSaveBilling() {
    if (!selectedTenant) return;
    const price = Number(billingForm.monthlyPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Prezzo non valido");
      return;
    }
    try {
      setSavingBilling(true);
      const storageQuotaGb = Number(billingForm.storageQuotaGb);
      if (!Number.isFinite(storageQuotaGb) || storageQuotaGb < 0) {
        toast.error("Quota storage non valida");
        return;
      }
      if (
        billingForm.reviewRequestEnabled &&
        billingForm.reviewDeliveryMode === "google_sheet" &&
        !billingForm.reviewGoogleSheetUrl.trim()
      ) {
        toast.error("Inserisci l'URL del foglio Google per le recensioni");
        return;
      }
      await saasAdminAPI.updateTenantBilling(selectedTenant.id, {
        plan: billingForm.plan,
        billingCycle: billingForm.billingCycle,
        monthlyPrice: price,
        trialEndsAt: billingForm.plan === "trial" ? fromDateInput(billingForm.trialEndsAt) : null,
        nextBillingAt: fromDateInput(billingForm.nextBillingAt),
        paymentStatus: billingForm.paymentStatus,
        reviewRequestEnabled: billingForm.reviewRequestEnabled,
        reviewDeliveryMode: billingForm.reviewDeliveryMode,
        reviewGoogleSheetUrl: billingForm.reviewGoogleSheetUrl.trim() || null,
        documentsStorageEnabled: billingForm.documentsStorageEnabled,
        storageQuotaBytes: Math.round(storageQuotaGb * 1024 ** 3),
        checkoutDigitalEnabled: billingForm.checkoutDigitalEnabled,
        officeWorkflowEnabled: billingForm.officeWorkflowEnabled,
        checkoutEmailEnabled: billingForm.checkoutEmailEnabled,
      });
      toast.success("Billing aggiornato");
      await loadTenants();
      await loadBillingEvents(selectedTenant.id);
    } catch (error) {
      console.error(error);
      toast.error("Errore salvataggio billing");
    } finally {
      setSavingBilling(false);
    }
  }

  function openRegisterPaymentDialog() {
    if (!selectedTenant) return;
    setPaymentDialogMode("register");
    setPaymentActionReason("");
  }

  function openUndoPaymentDialog() {
    if (!selectedTenant) return;
    setPaymentDialogMode("undo");
    setPaymentActionReason("");
  }

  async function handleConfirmPaymentAction() {
    if (!selectedTenant || !paymentDialogMode) return;
    try {
      setSavingPaymentAction(true);
      const reason = paymentActionReason.trim();
      if (reason.length < 3) {
        toast.error("Inserisci una causale di almeno 3 caratteri");
        return;
      }
      if (paymentDialogMode === "register") {
        const nextBillingAt = shiftBillingDate(
          selectedTenant.nextBillingAt ?? new Date().toISOString(),
          selectedTenant.billingCycle,
          1
        );
        await saasAdminAPI.updateTenantBilling(selectedTenant.id, {
          paymentStatus: "paid",
          lastPaymentAt: new Date().toISOString(),
          nextBillingAt,
          billingNote: `registrazione incasso: ${reason}`,
        });
        toast.success(selectedTenant.billingCycle === "yearly" ? "Incasso annuale registrato" : "Incasso mensile registrato");
      } else {
        await saasAdminAPI.updateTenantBilling(selectedTenant.id, {
          paymentStatus: "pending",
          lastPaymentAt: null,
          nextBillingAt: shiftBillingDate(selectedTenant.nextBillingAt, selectedTenant.billingCycle, -1),
          billingNote: `storno incasso: ${reason}`,
        });
        toast.success("Ultimo incasso annullato");
      }
      await loadTenants();
      await loadBillingEvents(selectedTenant.id);
      setPaymentDialogMode(null);
    } catch (error) {
      console.error(error);
      toast.error(paymentDialogMode === "register" ? "Errore registrazione incasso" : "Errore annullamento incasso");
    } finally {
      setSavingPaymentAction(false);
    }
  }

  async function handleMarkOverdue() {
    if (!selectedTenant) return;
    try {
      await saasAdminAPI.updateTenantBilling(selectedTenant.id, {
        paymentStatus: "overdue",
      });
      toast.success("Tenant segnato come insoluto");
      await loadTenants();
      await loadBillingEvents(selectedTenant.id);
    } catch (error) {
      console.error(error);
      toast.error("Errore aggiornamento stato insoluto");
    }
  }

  async function handleExtendTrial() {
    if (!selectedTenant) return;
    if (selectedTenant.plan !== "trial") {
      toast.error("Questa azione e disponibile solo per tenant in trial");
      return;
    }
    const days = Number(trialExtensionDays);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error("Numero giorni non valido");
      return;
    }
    const reason = trialExtensionReason.trim();
    if (reason.length < 3) {
      toast.error("Inserisci una motivazione di almeno 3 caratteri");
      return;
    }
    const baseIso = selectedTenant.trialEndsAt ?? new Date().toISOString();
    const baseDate = new Date(baseIso);
    if (Number.isNaN(baseDate.getTime())) {
      toast.error("Data trial non valida");
      return;
    }
    baseDate.setDate(baseDate.getDate() + days);
    try {
      setSavingTrialExtension(true);
      await saasAdminAPI.updateTenantBilling(selectedTenant.id, {
        trialEndsAt: baseDate.toISOString(),
        nextBillingAt: baseDate.toISOString(),
        billingNote: `estensione trial +${days}g: ${reason}`,
      });
      toast.success(`Trial esteso di ${days} giorni`);
      await loadTenants();
      await loadBillingEvents(selectedTenant.id);
      setTrialExtensionReason("");
    } catch (error) {
      console.error(error);
      toast.error("Errore estensione trial");
    } finally {
      setSavingTrialExtension(false);
    }
  }

  async function handleAddTimelineNote() {
    if (!selectedTenant) return;
    const note = timelineNote.trim();
    if (note.length < 3) {
      toast.error("Inserisci una nota di almeno 3 caratteri");
      return;
    }
    const followUpLabel = timelineFollowUpAt
      ? ` | follow-up: ${new Date(`${timelineFollowUpAt}T00:00:00`).toLocaleDateString()}`
      : "";
    try {
      setSavingTimelineNote(true);
      await saasAdminAPI.updateTenantBilling(selectedTenant.id, {
        billingNote: `nota operativa: ${note}${followUpLabel}`,
      });
      toast.success("Nota operativa salvata");
      setTimelineNote("");
      setTimelineFollowUpAt("");
      await loadBillingEvents(selectedTenant.id);
    } catch (error) {
      console.error(error);
      toast.error("Errore salvataggio nota operativa");
    } finally {
      setSavingTimelineNote(false);
    }
  }

  async function handleCreateTenantUser() {
    if (!userForm.tenantId || !userForm.fullName || !userForm.email || !userForm.password) {
      toast.error("Compila tutti i campi utente");
      return;
    }
    try {
      await saasAdminAPI.createTenantUser({
        tenantId: userForm.tenantId,
        fullName: userForm.fullName.trim(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.password,
        role: userForm.role,
      });
      toast.success("Utente creato");
      setUserForm((prev) => ({ ...prev, fullName: "", email: "", password: "", role: "worker" }));
      await loadTenantUsers(userForm.tenantId);
    } catch (error) {
      console.error(error);
      toast.error(extractApiErrorMessage(error, "Errore creazione utente"));
    }
  }

  async function handleDeleteTenantUser(user: TenantUserItem) {
    if (!window.confirm(`Confermi eliminazione utente "${user.email}"?`)) return;
    try {
      await saasAdminAPI.deleteTenantUser(user.id);
      toast.success("Utente eliminato");
      if (selectedTenantId) await loadTenantUsers(selectedTenantId);
    } catch (error) {
      console.error(error);
      toast.error("Errore eliminazione utente");
    }
  }

  function openEditTenantUser(user: TenantUserItem) {
    setEditingTenantUser(user);
    setEditUserForm({
      fullName: user.fullName || "",
      email: user.email,
      role: user.role,
    });
  }

  function closeEditTenantUser() {
    setEditingTenantUser(null);
    setEditUserForm({ fullName: "", email: "", role: "worker" });
  }

  async function handleSaveTenantUserEdit() {
    if (!editingTenantUser) return;
    const fullName = editUserForm.fullName.trim();
    const email = editUserForm.email.trim().toLowerCase();
    if (fullName.length < 2) {
      toast.error("Il nome deve avere almeno 2 caratteri");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Email non valida");
      return;
    }
    try {
      setSavingTenantUserEdit(true);
      await saasAdminAPI.updateTenantUser(editingTenantUser.id, {
        fullName,
        email,
        role: editUserForm.role,
      });
      toast.success("Utente aggiornato");
      closeEditTenantUser();
      if (selectedTenantId) await loadTenantUsers(selectedTenantId);
    } catch (error) {
      console.error(error);
      toast.error(extractApiErrorMessage(error, "Errore aggiornamento utente"));
    } finally {
      setSavingTenantUserEdit(false);
    }
  }

  async function handleResetTenantUserPassword(user: TenantUserItem) {
    if (!user.workerId) {
      toast.error("WorkerId non disponibile per questo utente");
      return;
    }
    const newPassword = window.prompt(`Nuova password per "${user.email}" (min 6 caratteri):`);
    if (!newPassword) return;
    if (newPassword.trim().length < 6) {
      toast.error("Password troppo corta");
      return;
    }
    try {
      await saasAdminAPI.resetTenantUserPassword(user.workerId, newPassword.trim());
      toast.success("Password aggiornata");
    } catch (error) {
      console.error(error);
      toast.error("Errore reset password");
    }
  }

  async function handleStatusChange(tenant: TenantListItem, nextStatus: "active" | "suspended" | "archived") {
    try {
      await saasAdminAPI.updateTenantStatus(tenant.id, nextStatus);
      toast.success(`Stato impostato a ${nextStatus}`);
      await loadTenants();
    } catch (error) {
      console.error(error);
      toast.error("Errore aggiornamento stato");
    }
  }

  async function handleDeleteTenant(tenant: TenantListItem, force = false) {
    const confirmed = force
      ? window.prompt(`Digita "${tenant.slug}" per eliminazione definitiva`) === tenant.slug
      : window.confirm(`Confermi eliminazione tenant "${tenant.displayName}"?`);
    if (!confirmed) return;
    try {
      if (force) await saasAdminAPI.forceDeleteTenant(tenant.id, tenant.slug);
      else await saasAdminAPI.deleteTenant(tenant.id);
      toast.success(force ? "Tenant eliminato definitivamente" : "Tenant eliminato");
      if (selectedTenantId === tenant.id) setSelectedTenantId("");
      await loadTenants();
    } catch (error) {
      console.error(error);
      toast.error(force ? "Errore eliminazione definitiva" : "Impossibile eliminare tenant");
    }
  }

  function applyQuickFilter(type: "trial" | "overdue" | "dueSoon") {
    if (type === "trial") {
      setPaymentFilter("all");
      setSortBy("trialEndsAt");
      setFocusFilter("trialUrgent");
    } else if (type === "overdue") {
      setPaymentFilter("overdue");
      setSortBy("priority");
      setFocusFilter("overdueOnly");
    } else {
      setPaymentFilter("pending");
      setSortBy("nextBillingAt");
      setFocusFilter("dueSoon");
    }
  }

  function resetAllFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setFocusFilter("all");
    setSortBy("priority");
    setUrgentOnly(false);
  }

  const projectedNextBillingAtLabel = useMemo(() => {
    if (!selectedTenant) return "-";
    const shifted = shiftBillingDate(selectedTenant.nextBillingAt ?? new Date().toISOString(), selectedTenant.billingCycle, 1);
    return shifted ? formatDate(shifted) : "-";
  }, [selectedTenant]);

  const projectedUndoBillingAtLabel = useMemo(() => {
    if (!selectedTenant) return "-";
    const shifted = shiftBillingDate(selectedTenant.nextBillingAt, selectedTenant.billingCycle, -1);
    return shifted ? formatDate(shifted) : "-";
  }, [selectedTenant]);

  function openTenantDetail(tenantId: string) {
    setSelectedTenantId(tenantId);
    setActiveTab("overview");
    setShowTenantModal(true);
  }

  function openTenantBillingTab(tenantId: string) {
    setSelectedTenantId(tenantId);
    setActiveTab("billing");
    setShowTenantModal(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Super Admin SaaS"
        description="Gestione tenant e piattaforma."
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Link
              to="/backoffice/tenant-backups"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/5 transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              Backup tenant
            </Link>
            <Button
              type="button"
              variant="secondary"
              disabled={exportBusy}
              onClick={() => void handleExportFullPackage()}
              className="w-full gap-2 py-2.5 font-semibold sm:w-auto"
            >
              <Download size={16} aria-hidden />
              {exportBusy ? "Export…" : "Export completo"}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="w-full py-2.5 font-semibold sm:w-auto"
            >
              + Nuovo tenant
            </Button>
          </div>
        }
      />

      <section className={cn(surfaceCardClass, "p-4 sm:p-5")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:border-orange-200 hover:bg-white"
          onClick={() => setSearchTerm("")}
        >
          <p className="text-xs font-medium text-slate-500">Totale tenant</p>
          <p className="text-xl font-semibold text-slate-900">{tenants.length}</p>
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:border-orange-200 hover:bg-white" onClick={() => applyQuickFilter("trial")}>
          <p className="text-xs font-medium text-slate-500">Trial in scadenza</p>
          <p className="text-xl font-semibold text-slate-900">{dashboard.trialExpiringSoon}</p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {dashboard.nextTrial
              ? `${dashboard.nextTrial.tenantName}: ${formatDate(dashboard.nextTrial.trialEndsAt)} (${dashboard.nextTrial.daysLeft}g)`
              : "Nessun trial attivo"}
          </p>
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:border-orange-200 hover:bg-white" onClick={() => applyQuickFilter("dueSoon")}>
          <p className="text-xs font-medium text-slate-500">Pagamenti in scadenza</p>
          <p className="text-xl font-semibold text-slate-900">{dashboard.dueSoon}</p>
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:border-orange-200 hover:bg-white" onClick={() => applyQuickFilter("overdue")}>
          <p className="text-xs font-medium text-slate-500">Pagamenti scaduti</p>
          <p className="text-xl font-semibold text-red-700">{dashboard.overdue}</p>
        </button>
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-sm ring-1 ring-slate-900/5">
          <p className="text-xs font-medium text-slate-500">Da contattare ora</p>
          <p className="text-xl font-semibold text-red-700">{dashboard.actionNow}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-sm ring-1 ring-slate-900/5 sm:col-span-1">
          <p className="text-xs font-medium text-slate-500">MRR stimato</p>
          <p className="text-xl font-semibold text-slate-900">€ {dashboard.mrr.toFixed(2)}</p>
        </div>
        </div>
      </section>

      <section className={cn(surfaceCardClass, "space-y-3 p-4 sm:p-5")}>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Export CSV</h2>
          <p className="text-xs text-slate-500">
            File UTF-8 per Excel. Il pacchetto completo scarica tutti i report (consenti download
            multipli nel browser).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            disabled={exportBusy}
            onClick={handleExportCollections}
          >
            Incassi
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            disabled={exportBusy}
            onClick={handleExportTenants}
          >
            Anagrafica tenant
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            disabled={exportBusy}
            onClick={handleExportActions}
          >
            Azioni prioritarie
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-xs"
            disabled={exportBusy}
            onClick={handleExportMrr}
          >
            MRR / ricavi
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-1 text-xs font-semibold"
            disabled={exportBusy}
            onClick={() => void handleExportFullPackage()}
          >
            <Download size={14} aria-hidden />
            Pacchetto completo
          </Button>
        </div>
      </section>

      <section className={cn(surfaceCardClass, "space-y-4 p-4 sm:p-5")}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Centro azioni giornaliero</h2>
            <p className="text-xs text-slate-500">
              Priorità operative: {allActionItems.length}
              {allActionItems.length > 12 ? " (prime 12 in elenco)" : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full text-xs sm:w-auto"
            disabled={exportBusy || allActionItems.length === 0}
            onClick={handleExportActions}
          >
            Esporta azioni
          </Button>
        </div>
        {actionItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-600">
            Nessuna azione urgente al momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {actionItems.map((item) => (
              <button
                key={`${item.tenantId}-${item.reason}`}
                type="button"
                className="flex w-full flex-col gap-1 rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:border-orange-200 hover:bg-orange-50/30"
                onClick={() => openTenantBillingTab(item.tenantId)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.tenantName}</p>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-md ${item.priority === "high" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                    {item.priority === "high" ? "Alta" : "Media"}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">{item.reason}</p>
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-orange-700">
                  Apri abbonamento
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section
        ref={collectionsSectionRef}
        className={cn(surfaceCardClass, "space-y-4 p-4 sm:p-5")}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Report incassi</h2>
            <p className="text-xs text-slate-500">
              Cosa incassare e quando, con priorità operative.
            </p>
          </div>
          <div className={cn(filterBarClass, "flex w-full flex-col gap-2 lg:max-w-3xl xl:max-w-4xl")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <select
                className={cn(selectFieldClass, "w-full min-w-0 sm:min-w-[160px] sm:flex-1")}
                value={collectionsWindowDays}
                onChange={(e) => setCollectionsWindowDays(Number(e.target.value) as 7 | 15 | 30)}
              >
                <option value={7}>Finestra 7 giorni</option>
                <option value={15}>Finestra 15 giorni</option>
                <option value={30}>Finestra 30 giorni</option>
              </select>
              <select
                className={cn(selectFieldClass, "w-full min-w-0 sm:min-w-[180px] sm:flex-1")}
                value={collectionsFilter}
                onChange={(e) => setCollectionsFilter(e.target.value as CollectionsFilter)}
              >
                <option value="all">Tutti</option>
                <option value="overdue">Solo insoluti</option>
                <option value="dueSoon">Solo in scadenza (&lt;=3g)</option>
                <option value="upcoming">Solo programmati</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              <input
                type="date"
                className={inputFieldClass}
                aria-label="Data inizio periodo"
                value={collectionsFromDate}
                onChange={(e) => setCollectionsFromDate(e.target.value)}
              />
              <input
                type="date"
                className={inputFieldClass}
                aria-label="Data fine periodo"
                value={collectionsToDate}
                onChange={(e) => setCollectionsToDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="neutral" className="w-full sm:w-auto" onClick={clearCollectionsDateRange}>
                Azzera periodo
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={exportBusy}
                onClick={handleExportCollections}
              >
                Esporta CSV
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs font-medium text-slate-500">Totale da incassare</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{formatCurrency(collectionsSummary.total)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs font-medium text-slate-500">Insoluti</p>
            <p className="text-lg font-semibold tabular-nums text-red-700">{formatCurrency(collectionsSummary.overdue)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs font-medium text-slate-500">Scadenza ≤ 3 giorni</p>
            <p className="text-lg font-semibold tabular-nums text-amber-700">{formatCurrency(collectionsSummary.dueSoon)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-sm ring-1 ring-slate-900/5">
            <p className="text-xs font-medium text-slate-500">Incassato effettivo (periodo)</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-700">{formatCurrency(collectionsSummary.collectedEffective)}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 shadow-sm ring-1 ring-slate-900/5 sm:col-span-1">
            <p className="text-xs font-medium text-slate-500">Scostamento (incassato − previsto)</p>
            <p className={`text-lg font-semibold tabular-nums ${collectionsSummary.delta < 0 ? "text-red-700" : "text-green-700"}`}>
              {formatCurrency(collectionsSummary.delta)}
            </p>
          </div>
        </div>

        <div className="md:hidden space-y-3" role="list" aria-label="Elenco incassi, vista compatta">
          {collectionsRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
              Nessun movimento in questa finestra. Allarga la finestra temporale o cambia filtro.
            </div>
          ) : (
            collectionsRows.map((row) => (
              <article
                key={`m-coll-${row.tenantId}-${row.dueAt}`}
                role="listitem"
                className={cn(
                  "rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5",
                  row.priority === "critical" && "border-red-200/80 ring-red-100/80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug text-slate-900">{row.tenantName}</h3>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatCurrency(row.amount)}</p>
                    <p className="text-xs text-slate-500">
                      {row.billingCycle === "yearly" ? "Ciclo annuale" : "Ciclo mensile"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold px-2 py-1 rounded-md",
                      row.priority === "critical"
                        ? "bg-red-100 text-red-800"
                        : row.priority === "high"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {row.priority === "critical" ? "Critica" : row.priority === "high" ? "Alta" : "Normale"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Stato</dt>
                    <dd className="mt-0.5">
                      <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-md ${paymentStatusTone(row.paymentStatus)}`}>
                        {paymentStatusLabel(row.paymentStatus)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Scadenza</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{formatDate(row.dueAt)}</dd>
                    <dd className="text-xs text-slate-500">
                      {row.dueInDays !== null
                        ? row.dueInDays < 0
                          ? `${Math.abs(row.dueInDays)} g fa`
                          : `tra ${row.dueInDays} g`
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  className="mt-4 flex w-full items-center justify-center gap-1 bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  onClick={() => openTenantBillingTab(row.tenantId)}
                >
                  Apri dettaglio
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </article>
            ))
          )}
        </div>

        <div className={`hidden md:block ${surfaceCardClass} overflow-hidden`}>
          <div className="max-h-[min(480px,55vh)] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm text-slate-800">
              <caption className="sr-only">
                Elenco incassi previsti per tenant nella finestra temporale e nei filtri selezionati
              </caption>
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 backdrop-blur-sm">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th scope="col" className="whitespace-nowrap px-3 py-3 pl-4">
                    Cliente
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">
                    Importo
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3">
                    Stato pagamento
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3">
                    Scadenza
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3">
                    Priorità
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 pr-4 text-right">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {collectionsRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center text-sm text-slate-500">
                      Nessun movimento in questa finestra. Prova ad allargare i giorni, cambiare filtro o azzerare il
                      periodo personalizzato.
                    </td>
                  </tr>
                ) : (
                  collectionsRows.map((row) => (
                    <tr
                      key={`${row.tenantId}-${row.dueAt}`}
                      className="border-b border-slate-100 transition-colors even:bg-slate-50/40 hover:bg-orange-50/35"
                    >
                      <td className="max-w-[220px] px-3 py-2.5 pl-4 font-medium text-slate-900">
                        <span className="line-clamp-2" title={row.tenantName}>
                          {row.tenantName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        <span className="font-semibold text-slate-900">{formatCurrency(row.amount)}</span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {row.billingCycle === "yearly" ? "Ciclo annuale" : "Ciclo mensile"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-md ${paymentStatusTone(row.paymentStatus)}`}>
                          {paymentStatusLabel(row.paymentStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-900">{formatDate(row.dueAt)}</p>
                        <p className="text-xs text-slate-500">
                          {row.dueInDays !== null
                            ? row.dueInDays < 0
                              ? `${Math.abs(row.dueInDays)} g fa`
                              : `tra ${row.dueInDays} g`
                            : "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex text-xs font-medium px-2 py-1 rounded-md",
                            row.priority === "critical"
                              ? "bg-red-100 text-red-800"
                              : row.priority === "high"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {row.priority === "critical" ? "Critica" : row.priority === "high" ? "Alta" : "Normale"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 pr-4 text-right">
                        <Button
                          type="button"
                          onClick={() => openTenantBillingTab(row.tenantId)}
                          className="bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Apri dettaglio
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={cn(surfaceCardClass, "space-y-4 p-4 sm:p-5")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Tutti i tenant</h2>
              <p className="text-xs text-slate-500">
                Cerca per nome o slug, applica filtri e apri la scheda cliente.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full shrink-0 text-xs sm:w-auto"
              disabled={exportBusy || visibleTenants.length === 0}
              onClick={handleExportTenants}
            >
              Esporta tenant (filtri)
            </Button>
          </div>
          <div className={cn(filterBarClass, "space-y-3")}>
            <input
              className={inputFieldClass}
              placeholder="Cerca cliente o slug"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select className={selectFieldClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="all">Stato: tutti</option>
                <option value="active">Attivo</option>
                <option value="suspended">Sospeso</option>
                <option value="archived">Archiviato</option>
              </select>
              <select className={selectFieldClass} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}>
                <option value="all">Pagamento: tutti</option>
                <option value="pending">In attesa</option>
                <option value="paid">Pagato</option>
                <option value="overdue">Insoluto</option>
              </select>
              <select className={selectFieldClass} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="priority">Ordina: priorità</option>
                <option value="name">Ordina: nome</option>
                <option value="nextBillingAt">Ordina: scadenza pagamento</option>
                <option value="trialEndsAt">Ordina: fine trial</option>
                <option value="monthlyPrice">Ordina: valore</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={urgentOnly ? "danger" : "neutral"}
              onClick={() => setUrgentOnly((v) => !v)}
              className="font-medium"
            >
              Solo urgenti
            </Button>
            <Button
              type="button"
              variant={focusFilter === "autoSuspended" ? "danger" : "neutral"}
              onClick={() => setFocusFilter("autoSuspended")}
              className="font-medium"
            >
              Sospesi automatici
            </Button>
            <Button
              type="button"
              variant={focusFilter === "trialExpiringOnly" ? "warning" : "neutral"}
              onClick={() => setFocusFilter("trialExpiringOnly")}
              className="font-medium"
            >
              Trial in scadenza (7g)
            </Button>
            <Button
              type="button"
              variant={focusFilter === "dueSoon" ? "primary" : "neutral"}
              onClick={() => setFocusFilter("dueSoon")}
              className="font-medium"
            >
              Scadenze imminenti
            </Button>
            <Button
              type="button"
              variant={focusFilter === "overdueExpiredOnly" ? "danger" : "neutral"}
              onClick={() => setFocusFilter("overdueExpiredOnly")}
              className="font-medium"
            >
              Insoluti scaduti
            </Button>
            <Button type="button" variant="neutral" onClick={resetAllFilters} className="bg-slate-200 font-medium hover:bg-slate-300">
              Reset filtri
            </Button>
          </div>

          <div className="md:hidden space-y-3" role="list" aria-label="Tenant, vista compatta">
            {loadingTenants ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
                Caricamento tenant…
              </div>
            ) : visibleTenants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
                Nessun tenant con questi filtri. Modifica la ricerca o usa &quot;Reset filtri&quot;.
              </div>
            ) : (
              visibleTenants.map((tenant) => {
                const situation = getBillingSituation(tenant);
                const suspensionBadge = getSuspensionBadge(tenant);
                const trialDays = daysUntil(tenant.trialEndsAt);
                const selected = selectedTenantId === tenant.id;
                return (
                  <button
                    key={`m-tenant-${tenant.id}`}
                    type="button"
                    role="listitem"
                    onClick={() => openTenantDetail(tenant.id)}
                    className={cn(
                      "w-full rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:border-orange-200 hover:bg-orange-50/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                      selected && "border-orange-200 bg-orange-50/50 ring-orange-200/80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug text-slate-900">{tenant.displayName}</h3>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{tenant.slug}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <TenantFeatureBadges tenant={tenant} />
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                        {planLabelIt(tenant.plan)}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                        {tenantStatusLabelIt(tenant.status)}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${paymentStatusTone(tenant.paymentStatus)}`}>
                        {paymentStatusLabel(tenant.paymentStatus)}
                      </span>
                    </div>
                    {suspensionBadge ? (
                      <span className={`mt-2 inline-block text-xs font-medium px-2 py-1 rounded-md ${suspensionBadge.toneClass}`}>
                        {suspensionBadge.label}
                      </span>
                    ) : null}
                    {tenant.plan === "trial" ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Trial fino al <strong>{formatDate(tenant.trialEndsAt)}</strong>
                        {trialDays !== null ? ` (${trialDays} g)` : ""}
                      </p>
                    ) : null}
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-md ${billingToneClass(situation.tone)}`}>
                        {situation.label}
                      </span>{" "}
                      {situation.detail}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-700">
                      Apri scheda
                      <ChevronRight className="h-3 w-3" aria-hidden />
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className={`hidden md:block ${surfaceCardClass} overflow-hidden`}>
            <div className="max-h-[min(560px,60vh)] overflow-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm text-slate-800">
                <caption className="sr-only">
                  Elenco tenant SaaS con piano, stato account, trial, pagamenti e sintesi operativa. Clicca una riga per
                  aprire il dettaglio.
                </caption>
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 backdrop-blur-sm">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th scope="col" className="whitespace-nowrap px-3 py-3 pl-4">
                      Cliente
                    </th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">
                      Piano
                    </th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">
                      Stato account
                    </th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">
                      Trial
                    </th>
                    <th scope="col" className="whitespace-nowrap px-3 py-3">
                      Pagamento
                    </th>
                    <th scope="col" className="min-w-[200px] px-3 py-3 pr-4">
                      Situazione
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTenants ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center text-sm text-slate-500">
                        Caricamento tenant…
                      </td>
                    </tr>
                  ) : visibleTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center text-sm text-slate-500">
                        Nessun tenant con questi filtri. Modifica la ricerca o usa &quot;Reset filtri&quot;.
                      </td>
                    </tr>
                  ) : (
                    visibleTenants.map((tenant) => {
                      const situation = getBillingSituation(tenant);
                      const suspensionBadge = getSuspensionBadge(tenant);
                      const trialDays = daysUntil(tenant.trialEndsAt);
                      const nextBillingDays = daysUntil(tenant.nextBillingAt);
                      const trialBadge = getUrgencyBadge(trialDays, "trial");
                      const paymentBadge = getUrgencyBadge(nextBillingDays, "payment");
                      const selected = selectedTenantId === tenant.id;
                      return (
                        <tr
                          key={tenant.id}
                          tabIndex={0}
                          title="Apri scheda dettaglio (Invio)"
                          className={cn(
                            "cursor-pointer border-b border-slate-100 transition-colors even:bg-slate-50/40 hover:bg-orange-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400",
                            selected && "bg-orange-50/70 hover:bg-orange-50/80"
                          )}
                          onClick={() => openTenantDetail(tenant.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openTenantDetail(tenant.id);
                            }
                          }}
                        >
                          <td className="max-w-[260px] px-3 py-2.5 pl-4 align-top">
                            <div className="font-semibold text-slate-900 line-clamp-2">{tenant.displayName}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span className="font-mono text-[11px] text-slate-600">{tenant.slug}</span>
                              <TenantFeatureBadges tenant={tenant} />
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-top text-slate-800">
                            {planLabelIt(tenant.plan)}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <p className="font-medium text-slate-900">{tenantStatusLabelIt(tenant.status)}</p>
                            {suspensionBadge ? (
                              <span
                                className={`mt-1 inline-flex max-w-[220px] text-xs font-medium leading-snug px-2 py-1 rounded-md ${suspensionBadge.toneClass}`}
                              >
                                {suspensionBadge.label}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            {tenant.plan === "trial" ? (
                              <div className="space-y-1">
                                <p className="font-medium text-slate-900">{formatDate(tenant.trialEndsAt)}</p>
                                <p className="text-xs text-slate-500">
                                  {trialDays !== null ? `${trialDays} giorni` : "—"}
                                </p>
                                <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-md ${trialBadge.toneClass}`}>
                                  {trialBadge.label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span
                              className={`inline-flex text-xs font-medium px-2 py-1 rounded-md ${paymentStatusTone(tenant.paymentStatus)}`}
                            >
                              {paymentStatusLabel(tenant.paymentStatus)}
                            </span>
                          </td>
                          <td className="max-w-[280px] px-3 py-2.5 pr-4 align-top">
                            <span
                              className={`inline-flex text-xs font-medium px-2 py-1 rounded-md ${billingToneClass(situation.tone)}`}
                            >
                              {situation.label}
                            </span>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{situation.detail}</p>
                            {tenant.paymentStatus !== "paid" ? (
                              <span
                                className={`mt-1 inline-flex text-xs font-medium px-2 py-1 rounded-md ${paymentBadge.toneClass}`}
                              >
                                {paymentBadge.label}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      {showCreateModal && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-xl space-y-3 p-5`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Nuovo tenant
              </h2>
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl text-slate-600 hover:bg-slate-100"
              >
                Chiudi
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className={inputFieldClass} placeholder="Slug" value={tenantForm.slug} onChange={(e) => setTenantForm((p) => ({ ...p, slug: e.target.value }))} />
              <input className={inputFieldClass} placeholder="Ragione sociale" value={tenantForm.displayName} onChange={(e) => setTenantForm((p) => ({ ...p, displayName: e.target.value }))} />
              <select className={selectFieldClass} value={tenantForm.plan} onChange={(e) => setTenantForm((p) => ({ ...p, plan: e.target.value as typeof p.plan }))}>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
              <input className={inputFieldClass} placeholder="Nome admin cliente" value={tenantForm.adminFullName} onChange={(e) => setTenantForm((p) => ({ ...p, adminFullName: e.target.value }))} />
              <input className={inputFieldClass} placeholder="Email admin cliente" value={tenantForm.adminEmail} onChange={(e) => setTenantForm((p) => ({ ...p, adminEmail: e.target.value }))} />
              <input type="password" className={inputFieldClass} placeholder="Password admin" value={tenantForm.adminPassword} onChange={(e) => setTenantForm((p) => ({ ...p, adminPassword: e.target.value }))} />
            </div>
            <Button type="button" variant="primary" onClick={handleCreateTenant} className="w-full py-2.5 font-semibold">
              Crea tenant
            </Button>
          </div>
        </div>
      )}

      {showTenantModal && selectedTenant && (
        <div className={modalBackdropClass}>
          <div
            className={`${modalPanelClass} flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden shadow-2xl`}
          >
            <div className="shrink-0 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-700 ring-1 ring-orange-400/25">
                    <Building2 className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Cliente SaaS
                    </p>
                    <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                      {selectedTenant.displayName}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{selectedTenant.slug}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                          selectedTenant.status === "active" && "bg-emerald-50 text-emerald-800 ring-emerald-200",
                          selectedTenant.status === "suspended" &&
                            "bg-amber-50 text-amber-900 ring-amber-200",
                          selectedTenant.status === "archived" && "bg-slate-100 text-slate-700 ring-slate-200"
                        )}
                      >
                        {tenantStatusLabelIt(selectedTenant.status)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-black/5",
                          paymentStatusTone(selectedTenant.paymentStatus)
                        )}
                      >
                        {paymentStatusLabel(selectedTenant.paymentStatus)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200/80">
                        {planLabelIt(selectedTenant.plan)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowTenantModal(false)}
                  className="shrink-0 rounded-xl text-slate-600 hover:bg-white"
                >
                  Chiudi
                </Button>
              </div>

              <div
                className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
                role="tablist"
                aria-label="Sezioni dettaglio tenant"
              >
                {TENANT_MODAL_TABS.map(({ id, label, hint, Icon }) => {
                  const selected = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(id)}
                      className={cn(
                        "flex min-h-[4.5rem] flex-1 flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 sm:min-w-[132px]",
                        selected
                          ? "border-orange-300 bg-white shadow-md ring-1 ring-orange-200/70"
                          : "border-transparent bg-white/50 hover:border-slate-200 hover:bg-white"
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Icon className="h-4 w-4 shrink-0 text-orange-600" strokeWidth={2} aria-hidden />
                        {label}
                      </span>
                      <span className="text-[11px] leading-snug text-slate-500">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {activeTab === "overview" &&
              (() => {
                const situation = getBillingSituation(selectedTenant);
                const susp = getSuspensionBadge(selectedTenant);
                const trialDays = daysUntil(selectedTenant.trialEndsAt);
                const payDays = daysUntil(selectedTenant.nextBillingAt);
                return (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Priorità operativa
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${billingToneClass(situation.tone)}`}
                        >
                          {situation.label}
                        </span>
                        {susp ? (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${susp.toneClass}`}>
                            {susp.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{situation.detail}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                        <CalendarClock className="h-4 w-4 text-orange-500" strokeWidth={2} aria-hidden />
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Prossima scadenza pagamento
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatDate(selectedTenant.nextBillingAt)}
                        </p>
                        {payDays !== null ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {payDays < 0
                              ? `Scaduta da ${Math.abs(payDays)} giorni`
                              : payDays === 0
                                ? "Scade oggi"
                                : `Tra ${payDays} giorni`}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">Data non impostata</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                        <Wallet className="h-4 w-4 text-orange-500" strokeWidth={2} aria-hidden />
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Canone (ricorrente)
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatCurrency(selectedTenant.monthlyPrice)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Ciclo {selectedTenant.billingCycle === "yearly" ? "annuale" : "mensile"} · Piano{" "}
                          {planLabelIt(selectedTenant.plan)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                        <HardDrive className="h-4 w-4 text-orange-500" strokeWidth={2} aria-hidden />
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Storage documenti
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {bytesToGbLabel(selectedTenant.storageUsedBytes)} /{" "}
                          {bytesToGbLabel(selectedTenant.storageQuotaBytes)} GB
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedTenant.documentsStorageEnabled ? "Hosting attivo" : "Hosting disattivato"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200/90 bg-white p-4 text-sm shadow-sm ring-1 ring-slate-900/5">
                        <p className="text-xs font-semibold text-slate-500">Trial</p>
                        {selectedTenant.plan === "trial" ? (
                          <>
                            <p className="mt-1 font-medium text-slate-900">{formatDate(selectedTenant.trialEndsAt)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {trialDays !== null
                                ? trialDays < 0
                                  ? `Scaduto da ${Math.abs(trialDays)} giorni`
                                  : `${trialDays} giorni rimanenti`
                                : "Data non impostata"}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-slate-600">Questo cliente non è in trial.</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200/90 bg-white p-4 text-sm shadow-sm ring-1 ring-slate-900/5">
                        <p className="text-xs font-semibold text-slate-500">Ultimo pagamento registrato</p>
                        <p className="mt-1 font-medium text-slate-900">{formatDate(selectedTenant.lastPaymentAt)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Stato contabile: {paymentStatusLabel(selectedTenant.paymentStatus)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-3 text-sm text-slate-600">
                      <span className="font-medium text-slate-800">Servizi extra: </span>
                      {selectedTenant ? tenantFeatureServicesSummary(selectedTenant) : "—"}
                    </div>
                  </div>
                );
              })()}

            {activeTab === "billing" && (
              <div className="space-y-5">
                {selectedTenant.plan === "trial" && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
                    <p className="font-semibold text-amber-950">Trial in corso</p>
                    <p className="mt-1 leading-relaxed">
                      Fine trial: <strong>{formatDate(selectedTenant.trialEndsAt)}</strong>
                      {(() => {
                        const td = daysUntil(selectedTenant.trialEndsAt);
                        if (td === null) return null;
                        return (
                          <>
                            {" "}
                            ({td < 0 ? `scaduto da ${Math.abs(td)}g` : `${td} giorni rimanenti`})
                          </>
                        );
                      })()}
                      . Puoi estendere dalla sezione sotto senza modificare il resto del contratto.
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950 shadow-sm">
                  <p className="font-semibold text-emerald-950">Come funzionano gli incassi</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
                    <li>
                      <strong>Registra incasso</strong>: stato → Pagato, data pagamento = oggi, prossima scadenza →{" "}
                      <strong>{projectedNextBillingAtLabel}</strong> ({selectedTenant.billingCycle === "yearly" ? "annuale" : "mensile"}).
                    </li>
                    <li>
                      <strong>Annulla ultimo incasso</strong>: torna In attesa, azzera ultimo pagamento, scadenza →{" "}
                      <strong>{projectedUndoBillingAtLabel}</strong>.
                    </li>
                  </ul>
                </div>

                <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                  <h3 className="text-sm font-semibold text-slate-900">Piano e importi</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Modifiche effettive dopo &quot;Salva modifiche billing&quot;.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-billing-plan">
                        Piano commerciale
                      </label>
                      <select
                        id="sa-billing-plan"
                        className={selectFieldClass + " w-full"}
                        value={billingForm.plan}
                        onChange={(e) => setBillingForm((p) => ({ ...p, plan: e.target.value as "trial" | "basic" | "pro" }))}
                      >
                        <option value="trial">Trial</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-billing-cycle">
                        Ciclo di fatturazione
                      </label>
                      <select
                        id="sa-billing-cycle"
                        className={selectFieldClass + " w-full"}
                        value={billingForm.billingCycle}
                        onChange={(e) =>
                          setBillingForm((p) => ({ ...p, billingCycle: e.target.value as "monthly" | "yearly" }))
                        }
                      >
                        <option value="monthly">Mensile</option>
                        <option value="yearly">Annuale</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-billing-price">
                        Importo ricorrente (€ / periodo indicato dal ciclo)
                      </label>
                      <input
                        id="sa-billing-price"
                        className={inputFieldClass}
                        type="number"
                        min="0"
                        step="0.01"
                        value={billingForm.monthlyPrice}
                        onChange={(e) => setBillingForm((p) => ({ ...p, monthlyPrice: e.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                  <h3 className="text-sm font-semibold text-slate-900">Date e stato pagamento</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {billingForm.plan === "trial" ? (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-trial-end">
                          Fine periodo trial
                        </label>
                        <input
                          id="sa-trial-end"
                          className={inputFieldClass}
                          type="date"
                          value={billingForm.trialEndsAt}
                          onChange={(e) => setBillingForm((p) => ({ ...p, trialEndsAt: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-600">
                        Il piano non è in trial: la data fine trial non viene applicata al login cliente.
                      </div>
                    )}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-next-billing">
                        Prossima scadenza / fatturazione
                      </label>
                      <input
                        id="sa-next-billing"
                        className={inputFieldClass}
                        type="date"
                        value={billingForm.nextBillingAt}
                        onChange={(e) => setBillingForm((p) => ({ ...p, nextBillingAt: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-pay-status">
                        Stato incasso corrente
                      </label>
                      <select
                        id="sa-pay-status"
                        className={selectFieldClass + " w-full max-w-md"}
                        value={billingForm.paymentStatus}
                        onChange={(e) =>
                          setBillingForm((p) => ({ ...p, paymentStatus: e.target.value as "pending" | "paid" | "overdue" }))
                        }
                      >
                        <option value="pending">In attesa</option>
                        <option value="paid">Pagato</option>
                        <option value="overdue">Insoluto</option>
                      </select>
                    </div>
                  </div>
                </section>

                {selectedTenant.plan === "trial" && (
                  <section className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-blue-950">Estensione trial rapida</h3>
                    <p className="mt-1 text-xs text-blue-900/90">
                      Fine trial attuale sul sistema: <strong>{formatDate(selectedTenant.trialEndsAt)}</strong>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["7", "14", "30"].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          onClick={() => setTrialExtensionDays(value)}
                          className={
                            trialExtensionDays === value
                              ? "bg-blue-700 text-white shadow-sm"
                              : "border border-blue-200 bg-white text-blue-900 hover:bg-blue-50"
                          }
                        >
                          +{value} giorni
                        </Button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        className={inputFieldClass + " w-28"}
                        aria-label="Giorni personalizzati estensione trial"
                        value={trialExtensionDays}
                        onChange={(e) => setTrialExtensionDays(e.target.value)}
                      />
                    </div>
                    <label className="mt-3 block text-xs font-semibold text-blue-950" htmlFor="sa-trial-reason">
                      Motivo (obbligatorio, min. 3 caratteri)
                    </label>
                    <textarea
                      id="sa-trial-reason"
                      className={inputFieldClass + " mt-1 min-h-[72px]"}
                      rows={2}
                      placeholder="Es. accordo commerciale, promessa ordine firmato…"
                      value={trialExtensionReason}
                      onChange={(e) => setTrialExtensionReason(e.target.value)}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        onClick={handleExtendTrial}
                        disabled={savingTrialExtension || trialExtensionReason.trim().length < 3}
                        className="bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
                      >
                        {savingTrialExtension ? "Salvataggio…" : "Applica estensione trial"}
                      </Button>
                    </div>
                  </section>
                )}

                <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                  <h3 className="text-sm font-semibold text-slate-900">Servizi extra e quota storage</h3>
                  <p className="mt-2 text-xs text-slate-500">
                    Invio email piattaforma:{" "}
                    <strong>Impostazioni</strong> (mittente e attivazione). Qui solo addon per tenant.
                  </p>
                  <div className="mt-4 space-y-3">
                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm transition hover:bg-slate-50">
                      <span className="font-medium text-slate-800">Richiesta recensione post-checkout</span>
                      <input
                        type="checkbox"
                        checked={billingForm.reviewRequestEnabled}
                        onChange={(e) => setBillingForm((p) => ({ ...p, reviewRequestEnabled: e.target.checked }))}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                      />
                    </label>
                    {billingForm.reviewRequestEnabled && (
                      <div className="space-y-3 rounded-xl border border-orange-200/80 bg-orange-50/50 px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">
                          Come inviare la richiesta recensione al cliente
                        </p>
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="radio"
                            name="review-delivery"
                            className="mt-1"
                            checked={billingForm.reviewDeliveryMode === "google_sheet"}
                            onChange={() =>
                              setBillingForm((p) => ({ ...p, reviewDeliveryMode: "google_sheet" }))
                            }
                          />
                          <span>
                            <strong>Foglio Google</strong> — l&apos;app aggiunge una riga; email e
                            WhatsApp restano sullo script del cliente (consigliato se già attivo).
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <input
                            type="radio"
                            name="review-delivery"
                            className="mt-1"
                            checked={billingForm.reviewDeliveryMode === "email_app"}
                            onChange={() =>
                              setBillingForm((p) => ({ ...p, reviewDeliveryMode: "email_app" }))
                            }
                          />
                          <span>
                            <strong>Email dall&apos;app</strong> — testi in Impostazioni tenant;
                            richiede invio piattaforma in{" "}
                            <strong>Impostazioni</strong> (+ <code className="rounded bg-white/80 px-1 text-[11px]">RESEND_API_KEY</code> nel .env).
                          </span>
                        </label>
                        {billingForm.reviewDeliveryMode === "google_sheet" && (
                          <>
                            <label
                              className="mb-1.5 block text-xs font-semibold text-slate-700"
                              htmlFor="sa-review-sheet-url"
                            >
                              URL foglio Google Sheets
                            </label>
                            <input
                              id="sa-review-sheet-url"
                              type="url"
                              className={inputFieldClass}
                              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                              value={billingForm.reviewGoogleSheetUrl}
                              onChange={(e) =>
                                setBillingForm((p) => ({
                                  ...p,
                                  reviewGoogleSheetUrl: e.target.value,
                                }))
                              }
                            />
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Scheda <strong>Recensioni Extra</strong> (Nome, Telefono, Email,
                              Completato). Condividi in scrittura con{" "}
                              <code className="rounded bg-white/80 px-1 text-[11px]">
                                recensioni-service@recensioni-ns-cantieri.iam.gserviceaccount.com
                              </code>
                              .
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm transition hover:bg-slate-50">
                      <span className="font-medium text-slate-800">Hosting documenti in cloud</span>
                      <input
                        type="checkbox"
                        checked={billingForm.documentsStorageEnabled}
                        onChange={(e) => setBillingForm((p) => ({ ...p, documentsStorageEnabled: e.target.checked }))}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm transition hover:bg-slate-50">
                      <span className="font-medium text-slate-800">Pipeline ufficio commesse</span>
                      <input
                        type="checkbox"
                        checked={billingForm.officeWorkflowEnabled}
                        onChange={(e) =>
                          setBillingForm((p) => ({
                            ...p,
                            officeWorkflowEnabled: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm transition hover:bg-slate-50">
                      <span className="font-medium text-slate-800">Checkout digitale (modulo + firma)</span>
                      <input
                        type="checkbox"
                        checked={billingForm.checkoutDigitalEnabled}
                        onChange={(e) =>
                          setBillingForm((p) => ({
                            ...p,
                            checkoutDigitalEnabled: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                      />
                    </label>
                    {billingForm.checkoutDigitalEnabled && (
                      <div className="space-y-3">
                        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm transition hover:bg-slate-50">
                          <span className="font-medium text-slate-800">
                            Invio email modulo fine lavori al cliente
                          </span>
                          <input
                            type="checkbox"
                            checked={billingForm.checkoutEmailEnabled}
                            onChange={(e) =>
                              setBillingForm((p) => ({
                                ...p,
                                checkoutEmailEnabled: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-400"
                          />
                        </label>
                        <p className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs text-slate-600 leading-relaxed">
                          Logo e PDF in{" "}
                          <strong>Impostazioni → Modulo fine lavori</strong>; testi email in{" "}
                          <strong>Impostazioni → Email a clienti</strong>. L&apos;invio parte solo
                          con invio piattaforma attivo in Impostazioni.
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-storage-gb">
                        Quota storage inclusa (GB)
                      </label>
                      <input
                        id="sa-storage-gb"
                        className={inputFieldClass}
                        type="number"
                        min={0}
                        step={1}
                        value={billingForm.storageQuotaGb}
                        onChange={(e) => setBillingForm((p) => ({ ...p, storageQuotaGb: e.target.value }))}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Utilizzo attuale: <strong>{bytesToGbLabel(selectedTenant.storageUsedBytes)} GB</strong>
                      </p>
                    </div>
                  </div>
                </section>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
                  <Button
                    type="button"
                    disabled={savingBilling}
                    className="w-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    onClick={handleSaveBilling}
                  >
                    {savingBilling ? "Salvataggio…" : "Salva modifiche billing"}
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button type="button" variant="success" className="py-2.5 text-sm font-semibold" onClick={openRegisterPaymentDialog}>
                      Registra incasso
                    </Button>
                    <Button type="button" variant="warning" className="py-2.5 text-sm font-semibold" onClick={openUndoPaymentDialog}>
                      Annulla ultimo incasso
                    </Button>
                    <Button type="button" variant="danger" className="py-2.5 text-sm font-semibold" onClick={handleMarkOverdue}>
                      Segna insoluto
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div className="space-y-6">
                <section className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm ring-1 ring-slate-900/5">
                  <h3 className="text-sm font-semibold text-slate-900">Aggiungi accesso</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Crea un nuovo utente collegato a questo cliente. Comunica credenziali in modo sicuro (mai via email in chiaro se possibile).
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-user-name">
                        Nome e cognome
                      </label>
                      <input
                        id="sa-user-name"
                        className={inputFieldClass}
                        autoComplete="name"
                        placeholder="Es. Mario Rossi"
                        value={userForm.fullName}
                        onChange={(e) => setUserForm((p) => ({ ...p, fullName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-user-email">
                        Email di accesso
                      </label>
                      <input
                        id="sa-user-email"
                        className={inputFieldClass}
                        type="email"
                        autoComplete="email"
                        placeholder="nome@azienda.it"
                        value={userForm.email}
                        onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-user-role">
                        Ruolo nell&apos;app
                      </label>
                      <select
                        id="sa-user-role"
                        className={selectFieldClass + " w-full"}
                        value={userForm.role}
                        onChange={(e) =>
                          setUserForm((p) => ({ ...p, role: e.target.value as "admin" | "backoffice" | "worker" }))
                        }
                      >
                        <option value="worker">Operatore (agenda e interventi)</option>
                        <option value="backoffice">Backoffice (gestione operativa)</option>
                        <option value="admin">Amministratore tenant (tutto il backoffice)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-user-pw">
                        Password iniziale
                      </label>
                      <input
                        id="sa-user-pw"
                        className={inputFieldClass}
                        type="password"
                        autoComplete="new-password"
                        placeholder="Minimo 6 caratteri"
                        value={userForm.password}
                        onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCreateTenantUser}
                    className="mt-4 w-full py-2.5 text-sm font-semibold sm:w-auto"
                  >
                    Crea utente
                  </Button>
                </section>

                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Persone con accesso</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {loadingUsers ? (
                        <span className="text-xs text-slate-500">Caricamento…</span>
                      ) : (
                        <span className="text-xs text-slate-500">{tenantUsers.length} utenti</span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs"
                        disabled={exportBusy || loadingUsers || tenantUsers.length === 0}
                        onClick={handleExportModalUsers}
                      >
                        Esporta CSV
                      </Button>
                    </div>
                  </div>
                  {loadingUsers ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                      Caricamento elenco…
                    </p>
                  ) : tenantUsers.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                      Nessun utente oltre all&apos;admin di creazione tenant. Aggiungi il primo accesso qui sopra.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {tenantUsers.map((u) => (
                        <li
                          key={u.id}
                          className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{u.fullName || "Senza nome"}</p>
                            <p className="truncate text-sm text-slate-600">{u.email}</p>
                            <p className="mt-2">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80">
                                {roleLabelIt(u.role)}
                              </span>
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="text-xs font-semibold sm:text-sm"
                              onClick={() => openEditTenantUser(u)}
                            >
                              Modifica
                            </Button>
                            <Button
                              type="button"
                              variant="warning"
                              className="text-xs font-semibold sm:text-sm"
                              onClick={() => handleResetTenantUserPassword(u)}
                            >
                              Nuova password
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              className="text-xs font-semibold sm:text-sm"
                              onClick={() => handleDeleteTenantUser(u)}
                            >
                              Rimuovi
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
                  <h3 className="text-sm font-semibold text-slate-900">Invia notifiche push</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Messaggio agli utenti di {selectedTenant.displayName} che hanno attivato le
                    notifiche sull&apos;app. Richiede Firebase (FCM) configurato sul server.
                  </p>
                  <div className="mt-4">
                    <PushBroadcastPanel
                      key={selectedTenant.id}
                      tenantId={selectedTenant.id}
                      embedded
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-5">
                <section className="rounded-xl border border-indigo-200/60 bg-indigo-50/40 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-indigo-950">Nota per il team</h3>
                  <p className="mt-0.5 text-xs text-indigo-900/80">
                    Viene registrata nella cronologia billing insieme a incassi, storni e modifiche piano.
                  </p>
                  <label className="mt-3 block text-xs font-semibold text-indigo-950" htmlFor="sa-timeline-note">
                    Cosa è successo / prossimo passo
                  </label>
                  <textarea
                    id="sa-timeline-note"
                    className={inputFieldClass + " mt-1 min-h-[88px]"}
                    rows={3}
                    placeholder="Es. richiamo il 20/05, promesso bonifico entro venerdì, escalation commerciale…"
                    value={timelineNote}
                    onChange={(e) => setTimelineNote(e.target.value)}
                  />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <label className="text-xs font-semibold text-indigo-950" htmlFor="sa-timeline-followup">
                        Promemoria follow-up (opzionale)
                      </label>
                      <input
                        id="sa-timeline-followup"
                        type="date"
                        className={inputFieldClass + " mt-1 max-w-[200px]"}
                        value={timelineFollowUpAt}
                        onChange={(e) => setTimelineFollowUpAt(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={savingTimelineNote || timelineNote.trim().length < 3}
                      className="bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      onClick={handleAddTimelineNote}
                    >
                      {savingTimelineNote ? "Salvataggio…" : "Aggiungi alla cronologia"}
                    </Button>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Eventi recenti</h3>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs"
                      disabled={exportBusy || loadingBillingEvents || billingEvents.length === 0}
                      onClick={handleExportModalBilling}
                    >
                      Esporta cronologia CSV
                    </Button>
                  </div>
                  {loadingBillingEvents ? (
                    <p className="py-6 text-center text-sm text-slate-500">Caricamento cronologia…</p>
                  ) : billingEvents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-10 text-center">
                      <History className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
                      <p className="mt-2 text-sm font-medium text-slate-600">Ancora nessun evento</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Quando salvi billing o aggiungi note, compariranno qui in ordine cronologico.
                      </p>
                    </div>
                  ) : (
                    <div className="relative pl-4">
                      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" aria-hidden />
                      <ul className="space-y-0">
                        {billingEvents.map((event, idx) => (
                          <li key={event.id} className="relative pb-6 pl-6 last:pb-0">
                            <span
                              className={cn(
                                "absolute left-0 top-1.5 flex h-[11px] w-[11px] rounded-full border-2 border-white ring-1",
                                idx === 0 ? "bg-orange-500 ring-orange-300" : "bg-slate-300 ring-slate-200"
                              )}
                              aria-hidden
                            />
                            <p className="text-sm font-medium leading-snug text-slate-900">{event.message}</p>
                            <time
                              className="mt-1 block text-xs text-slate-500"
                              dateTime={event.createdAt}
                            >
                              {new Date(event.createdAt).toLocaleString()}
                            </time>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>
            )}
            </div>

            <details className="group shrink-0 border-t border-slate-200 bg-slate-50/90 px-4 py-1 sm:px-5">
              <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-semibold text-red-900 marker:hidden [&::-webkit-details-marker]:hidden">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2} aria-hidden />
                Azioni sensibili (sospensione, archiviazione, eliminazione)
                <span className="ml-auto text-xs font-normal text-slate-500 group-open:hidden">Apri</span>
                <span className="ml-auto hidden text-xs font-normal text-slate-500 group-open:inline">Chiudi</span>
              </summary>
              <div className="space-y-3 border-t border-slate-200/80 pb-4 pt-3">
                <p className="text-xs leading-relaxed text-slate-600">
                  Le eliminazioni sono irreversibili lato applicazione. Verifica di aver esportato backup se necessario.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={selectedTenant.status === "active" ? "danger" : "success"}
                    className="py-2.5 text-sm font-semibold"
                    onClick={() =>
                      handleStatusChange(selectedTenant, selectedTenant.status === "active" ? "suspended" : "active")
                    }
                  >
                    {selectedTenant.status === "active" ? "Sospendi accesso" : "Riattiva accesso"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="py-2.5 text-sm font-semibold"
                    onClick={() => handleStatusChange(selectedTenant, "archived")}
                  >
                    Archivia tenant
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="py-2.5 text-sm font-semibold"
                    onClick={() => handleDeleteTenant(selectedTenant, false)}
                  >
                    Elimina tenant
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-black"
                    onClick={() => handleDeleteTenant(selectedTenant, true)}
                  >
                    Elimina definitivamente
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      {editingTenantUser && (
        <div className={modalBackdropElevatedClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-4 p-5`}>
            <h3 className="text-lg font-semibold text-slate-900">Modifica utente</h3>
            <p className="text-sm text-slate-600">
              Aggiorna nome, email e ruolo. Le modifiche si applicano anche al login (Worker + AppUser).
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-edit-user-name">
                  Nome e cognome
                </label>
                <input
                  id="sa-edit-user-name"
                  className={inputFieldClass}
                  value={editUserForm.fullName}
                  onChange={(e) => setEditUserForm((p) => ({ ...p, fullName: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-edit-user-email">
                  Email di accesso
                </label>
                <input
                  id="sa-edit-user-email"
                  type="email"
                  className={inputFieldClass}
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="sa-edit-user-role">
                  Ruolo
                </label>
                <select
                  id="sa-edit-user-role"
                  className={selectFieldClass + " w-full"}
                  value={editUserForm.role}
                  onChange={(e) =>
                    setEditUserForm((p) => ({
                      ...p,
                      role: e.target.value as "admin" | "backoffice" | "worker",
                    }))
                  }
                >
                  <option value="worker">Operatore</option>
                  <option value="backoffice">Backoffice</option>
                  <option value="admin">Amministratore tenant</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeEditTenantUser} disabled={savingTenantUserEdit}>
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveTenantUserEdit}
                disabled={savingTenantUserEdit}
              >
                {savingTenantUserEdit ? "Salvataggio…" : "Salva modifiche"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTenantModal && selectedTenant && paymentDialogMode && (
        <div className={modalBackdropElevatedClass}>
          <div className={`${modalPanelClass} max-w-lg space-y-3 p-5`}>
            <h3 className="text-lg font-semibold">
              {paymentDialogMode === "register" ? "Conferma registrazione incasso" : "Conferma annullamento incasso"}
            </h3>
            {paymentDialogMode === "register" ? (
              <div className="text-sm text-gray-700 space-y-1">
                <p>Cliente: <strong>{selectedTenant.displayName}</strong></p>
                <p>Stato pagamento: <strong>Pagato</strong></p>
                <p>Ultimo pagamento: <strong>Oggi</strong></p>
                <p>Prossima scadenza: <strong>{projectedNextBillingAtLabel}</strong></p>
              </div>
            ) : (
              <div className="text-sm text-gray-700 space-y-1">
                <p>Cliente: <strong>{selectedTenant.displayName}</strong></p>
                <p>Stato pagamento: <strong>In attesa</strong></p>
                <p>Ultimo pagamento: <strong>Rimosso</strong></p>
                <p>Prossima scadenza: <strong>{projectedUndoBillingAtLabel}</strong></p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              L&apos;operazione viene registrata nella timeline billing del tenant.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {paymentDialogMode === "register"
                  ? "Causale registrazione incasso (obbligatoria)"
                  : "Causale annullamento (obbligatoria)"}
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200/80"
                rows={3}
                placeholder={
                  paymentDialogMode === "register"
                    ? "Es. bonifico ricevuto, conferma amministrazione…"
                    : "Es. doppio click operatore, incasso sul tenant errato…"
                }
                value={paymentActionReason}
                onChange={(e) => setPaymentActionReason(e.target.value)}
              />
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogMode(null)} className="font-medium">
                Annulla
              </Button>
              <Button
                type="button"
                variant={paymentDialogMode === "register" ? "success" : "warning"}
                className={
                  paymentDialogMode === "register"
                    ? "bg-green-700 font-semibold hover:bg-green-800"
                    : "font-semibold"
                }
                onClick={handleConfirmPaymentAction}
                disabled={savingPaymentAction || paymentActionReason.trim().length < 3}
              >
                {savingPaymentAction
                  ? "Salvataggio…"
                  : paymentDialogMode === "register"
                    ? "Conferma incasso"
                    : "Conferma annullamento"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
