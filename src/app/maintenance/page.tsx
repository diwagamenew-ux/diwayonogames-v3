import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { MaintenanceScreen } from "@/components/maintenance";

// Standalone maintenance page (outside the (public) route group, so it has
// no chrome and no chance of being caught in a rewrite loop). Middleware
// rewrites public traffic here when the maintenance flag is on.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: `Maintenance — ${s.siteName}`,
    robots: { index: false, follow: false },
  };
}

export default async function MaintenancePage() {
  const s = await getSettings();
  return <MaintenanceScreen message={s.features.maintenanceMessage} siteName={s.siteName} />;
}
