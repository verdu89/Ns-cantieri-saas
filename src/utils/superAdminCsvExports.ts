import {
  saasAdminAPI,
  type BillingEventItem,
  type TenantListItem,
  type TenantUserItem,
} from "@/api/saasAdmin";
import { formatDate } from "@/utils/date";
import { downloadCsvFile } from "@/utils/csvExport";

export type PaymentStatus = "pending" | "paid" | "overdue";

export type CollectionRowExport = {
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

export type ActionItemExport = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  priority: "high" | "medium";
  priorityLabel: string;
  reason: string;
};

function csvDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function paymentStatusLabel(status: PaymentStatus): string {
  if (status === "paid") return "Pagato";
  if (status === "overdue") return "Insoluto";
  return "In attesa";
}

function planLabelIt(plan: string): string {
  if (plan === "trial") return "Trial";
  if (plan === "basic") return "Basic";
  if (plan === "pro") return "Pro";
  return plan;
}

function tenantStatusLabelIt(status: string): string {
  if (status === "active") return "Attivo";
  if (status === "suspended") return "Sospeso";
  if (status === "archived") return "Archiviato";
  return status;
}

function roleLabelIt(role: string): string {
  if (role === "worker") return "Operatore";
  if (role === "backoffice") return "Backoffice";
  if (role === "admin") return "Amministratore";
  return role;
}

function billingCycleLabel(cycle: "monthly" | "yearly"): string {
  return cycle === "yearly" ? "Annuale" : "Mensile";
}

function collectionPriorityLabel(p: "critical" | "high" | "normal"): string {
  if (p === "critical") return "Critica";
  if (p === "high") return "Alta";
  return "Normale";
}

export function tenantMrr(tenant: TenantListItem): number {
  return tenant.billingCycle === "yearly" ? tenant.monthlyPrice / 12 : tenant.monthlyPrice;
}

function tenantArr(tenant: TenantListItem): number {
  return tenantMrr(tenant) * 12;
}

function getBillingSituationLabel(tenant: TenantListItem): string {
  if (tenant.plan === "trial") {
    const trialDays = daysUntil(tenant.trialEndsAt);
    if (trialDays === null) return "Trial (data mancante)";
    if (trialDays < 0) return "Trial scaduto";
    if (trialDays <= 7) return "Trial in scadenza";
    return "Trial attivo";
  }
  if (tenant.paymentStatus === "overdue") return "Da contattare (insoluto)";
  const dueInDays = daysUntil(tenant.nextBillingAt);
  if (dueInDays !== null && dueInDays < 0) return "Scadenza superata";
  if (dueInDays !== null && dueInDays <= 7) return "In scadenza";
  if (tenant.paymentStatus === "paid") return "Regolare";
  return "Programmato";
}

export function buildAllActionItems(tenants: TenantListItem[]): ActionItemExport[] {
  const rows: ActionItemExport[] = [];
  tenants.forEach((tenant) => {
    const dueDays = daysUntil(tenant.nextBillingAt);
    const trialDays = daysUntil(tenant.trialEndsAt);
    const base = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.displayName,
    };
    if (tenant.status === "suspended" && tenant.paymentStatus === "overdue") {
      rows.push({
        ...base,
        priority: "high",
        priorityLabel: "Alta",
        reason: "Sospeso automatico per insoluto",
      });
    } else if (tenant.status === "suspended" && tenant.plan === "trial" && (trialDays ?? 0) < 0) {
      rows.push({
        ...base,
        priority: "high",
        priorityLabel: "Alta",
        reason: "Sospeso automatico per trial scaduto",
      });
    } else if (tenant.paymentStatus === "overdue") {
      rows.push({
        ...base,
        priority: "high",
        priorityLabel: "Alta",
        reason: "Pagamento insoluto da gestire",
      });
    } else if (tenant.plan === "trial" && (trialDays ?? 999) <= 3) {
      rows.push({
        ...base,
        priority: "medium",
        priorityLabel: "Media",
        reason: `Trial in scadenza (${trialDays} giorni)`,
      });
    } else if (tenant.paymentStatus === "pending" && dueDays !== null && dueDays <= 3) {
      rows.push({
        ...base,
        priority: "medium",
        priorityLabel: "Media",
        reason: `Pagamento in scadenza (${dueDays} giorni)`,
      });
    }
  });
  return rows.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return a.tenantName.localeCompare(b.tenantName, "it");
  });
}

export function exportCollectionsCsv(rows: CollectionRowExport[]): void {
  if (rows.length === 0) throw new Error("EMPTY");
  const header = [
    "Tenant",
    "Importo",
    "Ciclo",
    "Stato pagamento",
    "Scadenza",
    "Ultimo pagamento",
    "Giorni alla scadenza",
    "Priorita",
  ];
  const data = rows.map((row) => [
    row.tenantName,
    row.amount.toFixed(2),
    billingCycleLabel(row.billingCycle),
    paymentStatusLabel(row.paymentStatus),
    formatDate(row.dueAt),
    formatDate(row.lastPaymentAt),
    row.dueInDays ?? "",
    collectionPriorityLabel(row.priority),
  ]);
  downloadCsvFile(`report-incassi-${csvDateStamp()}.csv`, [header, ...data]);
}

export function exportTenantsRegistryCsv(tenants: TenantListItem[]): void {
  if (tenants.length === 0) throw new Error("EMPTY");
  const header = [
    "Slug",
    "Nome",
    "Piano",
    "Stato account",
    "Stato pagamento",
    "Situazione",
    "Prezzo listino",
    "Ciclo fatturazione",
    "MRR",
    "ARR",
    "Prossima scadenza",
    "Ultimo pagamento",
    "Fine trial",
    "Storage usato (GB)",
    "Quota storage (GB)",
    "Recensioni attive",
    "Documenti cloud",
    "Creato il",
  ];
  const data = tenants.map((t) => [
    t.slug,
    t.displayName,
    planLabelIt(t.plan),
    tenantStatusLabelIt(t.status),
    paymentStatusLabel(t.paymentStatus),
    getBillingSituationLabel(t),
    t.monthlyPrice.toFixed(2),
    billingCycleLabel(t.billingCycle),
    tenantMrr(t).toFixed(2),
    tenantArr(t).toFixed(2),
    formatDate(t.nextBillingAt),
    formatDate(t.lastPaymentAt),
    formatDate(t.trialEndsAt),
    (t.storageUsedBytes / 1024 ** 3).toFixed(2),
    (t.storageQuotaBytes / 1024 ** 3).toFixed(2),
    t.reviewRequestEnabled ? "Si" : "No",
    t.documentsStorageEnabled ? "Si" : "No",
    formatDate(t.createdAt),
  ]);
  downloadCsvFile(`anagrafica-tenant-${csvDateStamp()}.csv`, [header, ...data]);
}

export function exportActionItemsCsv(items: ActionItemExport[]): void {
  if (items.length === 0) throw new Error("EMPTY");
  const header = ["Tenant", "Slug", "Priorita", "Motivo"];
  const data = items.map((item) => [
    item.tenantName,
    item.tenantSlug,
    item.priorityLabel,
    item.reason,
  ]);
  downloadCsvFile(`azioni-prioritarie-${csvDateStamp()}.csv`, [header, ...data]);
}

export function exportMrrSummaryCsv(tenants: TenantListItem[]): void {
  if (tenants.length === 0) throw new Error("EMPTY");
  const activeTenants = tenants.filter((t) => t.status === "active");
  const header = [
    "Tenant",
    "Slug",
    "Piano",
    "Stato pagamento",
    "Prezzo listino",
    "Ciclo",
    "MRR",
    "ARR",
  ];
  const data = tenants.map((t) => [
    t.displayName,
    t.slug,
    planLabelIt(t.plan),
    paymentStatusLabel(t.paymentStatus),
    t.monthlyPrice.toFixed(2),
    billingCycleLabel(t.billingCycle),
    tenantMrr(t).toFixed(2),
    tenantArr(t).toFixed(2),
  ]);
  const totalMrr = activeTenants.reduce((sum, t) => sum + tenantMrr(t), 0);
  const totalArr = totalMrr * 12;
  const byPlan = (plan: string) =>
    activeTenants.filter((t) => t.plan === plan).reduce((s, t) => s + tenantMrr(t), 0);
  downloadCsvFile(`mrr-ricavi-${csvDateStamp()}.csv`, [
    header,
    ...data,
    [],
    ["RIEPILOGO", "", "", "", "", "", "", ""],
    ["MRR totale (tenant attivi)", "", "", "", "", "", totalMrr.toFixed(2), totalArr.toFixed(2)],
    ["Numero tenant", String(tenants.length), "", "", "", "", "", ""],
    ["Tenant attivi", String(activeTenants.length), "", "", "", "", "", ""],
    ["MRR Trial", "", "", "", "", "", byPlan("trial").toFixed(2), ""],
    ["MRR Basic", "", "", "", "", "", byPlan("basic").toFixed(2), ""],
    ["MRR Pro", "", "", "", "", "", byPlan("pro").toFixed(2), ""],
  ]);
}

export function exportTenantUsersCsv(
  tenant: TenantListItem,
  users: TenantUserItem[]
): void {
  if (users.length === 0) throw new Error("EMPTY");
  const header = ["Tenant", "Slug", "Nome", "Email", "Ruolo", "Attivo"];
  const data = users.map((u) => [
    tenant.displayName,
    tenant.slug,
    u.fullName,
    u.email,
    roleLabelIt(u.role),
    u.isActive === false ? "No" : "Si",
  ]);
  downloadCsvFile(
    `utenti-${tenant.slug}-${csvDateStamp()}.csv`,
    [header, ...data]
  );
}

export function exportAllUsersCsv(
  tenants: TenantListItem[],
  usersByTenant: Map<string, TenantUserItem[]>
): void {
  const header = ["Tenant", "Slug", "Nome", "Email", "Ruolo", "Attivo"];
  const data: unknown[][] = [];
  for (const tenant of tenants) {
    const users = usersByTenant.get(tenant.id) ?? [];
    for (const u of users) {
      data.push([
        tenant.displayName,
        tenant.slug,
        u.fullName,
        u.email,
        roleLabelIt(u.role),
        u.isActive === false ? "No" : "Si",
      ]);
    }
  }
  if (data.length === 0) throw new Error("EMPTY");
  downloadCsvFile(`tutti-utenti-${csvDateStamp()}.csv`, [header, ...data]);
}

export function exportBillingEventsCsv(
  tenant: TenantListItem,
  events: BillingEventItem[]
): void {
  if (events.length === 0) throw new Error("EMPTY");
  const header = [
    "Tenant",
    "Slug",
    "Data",
    "Tipo evento",
    "Messaggio",
    "Importo",
    "Scadenza",
    "Data effettiva",
  ];
  const data = events.map((e) => [
    tenant.displayName,
    tenant.slug,
    new Date(e.createdAt).toLocaleString("it-IT"),
    e.eventType,
    e.message,
    e.amount != null ? e.amount.toFixed(2) : "",
    formatDate(e.dueAt),
    formatDate(e.effectiveAt),
  ]);
  downloadCsvFile(
    `cronologia-billing-${tenant.slug}-${csvDateStamp()}.csv`,
    [header, ...data]
  );
}

export function exportAllBillingEventsCsv(
  tenants: TenantListItem[],
  eventsByTenant: Map<string, BillingEventItem[]>
): void {
  const header = [
    "Tenant",
    "Slug",
    "Data",
    "Tipo evento",
    "Messaggio",
    "Importo",
    "Scadenza",
    "Data effettiva",
  ];
  const data: unknown[][] = [];
  for (const tenant of tenants) {
    const events = eventsByTenant.get(tenant.id) ?? [];
    for (const e of events) {
      data.push([
        tenant.displayName,
        tenant.slug,
        new Date(e.createdAt).toLocaleString("it-IT"),
        e.eventType,
        e.message,
        e.amount != null ? e.amount.toFixed(2) : "",
        formatDate(e.dueAt),
        formatDate(e.effectiveAt),
      ]);
    }
  }
  if (data.length === 0) throw new Error("EMPTY");
  downloadCsvFile(`cronologia-billing-tutti-${csvDateStamp()}.csv`, [header, ...data]);
}

async function mapPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function run(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i]);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

export async function fetchAllTenantUsers(
  tenants: TenantListItem[]
): Promise<Map<string, TenantUserItem[]>> {
  const pairs = await mapPool(tenants, async (tenant): Promise<[string, TenantUserItem[]]> => {
    try {
      const users = await saasAdminAPI.listTenantUsers(tenant.id);
      return [tenant.id, users];
    } catch {
      return [tenant.id, []];
    }
  });
  return new Map(pairs);
}

export async function fetchAllBillingEvents(
  tenants: TenantListItem[]
): Promise<Map<string, BillingEventItem[]>> {
  const pairs = await mapPool(tenants, async (tenant): Promise<[string, BillingEventItem[]]> => {
    try {
      const events = await saasAdminAPI.listTenantBillingEvents(tenant.id);
      return [tenant.id, events];
    } catch {
      return [tenant.id, []];
    }
  });
  return new Map(pairs);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SuperAdminExportBundle = {
  tenants: TenantListItem[];
  visibleTenants: TenantListItem[];
  collectionsRows: CollectionRowExport[];
  allActionItems: ActionItemExport[];
};

export async function exportSuperAdminFullPackage(
  bundle: SuperAdminExportBundle,
  onProgress?: (message: string) => void
): Promise<number> {
  const { tenants, visibleTenants, collectionsRows, allActionItems } = bundle;
  let files = 0;
  const step = async (fn: () => void, label: string) => {
    onProgress?.(label);
    fn();
    files += 1;
    await delay(350);
  };

  if (collectionsRows.length > 0) {
    await step(() => exportCollectionsCsv(collectionsRows), "Report incassi…");
  }
  if (visibleTenants.length > 0) {
    await step(() => exportTenantsRegistryCsv(visibleTenants), "Anagrafica tenant…");
  }
  if (allActionItems.length > 0) {
    await step(() => exportActionItemsCsv(allActionItems), "Azioni prioritarie…");
  }
  if (tenants.length > 0) {
    await step(() => exportMrrSummaryCsv(tenants), "MRR e ricavi…");
  }

  onProgress?.("Caricamento utenti…");
  const usersMap = await fetchAllTenantUsers(tenants);
  if ([...usersMap.values()].some((u) => u.length > 0)) {
    await step(() => exportAllUsersCsv(tenants, usersMap), "Utenti…");
  }

  onProgress?.("Caricamento cronologie…");
  const eventsMap = await fetchAllBillingEvents(tenants);
  if ([...eventsMap.values()].some((e) => e.length > 0)) {
    await step(() => exportAllBillingEventsCsv(tenants, eventsMap), "Cronologia billing…");
  }

  return files;
}

export function csvExportErrorMessage(err: unknown, emptyLabel: string): string {
  if (err instanceof Error && err.message === "EMPTY") return emptyLabel;
  return "Export non riuscito";
}
