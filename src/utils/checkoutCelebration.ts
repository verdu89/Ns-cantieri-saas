export type CheckoutOutcome = "completato" | "da_completare";

export function resolveCheckoutCelebrationMessage(
  customMessage: string | null | undefined,
  workerName: string
): string {
  const trimmed = customMessage?.trim();
  if (trimmed) return trimmed;
  const first = workerName.trim().split(/\s+/)[0] || workerName;
  return `Ottimo lavoro, ${first}!`;
}

export function checkoutOutcomeCopy(outcome: CheckoutOutcome) {
  if (outcome === "completato") {
    return {
      title: "Intervento completato",
      subtitle: "Checkout registrato in cantiere",
      tone: "success" as const,
    };
  }
  return {
    title: "Checkout registrato",
    subtitle: "Restano attività da completare",
    tone: "pending" as const,
  };
}
