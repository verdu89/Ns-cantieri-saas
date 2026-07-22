import type { Payment } from "@/types";

export function groupPaymentsByJobId(
  payments: Payment[]
): Map<string, Payment[]> {
  const map = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = map.get(p.jobId);
    if (list) list.push(p);
    else map.set(p.jobId, [p]);
  }
  return map;
}

export function attachPaymentsToJobs(
  jobs: Array<{ id: string; payments?: Payment[] }>,
  byJobId: Map<string, Payment[]>
): void {
  for (const job of jobs) {
    job.payments = byJobId.get(job.id) ?? [];
  }
}
