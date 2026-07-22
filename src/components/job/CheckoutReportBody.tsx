import type { ParsedCheckoutReport } from "@/utils/checkoutReport";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,34%)_1fr] gap-x-3 gap-y-0.5 text-sm">
      <span className="font-medium text-slate-600">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

export function CheckoutReportBody({ report }: { report: ParsedCheckoutReport }) {
  if (report.legacyBody && !report.datetime && !report.outcome) {
    return (
      <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-sm">
        {report.legacyBody}
      </pre>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-slate-200/90 bg-slate-50/80 p-4 text-sm">
      <div className="space-y-2">
        {report.datetime && <Row label="Data e ora" value={report.datetime} />}
        {report.outcome && <Row label="Esito" value={report.outcome} />}
        <Row label="Tecnici in cantiere" value={report.team ?? "—"} />
        {report.review && <Row label="Recensione" value={report.review} />}
      </div>

      <div>
        <h4 className="mb-2 font-semibold text-slate-800">Pagamenti</h4>
        {report.payments.length === 0 ? (
          <p className="text-slate-600">Nessun pagamento registrato</p>
        ) : (
          <ul className="space-y-1.5 text-slate-800">
            {report.payments.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-slate-400" aria-hidden>
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {report.jobNotes && (
        <div>
          <h4 className="mb-1 font-semibold text-slate-800">Note sull&apos;intervento</h4>
          <p className="whitespace-pre-wrap text-slate-700">{report.jobNotes}</p>
        </div>
      )}

      {report.finalNotes && (
        <div>
          <h4 className="mb-1 font-semibold text-slate-800">Note di chiusura</h4>
          <p className="whitespace-pre-wrap text-slate-700">{report.finalNotes}</p>
        </div>
      )}
    </div>
  );
}
