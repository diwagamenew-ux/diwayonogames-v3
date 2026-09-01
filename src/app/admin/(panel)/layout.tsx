import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminErrorBoundary } from "@/components/admin/error-boundary";

export const dynamic = "force-dynamic";

// Belt-and-braces on top of the /admin disallow rule in robots.ts: even if
// an admin URL is ever linked from somewhere and crawled, this tells
// Google not to index it.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // If the session lookup itself throws (DB unreachable, etc.) don't 500 the
  // whole admin — send the user to login with a clean redirect.
  let session;
  try {
    session = await getSession();
  } catch {
    redirect("/admin/login?error=session");
  }
  if (!session) redirect("/admin/login");

  // Settings drive the sidebar logo + brand name so a change in
  // Admin → Settings → General shows up in the panel chrome too.
  let settings;
  try {
    settings = await getSettings();
  } catch {
    settings = null;
  }

  return (
    <div className="flex min-h-screen bg-base">
      <div className="hidden md:block w-60 shrink-0 fixed inset-y-0 left-0 z-30">
        <AdminSidebar user={session} settings={settings} />
      </div>
      <div className="flex-1 md:ml-60 min-w-0">
        <div className="md:hidden sticky top-0 z-30 bg-base/95 backdrop-blur border-b border-line p-3">
          <MobileNav user={session} settings={settings} />
        </div>
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl">
          <AdminErrorBoundary>{children}</AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function MobileNav({
  user,
  settings,
}: {
  user: import("@/lib/auth").SessionUser;
  settings: import("@/lib/settings").SiteSettings | null;
}) {
  return (
    <details className="group relative">
      <summary className="flex items-center justify-between cursor-pointer list-none font-display text-xl gold-text">
        ADMIN PANEL{" "}
        <span className="text-mute text-sm group-open:rotate-90 transition-transform">▶</span>
      </summary>
      <div className="absolute left-0 right-0 top-full mt-1 h-[72vh] overflow-y-auto shadow-2xl rounded-b-2xl border border-line bg-panel z-40">
        <AdminSidebar user={user} settings={settings} />
      </div>
    </details>
  );
}
