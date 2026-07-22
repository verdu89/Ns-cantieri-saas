import { Link } from "react-router-dom";
import { ArrowLeft, Edit, Link as LinkIcon, MapPin, Phone } from "lucide-react";
import type { Customer, Job, JobOrder } from "@/types";
import { OFFICE_STATUS_CONFIG } from "@/config/officeWorkflow";
import { elencoSectionLabel } from "@/utils/orderNextStep";
import { customerDestinationCity } from "@/utils/customerCity";
import { surfaceCardClass } from "@/components/layout/PageChrome";
import { Button } from "@/components/ui/Button";
import DeliveryDeadlineSummary from "@/components/office/DeliveryDeadlineSummary";

type Props = {
  order: JobOrder;
  customer: Customer | null;
  jobs: Job[];
  officeWorkflowEnabled: boolean;
  onEditOrder?: () => void;
};

export default function OrderDetailHeader({
  order,
  customer,
  jobs,
  officeWorkflowEnabled,
  onEditOrder,
}: Props) {
  const section = officeWorkflowEnabled ? elencoSectionLabel(order, jobs) : null;
  const statusConfig =
    order.officeStatus && order.officeStatus in OFFICE_STATUS_CONFIG
      ? OFFICE_STATUS_CONFIG[order.officeStatus]
      : null;
  const comune =
    order.destinationCity?.trim() || customerDestinationCity(customer) || null;

  return (
    <div className={`${surfaceCardClass} p-4 md:p-6`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {officeWorkflowEnabled && (
          <Link
            to="/backoffice/office"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Elenco ufficio
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            Commessa {order.code}
          </h1>
          {customer && (
            <p className="mt-1 text-sm text-slate-600">
              Cliente:{" "}
              <Link
                to={`/backoffice/customers/${customer.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {customer.name}
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onEditOrder ? (
            <Button
              type="button"
              variant="outline"
              className="inline-flex items-center gap-2 py-2 text-sm"
              onClick={onEditOrder}
            >
              <Edit size={16} />
              Modifica commessa
            </Button>
          ) : null}
          {statusConfig ? (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm ${statusConfig.accent}`}
            >
              {statusConfig.label}
            </span>
          ) : (
            officeWorkflowEnabled && (
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 sm:text-sm">
                Storica
              </span>
            )
          )}
          {section && (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 sm:text-sm">
              Elenco: {section}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <MapPin size={16} className="opacity-70" />
            Cantiere:
          </span>
          <span>{order.location?.address?.trim() || "—"}</span>
          {order.location?.mapsUrl && (
            <a
              href={order.location.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <LinkIcon size={14} />
              Maps
            </a>
          )}
        </div>
        {officeWorkflowEnabled && (
          <div className="mt-2">
            <DeliveryDeadlineSummary order={order} compact />
          </div>
        )}
        {officeWorkflowEnabled && (comune || customer?.phone) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
            {comune && (
              <span>
                <span className="font-medium text-slate-500">Comune consegna:</span>{" "}
                {comune}
              </span>
            )}
            {customer?.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={14} className="opacity-70" />
                {customer.phone}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
