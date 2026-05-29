import type { CheckoutFormData } from "@/config/checkoutForm";
import { toLocalISODate } from "@/utils/date";

export type CheckoutStep = "dati" | "allegati" | "firma" | "anteprima";

export const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  dati: "Dati",
  allegati: "Allegati",
  firma: "Firma",
  anteprima: "Anteprima",
};

export function checkoutStepsForMode(digital: boolean): CheckoutStep[] {
  return digital ? ["dati", "allegati", "firma", "anteprima"] : ["dati"];
}

export function hasDigitalCheckoutDraft(
  form: CheckoutFormData,
  opts?: { signatureDataUrl?: string | null; digitalFileCount?: number }
): boolean {
  if (opts?.signatureDataUrl) return true;
  if ((opts?.digitalFileCount ?? 0) > 0) return true;
  if (form.serramentiControllo !== null) return true;
  if (form.vetriIntegri !== null) return true;
  if (form.siliconeAcrilico !== null) return true;
  if (form.noteMontatore.trim()) return true;
  if (form.noteCliente.trim()) return true;
  if (form.clienteSignerName.trim()) return true;
  return false;
}

export function hasManualCheckoutDraft(paperFileCount: number): boolean {
  return paperFileCount > 0;
}

export type CheckoutModeSwitchConfirm = "to-manual" | "to-digital";

/** Foto del foglio cartaceo firmato — solo checkout manuale. */
export function manualCheckoutPaperPhotoName(
  checkoutIndex: number,
  file: File,
  fileIndex = 0
): string {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const today = toLocalISODate(new Date());
  const suffix = fileIndex > 0 ? `_${fileIndex + 1}` : "";
  return `fine_lavoro_${checkoutIndex}_${today}${suffix}.${ext}`;
}

export function checkoutAttachmentSaveAs(
  digitalCheckout: boolean,
  checkoutIndex: number,
  file: File,
  fileIndex = 0
): string | undefined {
  if (digitalCheckout) return undefined;
  return manualCheckoutPaperPhotoName(checkoutIndex, file, fileIndex);
}
