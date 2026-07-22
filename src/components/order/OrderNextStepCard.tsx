import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Job, JobOrder } from "@/types";
import {
  getOrderNextStep,
  type OrderDetailTab,
  type OrderNextStepAction,
} from "@/utils/orderNextStep";
import { surfaceCardClass } from "@/components/layout/PageChrome";

type Props = {
  order: JobOrder;
  jobs: Job[];
  onGoToTab: (tab: OrderDetailTab) => void;
  onAction: (action: OrderNextStepAction) => void;
};

export default function OrderNextStepCard({ order, jobs, onGoToTab, onAction }: Props) {
  const step = getOrderNextStep(order, jobs);
  if (!step) return null;

  const primaryLabel =
    step.action === "create_job"
      ? "Crea intervento cantiere"
      : step.action === "view_jobs"
        ? "Vai agli interventi"
        : step.action === "confirm_client"
          ? "Vai a conferma misure"
          : step.action === "go_office"
            ? "Vai a ufficio"
            : `Apri ${step.tab === "cantiere" ? "cantiere" : "ufficio"}`;

  const handlePrimary = () => {
    if (step.action) onAction(step.action);
    else onGoToTab(step.tab);
  };

  return (
    <div
      className={`${surfaceCardClass} border-l-4 border-l-sky-500 p-4 md:p-5`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Prossimo passo
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-900 md:text-lg">
            {step.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{step.description}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handlePrimary}
          className="inline-flex shrink-0 items-center gap-2 py-2.5 text-sm font-semibold"
        >
          {step.action === "create_job" ? <Plus size={16} /> : <ArrowRight size={16} />}
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
