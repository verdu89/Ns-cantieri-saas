import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  calendarWeeksForMonth,
  deliveryWeekFromDate,
  formatDeliveryWeek,
  formatDeliveryWeekInput,
  parseDeliveryWeekInput,
} from "@/utils/officeElenco";
import { inputFieldClass } from "@/components/layout/PageChrome";

export type DeliveryWeekValue = { year: number; week: number } | null;

type Props = {
  value: DeliveryWeekValue;
  onChange: (value: DeliveryWeekValue) => void;
  className?: string;
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function sameWeek(a: DeliveryWeekValue, b: DeliveryWeekValue): boolean {
  return Boolean(a && b && a.year === b.year && a.week === b.week);
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DeliveryWeekPicker({ value, onChange, className = "" }: Props) {
  const initialMonth = value
    ? new Date(value.year, 0, 4 + (value.week - 1) * 7)
    : new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());
  const [weekText, setWeekText] = useState(
    value ? formatDeliveryWeekInput(value.year, value.week) : ""
  );

  useEffect(() => {
    setWeekText(value ? formatDeliveryWeekInput(value.year, value.week) : "");
    if (value) {
      const mid = new Date(value.year, 0, 4 + (value.week - 1) * 7);
      setViewYear(mid.getFullYear());
      setViewMonth(mid.getMonth());
    }
  }, [value?.year, value?.week]);

  const weeks = useMemo(
    () => calendarWeeksForMonth(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectWeek = (year: number, week: number) => {
    onChange({ year, week });
    setWeekText(formatDeliveryWeekInput(year, week));
  };

  const applyWeekText = () => {
    const parsed = parseDeliveryWeekInput(weekText);
    if (parsed.year == null || parsed.week == null) return;
    selectWeek(parsed.year, parsed.week);
    const mid = new Date(parsed.year, 0, 4 + (parsed.week - 1) * 7);
    setViewYear(mid.getFullYear());
    setViewMonth(mid.getMonth());
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Mese precedente"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[10rem] px-2 text-center text-sm font-semibold capitalize text-slate-800">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Mese successivo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {value && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-900">
            Sett. {formatDeliveryWeek(value.year, value.week)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="w-12 px-2 py-2 text-center font-semibold">W</th>
              {WEEKDAY_LABELS.map((label) => (
                <th key={label} className="px-1 py-2 text-center font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((row) => {
              const rowValue = { year: row.isoYear, week: row.isoWeek };
              const selected = sameWeek(value, rowValue);
              return (
                <tr
                  key={`${row.isoYear}-${row.isoWeek}-${dateKey(row.days[0].date)}`}
                  className={selected ? "bg-sky-50/80" : "hover:bg-slate-50/80"}
                >
                  <td className="border-r border-slate-100 px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => selectWeek(row.isoYear, row.isoWeek)}
                      className={`min-w-[2.25rem] rounded-md px-1 py-1 text-xs font-bold tabular-nums ${
                        selected
                          ? "bg-sky-600 text-white"
                          : "text-sky-700 hover:bg-sky-100"
                      }`}
                      title={`Settimana ${row.isoWeek} del ${row.isoYear}`}
                    >
                      {row.isoWeek}
                    </button>
                  </td>
                  {row.days.map(({ date, inMonth }) => {
                    const dayWeek = deliveryWeekFromDate(dateKey(date));
                    const inSelectedWeek =
                      value &&
                      dayWeek &&
                      dayWeek.year === value.year &&
                      dayWeek.week === value.week;
                    return (
                      <td key={dateKey(date)} className="px-0.5 py-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (!dayWeek) return;
                            selectWeek(dayWeek.year, dayWeek.week);
                          }}
                          className={`h-8 w-8 rounded-lg text-xs font-medium tabular-nums ${
                            inSelectedWeek
                              ? "bg-sky-600 text-white"
                              : inMonth
                                ? "text-slate-800 hover:bg-slate-100"
                                : "text-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          className={inputFieldClass}
          placeholder="Settimana (es. 2026/25)"
          value={weekText}
          onChange={(e) => setWeekText(e.target.value)}
          onBlur={applyWeekText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyWeekText();
            }
          }}
        />
        <button
          type="button"
          onClick={applyWeekText}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Applica settimana
        </button>
      </div>
    </div>
  );
}
