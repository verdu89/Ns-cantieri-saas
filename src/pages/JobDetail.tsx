// src/pages/JobDetail.tsx
import { Button } from "@/components/ui/Button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { jobAPI } from "@/api/jobs";
import { workerAPI } from "@/api/workers";
import { documentAPI } from "@/api/documentAPI";
import { jobOrderAPI } from "@/api/jobOrders";
import { customerAPI } from "@/api/customers";
import { useAuth } from "@/context/AuthContext";
import type {
  Job,
  Worker,
  Payment,
  Documento,
  JobOrder,
  Customer,
} from "@/types";
import { toast } from "react-hot-toast";

// ✅ Componenti estratti
import JobHeader from "./job/JobHeader";
import JobStatusEditor from "./job/JobStatusEditor";
import JobPayments from "./job/JobPayments";
import JobDocuments from "./job/JobDocuments";
import JobNotes from "./job/JobNotes";
import JobCheckoutModal from "./job/JobCheckoutModal";
import JobCheckoutReport from "./job/JobCheckoutReport";
import StorageUsageBanner from "@/components/StorageUsageBanner";
import { JobAssistenzaPanel } from "@/components/assistenza/JobAssistenzaPanel";
import { isAssistenzaJob } from "@/config/assistenzaConfig";

// 🔹 Utils date centralizzate
import { toInputDateTime } from "@/utils/date";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const jobId = id ?? "";

  const { user } = useAuth();
  const isBackoffice = user?.role === "backoffice" || user?.role === "admin";

  const currentUser = useMemo(() => {
    const display =
      user?.name || user?.email?.split("@")[0] || "Utente";
    return {
      id: user?.id || "user-unknown",
      name: String(display),
      role: user?.role || "worker",
    };
  }, [user]);

  // ===== Stati =====
  const [job, setJob] = useState<Job | null>(null);
  const [order, setOrder] = useState<JobOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderDocs, setOrderDocs] = useState<Documento[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>("");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [finalConclusion, setFinalConclusion] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [ultimato, setUltimato] = useState<"si" | "no" | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const [docs, setDocs] = useState<Documento[]>([]);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);
  const [assignedWorkers, setAssignedWorkers] = useState<string[]>([]);
  const [plannedLocal, setPlannedLocal] = useState<string>("");

  /* ========== Load Data ========== */
  const loadData = useCallback(async () => {
    if (!jobId) {
      setError("ID intervento non valido.");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);

      const [j, w] = await Promise.all([
        jobAPI.getById(jobId),
        workerAPI.list(),
      ]);

      if (!j) {
        setError("Intervento non trovato.");
        setJob(null);
        setWorkers(w ?? []);
        return;
      }

      setJob(j);
      setAssignedWorkers(j.assignedWorkers ?? []);
      setPlannedLocal(j.plannedDate ? toInputDateTime(j.plannedDate) : "");
      setPayments(j.payments ?? []);

      const orderId = j.jobOrderId;

      const [oDocs, jDocs, orderObj] = await Promise.all([
        orderId
          ? documentAPI.listByOrder(orderId)
          : Promise.resolve<Documento[]>([]),
        documentAPI.listByJob(jobId),
        orderId
          ? jobOrderAPI.getById(orderId)
          : Promise.resolve<JobOrder | null>(null),
      ]);

      setOrderDocs(oDocs);
      setDocs(jDocs);

      if (orderObj) {
        setOrder(orderObj);
        setOrderNotes(orderObj.notes ?? "");
        if (orderObj.customerId) {
          const cust = await customerAPI.getById(orderObj.customerId);
          setCustomer(cust ?? null);
        } else {
          setCustomer(null);
        }
      } else {
        setOrder(null);
        setOrderNotes("");
        setCustomer(null);
      }

      setWorkers(w ?? []);
    } catch (e) {
      console.error("Errore loadData JobDetail:", e);
      toast.error("Errore durante il caricamento.");
      setError("Errore durante il caricamento.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ========== Guard ========== */
  if (loading && !job)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-8 text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
        Caricamento intervento…
      </div>
    );
  if (error && !job)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">{error}</div>
    );
  if (!job)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Intervento non trovato
      </div>
    );

  /* ========== Logica bottone checkout ========== */
  const checkoutableStatuses: Job["status"][] = [
    "assegnato",
    "in_corso",
    "in_ritardo",
  ];

  const canDoCheckout =
    checkoutableStatuses.includes(job.status) &&
    ((currentUser.role === "worker" &&
      ["in_corso", "in_ritardo"].includes(job.status)) ||
      currentUser.role === "backoffice" ||
      (currentUser.role === "admin" &&
        ["assegnato", "in_corso", "in_ritardo"].includes(job.status)));

  // 🔹 I worker possono editare solo se hanno checkout disponibile
  const canEdit =
    isBackoffice || (currentUser.role === "worker" && canDoCheckout);

  /* ========== Render ========== */
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <JobHeader
        job={job}
        order={order || undefined}
        customer={customer || undefined}
      />

      {/* STATO & PROGRAMMAZIONE */}
      {isBackoffice && (
        <JobStatusEditor
          job={job}
          setJob={setJob}
          workers={workers}
          assignedWorkers={assignedWorkers}
          setAssignedWorkers={setAssignedWorkers}
          status={job.status}
          setStatus={(s) => setJob((j) => (j ? { ...j, status: s } : j))}
          plannedLocal={plannedLocal}
          setPlannedLocal={setPlannedLocal}
        />
      )}

      {isBackoffice && isAssistenzaJob(job) && (
        <JobAssistenzaPanel
          job={job}
          onJobPatch={(patch) => setJob((j) => (j ? { ...j, ...patch } : j))}
        />
      )}

      {/* PAYMENTS */}
      <JobPayments
        job={job}
        payments={payments}
        setPayments={setPayments}
        isBackoffice={isBackoffice}
        currentUserRole={
          currentUser.role as "montatore" | "backoffice" | "admin"
        }
        readOnly={!canEdit}
      />

      {/* DOCUMENTI */}
      <StorageUsageBanner refreshKey={storageRefreshKey} className="mb-2" />
      <JobDocuments
        orderDocs={orderDocs}
        docs={docs}
        setDocs={setDocs}
        jobId={job.id}
        canEdit={canEdit}
        onStorageChange={() => setStorageRefreshKey((k) => k + 1)}
      />

      {/* NOTE INTERVENTO */}
      <JobNotes
        job={job}
        setJob={setJob}
        orderNotes={orderNotes}
        readOnly={!canEdit}
      />

      {/* OPERATIVITÀ / CHECKOUT */}
      {canDoCheckout && (
        <div className="flex justify-center py-6">
          <Button
            onClick={() => setCheckoutOpen(true)}
            variant="primary"
            className="w-full px-4 py-2.5 text-[15px] font-semibold shadow-md shadow-orange-900/15 sm:w-auto"
          >
            Apri checkout
          </Button>
        </div>
      )}

      {/* CHECKOUT SUMMARY */}
      <div className="mt-6 sm:mt-8">
        <JobCheckoutReport job={job} docs={docs} order={order!} />
      </div>

      {/* MODALE CHECKOUT */}
      {checkoutOpen && (
        <JobCheckoutModal
          job={job}
          orderCode={order?.code}
          orderDate={order?.createdAt}
          customerName={customer?.name ?? job.customer?.name}
          customerPhone={customer?.phone ?? job.customer?.phone}
          payments={payments}
          setPayments={setPayments}
          ultimato={ultimato}
          setUltimato={setUltimato}
          finalConclusion={finalConclusion}
          setFinalConclusion={setFinalConclusion}
          setCheckoutOpen={setCheckoutOpen}
          checkingOut={checkingOut}
          setCheckingOut={setCheckingOut}
          loadData={loadData}
          onStorageChange={() => setStorageRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
