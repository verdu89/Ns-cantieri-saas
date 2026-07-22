export const OFFICE_STATUSES = [
  "da_definire",
  "da_mandare_in_lavorazione",
  "in_lavorazione",
  "pronte_da_consegnare",
  "conclusa_insoluta",
  "conclusa_ufficio",
] as const;

/** Stati pipeline ufficio (Kanban / lavorazione). */
export const OFFICE_PIPELINE_STATUSES = [
  "da_definire",
  "da_mandare_in_lavorazione",
  "in_lavorazione",
  "pronte_da_consegnare",
] as const;

export type OfficePipelineStatus = (typeof OFFICE_PIPELINE_STATUSES)[number];
export type OfficeStatus = (typeof OFFICE_STATUSES)[number];

export type OfficeOpenItem = {
  id: string;
  text: string;
  createdAt: string;
  resolvedAt?: string | null;
};

export type DeliveryDateChange = {
  id: string;
  previousDate: string | null;
  newDate: string | null;
  /** Spostamento settimana elenco vs modifica termine contratto */
  kind?: "week" | "contract";
  previousWeekYear?: number | null;
  previousWeekNum?: number | null;
  newWeekYear?: number | null;
  newWeekNum?: number | null;
  note?: string;
  changedAt: string;
  changedBy?: string;
};

export const OFFICE_STATUS_CONFIG: Record<
  OfficeStatus,
  { label: string; shortLabel: string; accent: string; description: string }
> = {
  da_definire: {
    label: "Da definire",
    shortLabel: "Da definire",
    accent: "border-amber-400 bg-amber-50 text-amber-900",
    description: "In attesa delle misure",
  },
  da_mandare_in_lavorazione: {
    label: "Da mandare in lavorazione",
    shortLabel: "Da mandare",
    accent: "border-sky-400 bg-sky-50 text-sky-900",
    description: "Ufficio: programma, ordini, controcasse",
  },
  in_lavorazione: {
    label: "In lavorazione",
    shortLabel: "In lavorazione",
    accent: "border-violet-400 bg-violet-50 text-violet-900",
    description: "In produzione officina",
  },
  pronte_da_consegnare: {
    label: "Pronte da consegnare",
    shortLabel: "Pronte",
    accent: "border-emerald-400 bg-emerald-50 text-emerald-900",
    description: "Prodotto, in stock o in attesa cliente",
  },
  conclusa_insoluta: {
    label: "Terminate ma insolute",
    shortLabel: "Insolute",
    accent: "border-amber-400 bg-amber-50 text-amber-900",
    description: "Lavori conclusi — resta un importo da incassare",
  },
  conclusa_ufficio: {
    label: "Conclusa in ufficio",
    shortLabel: "Conclusa",
    accent: "border-slate-300 bg-slate-100 text-slate-700",
    description: "Consegna/montaggio finiti — fuori dal riepilogo attivo",
  },
};

export const OFFICE_BOARD_COLUMNS: OfficePipelineStatus[] = [
  ...OFFICE_PIPELINE_STATUSES,
];

export function initialOfficeStatus(hasMeasurements: boolean): OfficePipelineStatus {
  return hasMeasurements ? "da_mandare_in_lavorazione" : "da_definire";
}

export function countOpenItems(items: OfficeOpenItem[] | undefined): number {
  return (items ?? []).filter((item) => !item.resolvedAt).length;
}

export function officeStatusLabel(status: OfficeStatus | null | undefined): string {
  if (!status) return "Da classificare";
  return OFFICE_STATUS_CONFIG[status]?.label ?? status;
}
