// src/pages/job/JobHeader.tsx
import { Card, CardContent } from "@/components/ui/Card";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { Job, JobOrder, Customer, JobStatus } from "@/types";
import { STATUS_CONFIG } from "@/config/statusConfig";
import { formatDateTime } from "@/utils/date";
import { jobTitleDisplay } from "@/config/jobTitles";
import { AssistenzaBadges } from "@/components/assistenza/AssistenzaBadges";

interface JobHeaderProps {
  job: Job;
  customer?: Customer;
  order?: JobOrder;
}

export default function JobHeader({ job, customer, order }: JobHeaderProps) {
  const { user } = useAuth();
  const role = user?.role; // "admin" | "backoffice" | "worker"
  const isStaff = role === "admin" || role === "backoffice";

  const customerName = customer?.name ?? job.customer?.name ?? "—";
  const phone = customer?.phone ?? job.customer?.phone ?? "";

  const composedCustomerAddress = [
    customer?.address || customer?.street || "",
    customer?.cap || customer?.postal_code || "",
    customer?.city || "",
    customer?.province || "",
  ]
    .filter(Boolean)
    .join(" ");

  const address =
    job?.location?.address ||
    order?.site_address ||
    order?.address ||
    composedCustomerAddress ||
    "";

  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        address
      )}`
    : "#";

  const telHref = phone ? `tel:${phone}` : "";

  // 🔹 usa sempre il campo aggiornato dal DB
  const formattedPlannedDate =
    job?.plannedDate && job.plannedDate !== null
      ? formatDateTime(job.plannedDate)
      : "Non programmato";

  // 🔹 mostra SOLO lo stato del DB (coerente con Agenda/MyJobs)
  const effectiveStatus = job.status as JobStatus;
  const cfg = STATUS_CONFIG[effectiveStatus];

  return (
    <Card>
      <CardContent className="p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        {/* Colonna sinistra */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cliente
              </div>
              {isStaff && customer ? (
                <Link
                  to={`/backoffice/customers/${customer.id}`}
                  className="text-lg font-bold text-slate-900 transition-colors hover:text-brand hover:underline"
                >
                  {customerName}
                </Link>
              ) : (
                <div className="text-lg font-bold text-slate-900">{customerName}</div>
              )}

              {/* 👇 riferimento commessa */}
              {order && (
                <div className="text-sm text-slate-600">
                  Commessa:{" "}
                  {isStaff ? (
                    <Link
                      to={`/backoffice/orders/${order.id}`}
                      className="font-bold text-slate-900 transition-colors hover:text-brand hover:underline"
                    >
                      {order.code ?? order.numero ?? "—"}
                    </Link>
                  ) : (
                    <span className="font-bold text-slate-900">
                      {order.code ?? order.numero ?? "—"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-lg">📍</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Indirizzo
              </div>
              {address ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base font-bold text-slate-900 transition-colors hover:text-brand hover:underline"
                >
                  {address}
                </a>
              ) : (
                <span className="text-sm font-medium text-slate-500">—</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">📞</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Telefono
              </div>
              {phone ? (
                <a
                  href={telHref}
                  className="text-base font-bold text-slate-900 transition-colors hover:text-brand hover:underline"
                >
                  {phone}
                </a>
              ) : (
                <span className="text-sm font-medium text-slate-500">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Colonna destra */}
        <div className="flex flex-col items-start md:items-end gap-3">
          <div className="flex flex-col items-start md:items-end gap-2">
            <span className={`${cfg.color} flex items-center gap-1`}>
              {cfg.icon} {cfg.label}
            </span>
            <AssistenzaBadges job={job} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Data prevista
              </div>
              <div className="text-base font-bold text-slate-900">
                {formattedPlannedDate}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Intervento
              </div>
              <div className="text-base font-bold text-slate-900">
                {jobTitleDisplay(job.title)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
