"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { can, type SessionUser } from "@/lib/roles";

const NAV: { group: string; items: { href: string; label: string; perm?: string }[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
  {
    group: "Content",
    items: [
      { href: "/admin/games", label: "Games", perm: "games" },
      { href: "/admin/posts", label: "Blog Posts", perm: "posts" },
      { href: "/admin/categories", label: "Categories", perm: "categories" },
      { href: "/admin/tags", label: "Tags", perm: "tags" },
      { href: "/admin/pages", label: "Pages", perm: "pages" },
    ],
  },
  {
    group: "Engagement",
    items: [
      { href: "/admin/reviews", label: "Reviews", perm: "reviews" },
      { href: "/admin/inbox", label: "Inbox", perm: "inbox" },
    ],
  },
  {
    group: "SEO",
    items: [{ href: "/admin/redirects", label: "Redirects & 404", perm: "redirects" }],
  },
  {
    group: "System",
    items: [
      { href: "/admin/users", label: "Users", perm: "*" },
      { href: "/admin/audit-log", label: "Audit Log", perm: "*" },
      { href: "/admin/settings", label: "Settings", perm: "*" },
    ],
  },
];

export function AdminSidebar({
  user,
  settings,
}: {
  user: SessionUser;
  settings?: { logoUrl?: string; siteName?: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  };

  const logo = settings?.logoUrl || "/images/logo.png";
  const brand = (settings?.siteName || "APKVAULT").toUpperCase().slice(0, 14);

  return (
    <aside className="w-full h-full flex flex-col bg-panel border-r border-line">
      <div className="p-4 border-b border-line flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          width={36}
          height={36}
          className="w-9 h-9 rounded-lg object-cover gold-frame bg-panel2"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/images/logo.png";
          }}
        />
        <div className="min-w-0">
          <p className="font-display text-lg gold-text leading-none truncate">{brand}</p>
          <p className="text-[0.6rem] text-mute uppercase tracking-widest mt-0.5">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(user.role, i.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="px-3 text-[0.62rem] uppercase tracking-[0.18em] text-mute mb-1.5">{g.group}</p>
              <div className="space-y-0.5">
                {items.map((i) => {
                  const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-gradient-to-r from-primary/25 to-transparent text-gold2 border-l-2 border-accent"
                          : "text-mute hover:bg-panel2 hover:text-ink"
                      }`}
                    >
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-line space-y-1">
        <Link href="/" className="block px-3 py-2 rounded-lg text-sm text-mute hover:bg-panel2 hover:text-ink transition-colors">
          ↩ View Website
        </Link>
        <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
          ⏻ Logout ({user.name})
        </button>
      </div>
    </aside>
  );
}
