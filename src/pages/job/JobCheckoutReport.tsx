import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import type { Job, Documento, JobEvent, JobOrder } from "@/types";
import { formatDateTime, parseDate } from "@/utils/date";
import { resolveDocumentUrl } from "@/api/documentAPI";
import { CheckoutReportBody } from "@/components/job/CheckoutReportBody";
import {
  buildCheckoutReportPrintDocument,
  parseCheckoutReport,
} from "@/utils/checkoutReport";
import { printHtmlDocument } from "@/lib/printHtml";
import { toast } from "react-hot-toast";
import { useState } from "react";
import { documentsForCheckoutSession } from "@/lib/checkoutSession";
import {
  isCheckoutModuloPdf,
  isCheckoutSignatureImage,
} from "@/lib/checkoutDocuments";
import { parseCheckoutFormFromReport } from "@/utils/checkoutFormReport";

export default function JobCheckoutReport({
  job,
  docs,
  order,
}: {
  job: Job;
  docs: Documento[];
  order: JobOrder;
}) {
  const [printingEventId, setPrintingEventId] = useState<string | null>(null);

  const checkoutEvents: JobEvent[] = (job.events || [])
    .filter(
      (ev) =>
        ev.type === "check_out_completato" ||
        ev.type === "check_out_da_completare"
    )
    .sort(
      (a, b) =>
        parseDate(b.date || b.createdAt || "").getTime() -
        parseDate(a.date || a.createdAt || "").getTime()
    );

  if (checkoutEvents.length === 0) return null;

  return (
    <div className="space-y-6">
      {checkoutEvents.map((ev, idx) => {
        const checkoutIndex = checkoutEvents.length - idx;

        const checkoutDocs = documentsForCheckoutSession(docs, checkoutIndex);
        const moduloPdf = checkoutDocs.find(isCheckoutModuloPdf);
        const checkoutPhotos = checkoutDocs.filter(
          (d) => !isCheckoutModuloPdf(d) && !isCheckoutSignatureImage(d)
        );
        const formData = parseCheckoutFormFromReport(ev.notes);

        // Data evento → da campo `date` se presente, altrimenti fallback su createdAt
        const eventDate = ev.date || ev.createdAt || null;
        const formattedDate = eventDate ? formatDateTime(eventDate) : "-";
        const parsedReport = parseCheckoutReport(ev.notes);
        const performedBy = parsedReport.performer;

        return (
          <Card key={ev.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">
                📋 Checkout del {formattedDate}
              </CardTitle>
              {performedBy && (
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">Checkout effettuato da:</span>{" "}
                  <span className="font-semibold text-slate-900">{performedBy}</span>
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <CheckoutReportBody report={parsedReport} />

              {formData && (
                <p className="text-xs text-slate-600 rounded-lg bg-slate-50 p-2">
                  Modulo digitale: controllo serramenti registrato; firma cliente{" "}
                  {formData.clienteSignerName || "—"}.
                </p>
              )}

              {moduloPdf && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                  <h3 className="font-medium mb-2 text-sm text-violet-900">
                    📄 Modulo fine lavori firmato (PDF)
                  </h3>
                  <a
                    href={resolveDocumentUrl(moduloPdf.fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-violet-800 hover:underline"
                  >
                    Scarica / apri PDF
                  </a>
                </div>
              )}

              {/* Allegati fine lavoro (foto, non il PDF modulo) */}
              {checkoutPhotos.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2 text-sm md:text-base">
                    📎 Allegati fine lavoro
                  </h3>
                  <ul className="text-sm space-y-2">
                    {checkoutPhotos.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                      >
                        <a
                          href={resolveDocumentUrl(d.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:underline break-all"
                        >
                          {d.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bottone stampa */}
              <div className="flex flex-col sm:flex-row justify-end pt-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={printingEventId === ev.id}
                  onClick={async () => {
                    setPrintingEventId(ev.id);
                    try {
                      const html = buildCheckoutReportPrintDocument(parsedReport, {
                        customerName: job.customer?.name ?? "—",
                        orderCode: order.code,
                        performedBy,
                      });
                      await printHtmlDocument(
                        html,
                        `Checkout ${order.code}`
                      );
                    } catch (err) {
                      console.error("Stampa checkout:", err);
                      toast.error(
                        "Impossibile avviare la stampa. Riprova o scarica il PDF del modulo."
                      );
                    } finally {
                      setPrintingEventId(null);
                    }
                  }}
                  className="w-full font-semibold sm:w-auto"
                >
                  {printingEventId === ev.id ? "Apertura stampa…" : "🖨️ Stampa"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
