import type { Documento } from "../types";

/**
 * Funzione helper per formattare i dati di un documento
 * - Aggiunge icona in base al tipo file
 * - Rende la data leggibile (locale it-IT)
 * - Capitalizza chi ha caricato il documento
 */
export function formatDocumento(doc: Documento) {
  const date = new Date(doc.createdAt).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let icon = "📄"; // default generico
  if (doc.fileName.match(/\.(jpg|jpeg|png|gif)$/i)) icon = "🖼️";
  if (doc.fileName.match(/\.(pdf)$/i)) icon = "📑";
  if (doc.fileName.match(/\.(docx?|odt)$/i)) icon = "📝";
  if (doc.fileName.match(/\.(xlsx?|csv)$/i)) icon = "📊";

  const uploadedBy =
    doc.uploadedBy.charAt(0).toUpperCase() + doc.uploadedBy.slice(1);

  return {
    ...doc,
    icon,
    formattedDate: date,
    uploadedBy,
  };
}

/** Allegato commessa visibile in cantiere salvo esplicito hide (showOnField=false). */
export function isOrderDocumentVisibleOnField(doc: Documento): boolean {
  return doc.showOnField !== false;
}

export function isOrderDocumentHiddenOnField(doc: Documento): boolean {
  return doc.showOnField === false;
}
