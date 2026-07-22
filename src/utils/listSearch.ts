import type { Customer, Job, JobOrder, Worker } from "@/types";

function includesQ(value: string | null | undefined, ql: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(ql);
}

export function orderLocationTexts(
  order?: Pick<JobOrder, "location" | "site_address" | "address"> | null
): string[] {
  if (!order) return [];
  const loc = order.location;
  return [
    loc?.address,
    loc?.mapsUrl,
    order.site_address,
    order.address,
  ].filter((v): v is string => Boolean(v));
}

export function customerSearchTexts(
  customer?: Customer | null
): string[] {
  if (!customer) return [];
  return [
    customer.name,
    customer.phone,
    customer.email,
    customer.address,
    customer.street,
    customer.city,
    customer.province,
    customer.cap,
    customer.postal_code,
    customer.notes,
  ].filter((v): v is string => Boolean(v));
}

export function jobWorkerSearchTexts(
  job: Job,
  workers?: Pick<Worker, "id" | "name">[]
): string[] {
  const names = new Set<string>();
  for (const member of job.team ?? []) {
    if (member.name) names.add(member.name);
  }
  if (workers?.length && job.assignedWorkers?.length) {
    const byId = new Map(workers.map((w) => [w.id, w.name]));
    for (const workerId of job.assignedWorkers) {
      const name = byId.get(workerId);
      if (name) names.add(name);
    }
  }
  return [...names];
}

/** Ricerca unificata lavori (dashboard / elenchi client-side). */
export function jobMatchesListSearch(
  job: Job,
  order: JobOrder | undefined,
  customer: Customer | undefined,
  ql: string,
  workers?: Pick<Worker, "id" | "name">[]
): boolean {
  if (!ql) return true;
  const fields = [
    job.id,
    job.title,
    job.notes,
    job.notesBackoffice,
    job.location?.address,
    job.location?.mapsUrl,
    order?.code,
    order?.notes,
    order?.notesBackoffice,
    ...orderLocationTexts(order),
    ...customerSearchTexts(customer),
    ...jobWorkerSearchTexts(job, workers),
  ];
  return fields.some((f) => includesQ(f, ql));
}
