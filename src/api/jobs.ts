import type { Customer, Job, JobEvent, Payment, Worker, Documento } from "../types";
import { getJobDisplayStatus } from "@/config/statusConfig";
import { httpClient } from "./httpClient";
import { paymentAPI } from "./payments";
import { jobEventAPI } from "./jobEvents";
import { emitJobsUpdated } from "@/lib/appEvents";
import { tenantCacheScope } from "@/lib/cacheScope";
import {
  fetchWithCache,
  invalidateCache,
} from "@/lib/resourceCache";

type JobRow = {
  id: string;
  jobOrderId: string;
  createdAt: string;
  plannedDate: string | null;
  title: Job["title"];
  status: Job["status"];
  assignedWorkers: string[];
  notes?: string | null;
  notesBackoffice?: string | null;
  location?: { address?: string; mapsUrl?: string } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderCode?: string | null;
  priority?: Job["priority"];
  followUpCount?: number;
  lastFollowUpAt?: string | null;
};

export type JobListQuery = {
  orderId?: string;
  assignedUserId?: string;
  title?: string;
  status?: string;
  customerId?: string;
  q?: string;
  openOnly?: boolean;
  priority?: Job["priority"];
  sollecitati?: boolean;
  page?: number;
  pageSize?: number;
};

export type PaginatedJobs = {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type JobListOptions = {
  /** Default false: evita N richieste /payments?jobId=… sulle liste */
  includePayments?: boolean;
  /** Usa cache in memoria (es. agenda / home) */
  cache?: boolean;
  /** Aggiorna in background se c'è cache valida */
  revalidate?: boolean;
  /** Bypass cache (refresh esplicito / ritorno in app) */
  forceFresh?: boolean;
  /** UI aggiornata quando il refresh in background completa */
  onRevalidated?: (jobs: Job[]) => void;
  /** Filtri server (con page/pageSize → risposta paginata) */
  query?: JobListQuery;
};

const JOBS_CACHE_TTL_MS = 90_000;

function emptyCustomer(): Customer {
  return { id: "", name: "", phone: "" };
}

function mapBase(row: JobRow): Job {
  const base: Job = {
    id: row.id,
    jobOrderId: row.jobOrderId,
    createdAt: row.createdAt,
    plannedDate: row.plannedDate,
    title: row.title,
    status: row.status,
    persistedStatus: row.status,
    assignedWorkers: row.assignedWorkers ?? [],
    notes: row.notes ?? undefined,
    notesBackoffice: row.notesBackoffice ?? undefined,
    location: row.location ?? {},
    customer: {
      ...emptyCustomer(),
      name: row.customerName ?? "",
      phone: row.customerPhone ?? "",
    },
    team: [] as Worker[],
    payments: [] as Payment[],
    docs: [] as Documento[],
    events: [] as JobEvent[],
    files: [],
    orderCode: row.orderCode ?? undefined,
  };
  if (row.title === "assistenza") {
    base.priority = row.priority ?? "normale";
    base.followUpCount = row.followUpCount ?? 0;
    base.lastFollowUpAt = row.lastFollowUpAt ?? null;
  }
  return base;
}

function autoUpdateStatus(job: Job): Job {
  const persisted = job.persistedStatus ?? job.status;
  const display = getJobDisplayStatus(persisted, job.plannedDate);
  return { ...job, persistedStatus: persisted, status: display };
}

function mapJobsFromRows(rows: unknown): Job[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => autoUpdateStatus(mapBase(row as JobRow)));
}

async function hydratePayments(jobs: Job[]): Promise<void> {
  await Promise.all(
    jobs.map(async (j) => {
      j.payments = await paymentAPI.listByJob(j.id);
    })
  );
}

function buildJobsPath(base: string, query?: JobListQuery): string {
  if (!query) return base;
  const params = new URLSearchParams();
  if (query.orderId) params.set("orderId", query.orderId);
  if (query.assignedUserId) params.set("assignedUserId", query.assignedUserId);
  if (query.title) params.set("title", query.title);
  if (query.status) params.set("status", query.status);
  if (query.customerId) params.set("customerId", query.customerId);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.openOnly) params.set("openOnly", "true");
  if (query.priority) params.set("priority", query.priority);
  if (query.sollecitati) params.set("sollecitati", "true");
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function fetchRows(path: string): Promise<JobRow[]> {
  const data = await httpClient.get<JobRow[] | PaginatedJobsRaw>(path);
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

type PaginatedJobsRaw = {
  items: JobRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function fetchPaginated(path: string): Promise<PaginatedJobs> {
  const data = await httpClient.get<PaginatedJobsRaw>(path);
  const items = mapJobsFromRows(data.items ?? []);
  return {
    items,
    total: data.total ?? items.length,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? items.length,
    totalPages: data.totalPages ?? 1,
  };
}

async function loadJobs(
  cacheKey: string,
  path: string,
  options?: JobListOptions
): Promise<Job[]> {
  const includePayments = options?.includePayments === true;

  const loadFresh = async (): Promise<Job[]> => {
    const jobs = mapJobsFromRows(await fetchRows(path));
    if (includePayments) {
      await hydratePayments(jobs);
    }
    return jobs;
  };

  if (options?.query?.page !== undefined || options?.query?.pageSize !== undefined) {
    return loadFresh();
  }

  if (options?.cache) {
    return fetchWithCache(cacheKey, JOBS_CACHE_TTL_MS, loadFresh, {
      revalidate: options.revalidate,
      forceFresh: options.forceFresh,
      onRevalidated: options.onRevalidated,
    });
  }

  return loadFresh();
}

async function loadJobsPaginated(
  path: string,
  options?: JobListOptions
): Promise<PaginatedJobs> {
  const includePayments = options?.includePayments === true;
  const result = await fetchPaginated(path);
  if (includePayments) {
    await hydratePayments(result.items);
  }
  return result;
}

/** Invalida cache liste lavori (dopo create/update/delete). */
export function invalidateJobsCache(): void {
  invalidateCache("jobs:");
}

export const jobAPI = {
  async list(options?: JobListOptions): Promise<Job[]> {
    const path = buildJobsPath("/jobs", options?.query);
    return loadJobs(`jobs:list:${tenantCacheScope()}`, path, options);
  },

  async listPaginated(options?: JobListOptions): Promise<PaginatedJobs> {
    const path = buildJobsPath("/jobs", options?.query);
    return loadJobsPaginated(path, options);
  },

  async listByOrder(
    orderId: string,
    options?: JobListOptions
  ): Promise<Job[]> {
    const query = { ...options?.query, orderId };
    const path = buildJobsPath("/jobs", query);
    return loadJobs(`jobs:order:${orderId}:${tenantCacheScope()}`, path, options);
  },

  async listAssigned(
    workerId: string,
    options?: JobListOptions
  ): Promise<Job[]> {
    const query = { ...options?.query, assignedUserId: workerId };
    const path = buildJobsPath("/jobs", query);
    return loadJobs(`jobs:assigned:${workerId}:${tenantCacheScope()}`, path, options);
  },

  async listAssistenza(options?: JobListOptions): Promise<Job[]> {
    const query = { title: "assistenza" as const, ...options?.query };
    const path = buildJobsPath("/jobs", query);
    return loadJobs(`jobs:assistenza:${tenantCacheScope()}`, path, options);
  },

  async listAssistenzaPaginated(options?: JobListOptions): Promise<PaginatedJobs> {
    const query = { title: "assistenza" as const, ...options?.query };
    const path = buildJobsPath("/jobs", query);
    return loadJobsPaginated(path, options);
  },

  async getById(id: string): Promise<Job | undefined> {
    try {
      const row = await httpClient.get<JobRow>(`/jobs/${id}`);
      const job = autoUpdateStatus(mapBase(row)); // status UI + persistedStatus da DB
      const [payments, events] = await Promise.all([
        paymentAPI.listByJob(job.id),
        jobEventAPI.listByJob(job.id),
      ]);
      job.payments = payments;
      job.events = events;
      return job;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return undefined;
      }
      throw error;
    }
  },

  async create(
    payload: Omit<
      Job,
      "id" | "events" | "payments" | "docs" | "team" | "customer" | "createdAt" | "files"
    > & {
      extraPayments?: Array<{
        label: string;
        amount: number;
        collected?: boolean;
        partial?: boolean;
        collectedAmount?: number;
      }>;
      inheritOrderPaymentIds?: string[];
    }
  ): Promise<Job> {
    const row = await httpClient.post<JobRow>("/jobs", {
      jobOrderId: payload.jobOrderId,
      plannedDate: payload.plannedDate,
      title: payload.title,
      status: payload.status,
      assignedWorkers: payload.assignedWorkers ?? [],
      notes: payload.notes ?? null,
      notesBackoffice: payload.notesBackoffice ?? null,
      location: payload.location ?? {},
      ...(payload.extraPayments?.length
        ? { extraPayments: payload.extraPayments }
        : {}),
      ...(payload.inheritOrderPaymentIds?.length
        ? { inheritOrderPaymentIds: payload.inheritOrderPaymentIds }
        : {}),
    });
    invalidateJobsCache();
    emitJobsUpdated();
    return autoUpdateStatus(mapBase(row));
  },

  async checkout(
    id: string,
    body: {
      status: "completato" | "da_completare";
      eventDate: string;
      reportNotes: string;
      notes?: string;
      payments: Array<{
        id: string;
        collected: boolean;
        partial: boolean;
        collectedAmount: number;
      }>;
      attachDocumentIds?: string[];
      signature?: {
        signerName: string;
        imageDataUrl: string;
      };
      checkoutDigital?: {
        form: {
          dataInizioMontaggio: string;
          dataFineMontaggio: string;
          serramentiControllo: "si_completo" | "no_parziale" | null;
          vetriIntegri: boolean | null;
          siliconeAcrilico: boolean | null;
          noteMontatore: string;
          noteCliente: string;
          clienteSignerName: string;
        };
        context: {
          orderCode?: string | null;
          orderDate?: string | null;
          customerName?: string | null;
          customerPhone?: string | null;
          destination?: string | null;
          performingTechnicianName: string;
          crewOnSiteNames?: string[];
        };
      };
    }
  ): Promise<
    Job & {
      checkoutEmailSent?: boolean;
      checkoutEmailSkippedReason?: string;
      orderOfficeStatus?: string | null;
      orderOfficeCloseOutcome?: "settled" | "insolute";
    }
  > {
    const row = await httpClient.post<
      JobRow & {
        checkoutEmailSent?: boolean;
        checkoutEmailSkippedReason?: string;
        orderOfficeStatus?: string | null;
        orderOfficeCloseOutcome?: "settled" | "insolute";
      }
    >(`/jobs/${id}/checkout`, body);
    invalidateJobsCache();
    emitJobsUpdated();
    return {
      ...autoUpdateStatus(mapBase(row)),
      checkoutEmailSent: row.checkoutEmailSent,
      checkoutEmailSkippedReason: row.checkoutEmailSkippedReason,
      orderOfficeStatus: row.orderOfficeStatus,
      orderOfficeCloseOutcome: row.orderOfficeCloseOutcome,
    };
  },

  async update(id: string, patch: Partial<Job>): Promise<Job> {
    const row = await httpClient.put<JobRow>(`/jobs/${id}`, {
      ...(patch.jobOrderId !== undefined ? { jobOrderId: patch.jobOrderId } : {}),
      ...(patch.plannedDate !== undefined ? { plannedDate: patch.plannedDate } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.assignedWorkers !== undefined
        ? { assignedWorkers: patch.assignedWorkers }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.notesBackoffice !== undefined
        ? { notesBackoffice: patch.notesBackoffice }
        : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
    });
    invalidateJobsCache();
    emitJobsUpdated();
    return autoUpdateStatus(mapBase(row));
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/jobs/${id}`);
    invalidateJobsCache();
    emitJobsUpdated();
  },
};
