import type { TenantListItem } from "@/api/saasAdmin";

type Badge = {
  key: string;
  label: string;
  className: string;
};

function tenantFeatureBadges(tenant: TenantListItem): Badge[] {
  const badges: Badge[] = [];

  if (tenant.reviewRequestEnabled) {
    badges.push({
      key: "review",
      label: "Recensioni",
      className: "bg-indigo-100 text-indigo-800",
    });
  }
  if (tenant.documentsStorageEnabled) {
    badges.push({
      key: "storage",
      label: "Storage",
      className: "bg-emerald-100 text-emerald-800",
    });
  }
  if (tenant.checkoutDigitalEnabled) {
    badges.push({
      key: "checkout",
      label: "Checkout",
      className: "bg-sky-100 text-sky-800",
    });
  }
  if (tenant.checkoutEmailEnabled) {
    badges.push({
      key: "checkout-email",
      label: "Email checkout",
      className: "bg-cyan-100 text-cyan-900",
    });
  }
  if (tenant.officeWorkflowEnabled) {
    badges.push({
      key: "office",
      label: "Ufficio",
      className: "bg-violet-100 text-violet-800",
    });
  }

  return badges;
}

export function TenantFeatureBadges({ tenant }: { tenant: TenantListItem }) {
  const badges = tenantFeatureBadges(tenant);
  if (badges.length === 0) return null;

  return (
    <>
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`rounded-md px-1.5 py-0.5 font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </>
  );
}

export function tenantFeatureServicesSummary(tenant: TenantListItem): string {
  const parts: string[] = [];

  parts.push(
    tenant.reviewRequestEnabled
      ? "Richiesta recensioni attiva"
      : "Nessuna richiesta recensioni"
  );
  parts.push(
    tenant.documentsStorageEnabled
      ? "Documenti su cloud attivi"
      : "Documenti su cloud non attivi"
  );
  parts.push(
    tenant.checkoutDigitalEnabled
      ? "Checkout digitale attivo"
      : "Checkout digitale non attivo"
  );
  if (tenant.checkoutDigitalEnabled) {
    parts.push(
      tenant.checkoutEmailEnabled
        ? "Email checkout attiva"
        : "Email checkout non attiva"
    );
  }
  parts.push(
    tenant.officeWorkflowEnabled
      ? "Pipeline ufficio commesse attiva"
      : "Pipeline ufficio commesse non attiva"
  );

  return parts.join(" · ");
}
