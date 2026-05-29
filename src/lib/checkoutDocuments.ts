import type { Documento } from "@/types";

/** PDF modulo fine lavori generato al checkout digitale (non confondere con foto allegati). */
export function isCheckoutModuloPdf(doc: Documento): boolean {
  return (
    /\.pdf$/i.test(doc.fileName) &&
    /modulo_fine_lavori/i.test(doc.fileName)
  );
}

export function isCheckoutSignatureImage(doc: Documento): boolean {
  return /firma_cliente/i.test(doc.fileName);
}

/** Documenti di sistema checkout: non mostrare in galleria allegati (firma solo nel PDF). */
export function isVisibleJobAttachment(doc: Documento): boolean {
  return !isCheckoutSignatureImage(doc);
}
