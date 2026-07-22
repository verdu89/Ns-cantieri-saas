// Cliente
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
  notes?: string;
  /** Campi legacy opzionali (import / UI estesa) */
  street?: string;
  cap?: string;
  postal_code?: string;
  city?: string;
  province?: string;
}

import type {
  DeliveryDateChange,
  OfficeOpenItem,
  OfficeStatus,
} from "@/config/officeWorkflow";

// Commesse (job_orders)
export interface JobOrder {
  id: string;
  code: string;
  customerId: string;
  /** Presente in elenco API quando il backend include il join cliente */
  customerName?: string;
  customerPhone?: string;
  location: {
    address?: string;
    mapsUrl?: string;
  };
  notes?: string;
  notesBackoffice?: string;
  officeStatus?: OfficeStatus;
  expectedDeliveryDate?: string | null;
  depositAmount?: number;
  depositCollectedAt?: string;
  clientConfirmedAt?: string | null;
  clientConfirmedNote?: string | null;
  openItems?: OfficeOpenItem[];
  deliveryDateHistory?: DeliveryDateChange[];
  deliveryWeekYear?: number | null;
  deliveryWeekNum?: number | null;
  deliveryCons?: string | null;
  contactName?: string | null;
  destinationCity?: string | null;
  productColor?: string | null;
  pieceCount?: number | null;
  hasControcasse?: boolean;
  hasMontaggio?: boolean;
  hasEneaPratica?: boolean;
  eneaPraticaPendingAt?: string | null;
  eneaPraticaCompletedAt?: string | null;
  eneaPraticaNote?: string | null;
  createdAt: string;
  payments?: Payment[];
  /** Campi legacy opzionali */
  site_address?: string;
  address?: string;
  numero?: string;
}

/** Priorità ufficio (solo interventi `title = assistenza`). */
export type JobPriority = "normale" | "alta" | "urgente";

export interface JobFollowUp {
  id: string;
  jobId: string;
  createdAt: string;
  actorWorkerId?: string | null;
  actorName?: string | null;
  note?: string | null;
  priorityAfter: JobPriority;
  markUrgent: boolean;
}

// Stati possibili per un job/intervento
export type JobStatus =
  | "in_attesa_programmazione"
  | "assegnato"
  | "in_corso"
  | "da_completare"
  | "completato"
  | "annullato"
  | "in_ritardo";

// Eventi di un job (check-in, check-out, ecc.)
export interface JobEvent {
  id: string;
  jobId: string;
  type: "check_in" | "check_out_completato" | "check_out_da_completare";
  timestamp: string;
  notes?: string;
  createdBy: string; // workerId o backoffice
  createdAt?: string;
  date?: string;
}

// Pagamenti di un job
export interface Payment {
  id: string;
  jobId: string;
  label: string;
  amount: number;
  collected: boolean;
  createdAt?: string | null;
  notes?: string;
  partial: boolean;
  collectedAmount: number;
  source?: "job" | "order";
}

/** Pagamenti piano commessa (solo ufficio). */
export interface OrderPayment {
  id: string;
  jobOrderId: string;
  label: string;
  amount: number;
  collected: boolean;
  partial: boolean;
  collectedAmount: number;
  showOnField?: boolean;
  createdAt?: string;
}

// Worker (montatore)
export interface Worker {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  createdAt?: string;
  email?: string;
  role?: string;
  checkoutCelebrationMessage?: string | null;
  checkoutCelebrationImageUrl?: string | null;
}

// Documenti (sia commessa che job)
export interface Documento {
  id: string;
  commessaId?: string; // se legato a una commessa
  jobId?: string; // se legato a un job
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  /** Commessa: false = nascosto in cantiere */
  showOnField?: boolean;
  /** job = allegato intervento; order = visibile da commessa (sola lettura in cantiere) */
  source?: "job" | "order";
  orderDocumentId?: string;
  /** Sessione checkout (1, 2, …); null = documento cantiere generico */
  checkoutIndex?: number | null;
  createdAt: string;
}

export type CheckoutBranding = {
  companyName: string | null;
  subtitle: string | null;
  legalText: string | null;
  footerWebsite: string | null;
  logoUrl: string | null;
  headerLayout: string | null;
  brandColor: string | null;
};

/** Codice tipologia intervento (persistito su DB come stringa). */
export type JobTitle =
  | "consegna"
  | "montaggio"
  | "consegna_montaggio"
  | "assistenza"
  | "altro"
  | "consegna_controcasse"
  | "ritiro_vecchi_infissi";

// Lavori/Interventi (jobs)
export interface Job {
  id: string;
  jobOrderId: string;
  createdAt: string;
  plannedDate: string | null;
  title: JobTitle;
  notes?: string;
  notesBackoffice?: string;
  assignedWorkers: string[];
  status: JobStatus;
  /** Stato salvato in DB (prima delle regole automatiche UI). */
  persistedStatus?: JobStatus;
  /** Solo assistenza post-vendita */
  priority?: JobPriority;
  followUpCount?: number;
  lastFollowUpAt?: string | null;
  orderCode?: string;
  events: JobEvent[];
  customer: Customer;
  team: Worker[];
  payments: Payment[];
  docs: Documento[];
  files: Documento[];
  location?: {
    address?: string;
    mapsUrl?: string;
  };
}

// Payload per creare un nuovo job
export type JobCreate = Omit<
  Job,
  "id" | "events" | "customer" | "team" | "payments" | "docs"
>;

// ===== Utenti (AuthContext) =====
// src/types/User.ts

export type UserRole = "worker" | "backoffice" | "admin";

export interface User {
  id: string; // id dell'utente Supabase (auth.users)
  email: string; // email dell'utente Supabase
  workerId: string; // id del record nella tabella workers
  name: string; // nome del worker (colonna "name" in workers)
  role: UserRole; // ruolo (worker, backoffice, admin)
  tenantId?: string | null;
  reviewRequestEnabled?: boolean;
  checkoutDigitalEnabled?: boolean;
  officeWorkflowEnabled?: boolean;
  checkoutBranding?: CheckoutBranding | null;
  isPlatformAdmin?: boolean;
  checkoutCelebrationMessage?: string | null;
  checkoutCelebrationImageUrl?: string | null;
}
