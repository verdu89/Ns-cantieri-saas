import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { jobOrderAPI } from "@/api/jobOrders";
import { customerAPI } from "@/api/customers";
import { jobAPI } from "@/api/jobs";
import { workerAPI } from "@/api/workers";
import { documentAPI } from "@/api/documentAPI";
import { orderPaymentAPI } from "@/api/orderPayments";
import { uploadDocumentsToOrder } from "@/utils/uploadDocuments";
import type {
  Customer,
  Documento,
  Job,
  JobOrder,
  OrderPayment,
  Payment,
  Worker,
} from "@/types";
import { useJobsListRefresh } from "@/hooks/useJobsListRefresh";
import { useUploadQueue } from "@/context/UploadQueueContext";
import { useAuth } from "@/context/AuthContext";
import { parseHttpErrorMessage } from "@/utils/httpError";
import { surfaceCardClass } from "@/components/layout/PageChrome";
import OrderDetailHeader from "@/components/order/OrderDetailHeader";
import JobOrderQuickEditModal, {
  jobOrderToQuickEditForm,
  type JobOrderQuickEditForm,
} from "@/components/order/JobOrderQuickEditModal";
import OrderNextStepCard from "@/components/order/OrderNextStepCard";
import OrderOfficeTab from "@/components/order/OrderOfficeTab";
import OrderFieldTab from "@/components/order/OrderFieldTab";
import type { OrderDetailTab, OrderNextStepAction } from "@/utils/orderNextStep";
import { summarizeOrderFieldJobs } from "@/utils/officeBoard";
import {
  OFFICE_CLOSED_STATUS,
  OFFICE_UNSETTLED_STATUS,
} from "@/utils/officeBoard";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const officeWorkflowEnabled = Boolean(user?.officeWorkflowEnabled);

  const [order, setOrder] = useState<JobOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [orderPayments, setOrderPayments] = useState<OrderPayment[]>([]);
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<OrderDetailTab>("ufficio");

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Job>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inheritPaymentIds, setInheritPaymentIds] = useState<string[]>([]);
  const [showOrderEdit, setShowOrderEdit] = useState(false);
  const [orderForm, setOrderForm] = useState<JobOrderQuickEditForm>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    name?: string;
  } | null>(null);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);
  const [lastCreatedJobId, setLastCreatedJobId] = useState<string | null>(null);

  const { notifyQueued, refreshPendingCount } = useUploadQueue();
  const officePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const o = await jobOrderAPI.getById(id);
        if (!o) return;
        setOrder(o);
        setNotes(o.notes ?? "");
        const c = await customerAPI.getById(o.customerId);
        setCustomer(c ?? null);
        const [j, docs, payments] = await Promise.all([
          jobAPI.listByOrder(o.id, { includePayments: true }),
          documentAPI.listByOrder(o.id),
          orderPaymentAPI.listByOrder(o.id),
        ]);
        setJobs(j ?? []);
        setDocumenti(docs ?? []);
        setOrderPayments(payments ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Errore caricamento commessa");
      }
    })();
  }, [id]);

  useEffect(() => {
    workerAPI.list().then((w) => setWorkers(w ?? []));
  }, []);

  const refreshOrderAndJobs = useCallback(async () => {
    if (!id) return;
    const [freshJobs, freshOrder, freshPayments] = await Promise.all([
      jobAPI.listByOrder(id, { includePayments: true, forceFresh: true }),
      jobOrderAPI.getById(id),
      orderPaymentAPI.listByOrder(id),
    ]);
    setJobs(freshJobs ?? []);
    if (freshOrder) setOrder(freshOrder);
    setOrderPayments(freshPayments ?? []);
  }, [id]);

  const handlePaymentsChange = useCallback(
    async (payments: OrderPayment[]) => {
      setOrderPayments(payments);
      if (!id) return;
      const freshOrder = await jobOrderAPI.getById(id);
      if (!freshOrder) return;
      if (
        order?.officeStatus === OFFICE_UNSETTLED_STATUS &&
        freshOrder.officeStatus === OFFICE_CLOSED_STATUS
      ) {
        toast.success("Commessa passata a Terminate e consegnate");
      }
      setOrder(freshOrder);
    },
    [id, order?.officeStatus]
  );

  useJobsListRefresh(() => {
    void refreshOrderAndJobs();
  });

  const initialTabForOrder = useRef<string | null>(null);

  useEffect(() => {
    initialTabForOrder.current = null;
    setActiveTab("ufficio");
  }, [order?.id]);

  useEffect(() => {
    if (!order || !officeWorkflowEnabled || initialTabForOrder.current === order.id) {
      return;
    }
    const { openField } = summarizeOrderFieldJobs(jobs, order.id);
    if (openField.length > 0) {
      setActiveTab("cantiere");
      initialTabForOrder.current = order.id;
    } else {
      initialTabForOrder.current = order.id;
    }
  }, [order?.id, jobs, officeWorkflowEnabled]);

  const sortedJobs = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .sort((a, b) => {
          if (lastCreatedJobId === a.id) return -1;
          if (lastCreatedJobId === b.id) return 1;
          return 0;
        }),
    [jobs, lastCreatedJobId]
  );

  const allPayments: Payment[] = useMemo(
    () => jobs.flatMap((j) => (j.payments ?? []).map((p) => ({ ...p, jobId: j.id }))),
    [jobs]
  );

  /** Totali economici: piano commessa se presente (evita doppi conteggi tra uscite). */
  const totalExpected =
    orderPayments.length > 0
      ? orderPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
      : allPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const totalCollected =
    orderPayments.length > 0
      ? orderPayments.reduce((s, p) => {
          if (p.collected) return s + (p.amount ?? 0);
          if (p.partial) return s + (p.collectedAmount ?? 0);
          return s;
        }, 0)
      : allPayments.reduce((s, p) => {
          if (p.collected) return s + (p.amount ?? 0);
          if (p.partial) return s + (p.collectedAmount ?? 0);
          return s;
        }, 0);
  const totalPending = totalExpected - totalCollected;

  const openNewJobForm = () => {
    setFormData({});
    setEditingId(null);
    setInheritPaymentIds([]);
    setShowForm(true);
    setActiveTab("cantiere");
  };

  const handleNextStepAction = (action: OrderNextStepAction) => {
    if (action === "create_job") {
      openNewJobForm();
      return;
    }
    if (action === "view_jobs") {
      setActiveTab("cantiere");
      return;
    }
    if (action === "confirm_client" || action === "go_office") {
      setActiveTab("ufficio");
      officePanelRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    try {
      const updated = await jobOrderAPI.update(order.id, { notes });
      setOrder(updated);
      toast.success("Note aggiornate");
    } catch {
      toast.error("Errore salvataggio note");
    }
  };

  const handleSaveJob = async () => {
    if (!order || !formData.title) {
      toast.error("Tipologia intervento obbligatoria");
      return;
    }
    try {
      if (editingId) {
        await jobAPI.update(editingId, {
          title: formData.title as Job["title"],
          plannedDate: (formData.plannedDate as string | null) ?? null,
          assignedWorkers: formData.assignedWorkers ?? [],
          notes: formData.notes ?? "",
          ...(typeof formData.status === "string"
            ? { status: formData.status as Job["status"] }
            : {}),
        });
        toast.success("Intervento aggiornato");
      } else {
        const created = await jobAPI.create({
          jobOrderId: order.id,
          title: formData.title as Job["title"],
          notes: formData.notes ?? "",
          status: "in_attesa_programmazione",
          assignedWorkers: formData.assignedWorkers ?? [],
          location: order.location ?? {},
          plannedDate: (formData.plannedDate as string | null) ?? null,
          inheritOrderPaymentIds: inheritPaymentIds,
        });
        if (created) {
          setLastCreatedJobId(created.id);
          setTimeout(() => setLastCreatedJobId(null), 10000);
        }
        toast.success("Intervento creato");
      }
      await refreshOrderAndJobs();
      setShowForm(false);
      setFormData({});
      setEditingId(null);
      setInheritPaymentIds([]);
    } catch {
      toast.error("Errore salvataggio intervento");
    }
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !order) return;
    setLoadingDocs(true);
    try {
      const result = await uploadDocumentsToOrder(
        order.id,
        Array.from(e.target.files).map((file) => ({ file })),
        {
          allowPartial: true,
          onStorageChange: () => setStorageRefreshKey((k) => k + 1),
          onProgress: (done, total, name) =>
            setUploadProgress({ done, total, name }),
        }
      );
      if (result.queued.length > 0) notifyQueued(result.queued.length);
      void refreshPendingCount();
      setDocumenti(await documentAPI.listByOrder(order.id));
      if (result.succeeded.length > 0) {
        toast.success(`${result.succeeded.length} file caricati`);
      }
    } catch (err) {
      toast.error(parseHttpErrorMessage(err, "Errore upload"));
    } finally {
      setLoadingDocs(false);
      setUploadProgress(null);
      e.target.value = "";
    }
  };

  const handleToggleHideOnField = async (doc: Documento, hide: boolean) => {
    try {
      const updated = await documentAPI.setOrderDocumentHiddenOnField(doc.id, hide);
      setDocumenti((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
    } catch {
      toast.error("Errore visibilità documento");
    }
  };

  const openOrderEdit = () => {
    if (!order) return;
    setOrderForm(jobOrderToQuickEditForm(order));
    setShowOrderEdit(true);
  };

  const handleSaveOrder = async () => {
    if (!order) return;
    if (
      !orderForm.code?.trim() ||
      (!orderForm.location?.address?.trim() && !orderForm.location?.mapsUrl?.trim())
    ) {
      toast.error("Inserisci numero commessa e indirizzo o link Maps");
      return;
    }

    setSavingOrder(true);
    try {
      const updated = await jobOrderAPI.update(order.id, {
        code: orderForm.code.trim(),
        location: {
          address: orderForm.location?.address ?? "",
          mapsUrl: orderForm.location?.mapsUrl ?? "",
        },
        notes: orderForm.notes ?? "",
        ...(officeWorkflowEnabled
          ? {
              contactName: orderForm.contactName || undefined,
              destinationCity: orderForm.destinationCity || undefined,
              notesBackoffice: orderForm.notesBackoffice || undefined,
            }
          : {}),
      });
      setOrder(updated);
      setNotes(updated.notes ?? "");
      setShowOrderEdit(false);
      setOrderForm({});
      toast.success("Commessa aggiornata");
    } catch (err) {
      console.error(err);
      toast.error("Errore salvataggio commessa");
    } finally {
      setSavingOrder(false);
    }
  };

  if (!order) {
    return <div className="p-4 text-slate-500">Caricamento commessa…</div>;
  }

  return (
    <div className="space-y-5">
      <OrderDetailHeader
        order={order}
        customer={customer}
        jobs={jobs}
        officeWorkflowEnabled={officeWorkflowEnabled}
        onEditOrder={openOrderEdit}
      />

      <JobOrderQuickEditModal
        open={showOrderEdit}
        form={orderForm}
        officeWorkflowEnabled={officeWorkflowEnabled}
        saving={savingOrder}
        onChange={setOrderForm}
        onClose={() => {
          setShowOrderEdit(false);
          setOrderForm({});
        }}
        onSave={() => void handleSaveOrder()}
      />

      {officeWorkflowEnabled && (
        <OrderNextStepCard
          order={order}
          jobs={jobs}
          onGoToTab={setActiveTab}
          onAction={handleNextStepAction}
        />
      )}

      {officeWorkflowEnabled ? (
        <>
          <div className={`flex gap-1 p-1 ${surfaceCardClass}`}>
            {(
              [
                ["ufficio", "Ufficio"],
                ["cantiere", "Cantiere"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div ref={officePanelRef}>
            {activeTab === "ufficio" ? (
              <OrderOfficeTab
                order={order}
                jobs={jobs}
                customer={customer}
                documenti={documenti}
                orderPayments={orderPayments}
                loadingDocs={loadingDocs}
                uploadProgress={uploadProgress}
                storageRefreshKey={storageRefreshKey}
                onOrderUpdated={setOrder}
                onPaymentsChange={handlePaymentsChange}
                onUploadFiles={handleUploadFiles}
                onDeleteFile={async (docId) => {
                  if (!order) return;
                  await documentAPI.deleteFromOrder(docId);
                  setDocumenti(await documentAPI.listByOrder(order.id));
                  setStorageRefreshKey((k) => k + 1);
                }}
                onToggleHideOnField={handleToggleHideOnField}
              />
            ) : (
              <OrderFieldTab
                order={order}
                jobs={jobs}
                workers={workers}
                sortedJobs={sortedJobs}
                lastCreatedJobId={lastCreatedJobId}
                notes={notes}
                onNotesChange={setNotes}
                onSaveNotes={handleSaveNotes}
                orderPayments={orderPayments}
                documenti={documenti}
                allPayments={allPayments}
                totalExpected={totalExpected}
                totalCollected={totalCollected}
                totalPending={totalPending}
                showForm={showForm}
                formData={formData}
                editingId={editingId}
                openConfirm={openConfirm}
                inheritPaymentIds={inheritPaymentIds}
                onInheritPaymentIdsChange={setInheritPaymentIds}
                onOpenNewJob={openNewJobForm}
                onCloseForm={() => {
                  setShowForm(false);
                  setFormData({});
                  setEditingId(null);
                  setInheritPaymentIds([]);
                }}
                onSaveJob={() => void handleSaveJob()}
                onFormDataChange={setFormData}
                onEditJob={(job) => {
                  setFormData({
                    ...job,
                    status: job.persistedStatus ?? job.status,
                  });
                  setEditingId(job.id);
                  setInheritPaymentIds([]);
                  setShowForm(true);
                }}
                onDeleteJob={(jobId) => {
                  setJobToDelete(jobId);
                  setOpenConfirm(true);
                }}
                onConfirmDelete={async () => {
                  if (!jobToDelete) return;
                  try {
                    await jobAPI.remove(jobToDelete);
                    toast.success("Intervento eliminato");
                    await refreshOrderAndJobs();
                  } catch {
                    toast.error("Errore eliminazione");
                  } finally {
                    setJobToDelete(null);
                  }
                }}
                setOpenConfirm={setOpenConfirm}
              />
            )}
          </div>
        </>
      ) : (
        <LegacyOrderLayout
          order={order}
          customer={customer}
          jobs={jobs}
          notes={notes}
          onNotesChange={setNotes}
          onSaveNotes={handleSaveNotes}
          orderPayments={orderPayments}
          onPaymentsChange={handlePaymentsChange}
          documenti={documenti}
          loadingDocs={loadingDocs}
          uploadProgress={uploadProgress}
          storageRefreshKey={storageRefreshKey}
          onUploadFiles={handleUploadFiles}
          onDeleteFile={async (docId) => {
            await documentAPI.deleteFromOrder(docId);
            setDocumenti(await documentAPI.listByOrder(order.id));
          }}
          onToggleHideOnField={handleToggleHideOnField}
          sortedJobs={sortedJobs}
          workers={workers}
          lastCreatedJobId={lastCreatedJobId}
          showForm={showForm}
          formData={formData}
          editingId={editingId}
          openConfirm={openConfirm}
          inheritPaymentIds={inheritPaymentIds}
          onInheritPaymentIdsChange={setInheritPaymentIds}
          allPayments={allPayments}
          totalExpected={totalExpected}
          totalCollected={totalCollected}
          totalPending={totalPending}
          onOpenNewJob={openNewJobForm}
          onCloseForm={() => {
            setShowForm(false);
            setFormData({});
            setEditingId(null);
            setInheritPaymentIds([]);
          }}
          onSaveJob={() => void handleSaveJob()}
          onFormDataChange={setFormData}
          onEditJob={(job) => {
            setFormData({ ...job, status: job.persistedStatus ?? job.status });
            setEditingId(job.id);
            setInheritPaymentIds([]);
            setShowForm(true);
          }}
          onDeleteJob={(jobId) => {
            setJobToDelete(jobId);
            setOpenConfirm(true);
          }}
          onConfirmDelete={async () => {
            if (!jobToDelete) return;
            await jobAPI.remove(jobToDelete);
            await refreshOrderAndJobs();
            setJobToDelete(null);
          }}
          setOpenConfirm={setOpenConfirm}
        />
      )}
    </div>
  );
}

/** Layout tenant senza workflow ufficio. */
function LegacyOrderLayout({
  order,
  customer,
  orderPayments,
  onPaymentsChange,
  documenti,
  loadingDocs,
  uploadProgress,
  storageRefreshKey,
  onUploadFiles,
  onDeleteFile,
  onToggleHideOnField,
  ...fieldProps
}: React.ComponentProps<typeof OrderFieldTab> & {
  customer: Customer | null;
  orderPayments: OrderPayment[];
  onPaymentsChange: (p: OrderPayment[]) => void;
  documenti: Documento[];
  loadingDocs: boolean;
  uploadProgress: { done: number; total: number; name?: string } | null;
  storageRefreshKey: number;
  onUploadFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (id: string) => void;
  onToggleHideOnField: (doc: Documento, hide: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <OrderOfficeTab
        order={order}
        jobs={fieldProps.jobs}
        customer={customer}
        documenti={documenti}
        orderPayments={orderPayments}
        loadingDocs={loadingDocs}
        uploadProgress={uploadProgress}
        storageRefreshKey={storageRefreshKey}
        showWorkflow={false}
        onOrderUpdated={() => {}}
        onPaymentsChange={onPaymentsChange}
        onUploadFiles={onUploadFiles}
        onDeleteFile={onDeleteFile}
        onToggleHideOnField={onToggleHideOnField}
      />
      <OrderFieldTab
        order={order}
        documenti={documenti}
        orderPayments={orderPayments}
        {...fieldProps}
      />
    </div>
  );
}
