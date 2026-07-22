import type { JobOrder } from "@/types";
import {
  contractExpiryLabel,
  formatDeliveryWeek,
  getDeliveryDeadlineSummary,
  latestDeliveryShiftNote,
} from "@/utils/officeElenco";
import { formatDate } from "@/utils/date";

type Props = {
  order: Pick<
    JobOrder,
    | "expectedDeliveryDate"
    | "deliveryWeekYear"
    | "deliveryWeekNum"
    | "deliveryDateHistory"
  >;
  compact?: boolean;
};

const STATUS_STYLES = {
  none: "border-slate-200 bg-slate-50 text-slate-700",
  ok: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  soon: "border-sky-200 bg-sky-50/70 text-sky-900",
  this_week: "border-amber-200 bg-amber-50/80 text-amber-900",
  overdue: "border-red-200 bg-red-50/80 text-red-900",
} as const;

export default function DeliveryDeadlineSummary({ order, compact = false }: Props) {
  const summary = getDeliveryDeadlineSummary(order);
  const expiry = contractExpiryLabel(summary);
  const shiftNote = latestDeliveryShiftNote(order.deliveryDateHistory);
  const showWeekShift = Boolean(
    summary.plannedWeek && summary.termineIso && !summary.weeksAligned
  );

  if (compact) {
    if (!summary.termineIso && !summary.plannedWeek) return null;

    if (!summary.termineIso && summary.plannedWeek) {
      return (
        <span className="text-sm text-slate-600">
          Settimana elenco{" "}
          <strong className="text-slate-800">
            {formatDeliveryWeek(summary.plannedWeek.year, summary.plannedWeek.week)}
          </strong>
          {shiftNote ? (
            <>
              {" "}
              — <span className="text-slate-600">{shiftNote}</span>
            </>
          ) : null}
        </span>
      );
    }

    return (
      <span className="text-sm text-slate-600">
        Termine di consegna contratto{" "}
        <strong className="text-slate-800">{formatDate(summary.termineIso!)}</strong>
        {expiry ? (
          <span
            className={
              summary.status === "overdue"
                ? " font-medium text-red-700"
                : " text-slate-600"
            }
          >
            {" "}
            ({expiry})
          </span>
        ) : null}
        {showWeekShift && summary.plannedWeek ? (
          <>
            {" "}
            — Spostato a sett.{" "}
            <strong className="text-slate-800">
              {formatDeliveryWeek(summary.plannedWeek.year, summary.plannedWeek.week)}
            </strong>
            {shiftNote ? (
              <>
                {" "}
                — <span className="text-slate-600">{shiftNote}</span>
              </>
            ) : null}
          </>
        ) : null}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${STATUS_STYLES[summary.status]}`}>
      {summary.termineIso ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            Termine di consegna contratto
          </p>
          <p className="mt-1 text-lg font-bold">
            {formatDate(summary.termineIso)}
            {expiry ? (
              <span className="ml-2 text-base font-semibold opacity-90">({expiry})</span>
            ) : null}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            Termine di consegna contratto
          </p>
          <p className="mt-1 text-lg font-bold">Non indicato in commessa</p>
        </>
      )}

      {showWeekShift && summary.plannedWeek ? (
        <div className="mt-3 border-t border-black/5 pt-3 text-sm">
          <p>
            Spostato a sett.{" "}
            <strong>
              {formatDeliveryWeek(summary.plannedWeek.year, summary.plannedWeek.week)}
            </strong>
          </p>
          {shiftNote ? <p className="mt-1 opacity-90">— {shiftNote}</p> : null}
        </div>
      ) : summary.plannedWeek && summary.weeksAligned ? (
        <p className="mt-2 text-sm opacity-90">
          Settimana elenco allineata al termine (
          {formatDeliveryWeek(summary.plannedWeek.year, summary.plannedWeek.week)}).
        </p>
      ) : null}

      {!summary.termineIso && summary.plannedWeek && (
        <p className="mt-2 text-sm opacity-90">
          Settimana elenco{" "}
          {formatDeliveryWeek(summary.plannedWeek.year, summary.plannedWeek.week)}.
          Imposta il termine contratto alla creazione commessa.
        </p>
      )}
    </div>
  );
}
