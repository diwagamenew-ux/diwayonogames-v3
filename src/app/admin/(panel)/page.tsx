import Link from "next/link";
import { getSession } from "@/lib/auth";
import { dashboardStats, listGames, listPosts } from "@/lib/data";
import { formatNumber, formatDate } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await getSession();
  const [stats, topGames, recentPosts] = await Promise.all([
    dashboardStats(),
    listGames({ limit: 5, sort: "downloads", featured: undefined }),
    listPosts({ limit: 5 }),
  ]);

  const cards = [
    { label: "Total Games", value: formatNumber(stats.games), href: "/admin/games" },
    { label: "Blog Posts", value: formatNumber(stats.posts), href: "/admin/posts" },
    { label: "Total Downloads", value: formatNumber(stats.downloads), href: "/admin/games" },
    { label: "Total Views", value: formatNumber(stats.views), href: "/admin/games" },
    { label: "Categories", value: stats.categories, href: "/admin/categories" },
    { label: "Tags", value: stats.tags, href: "/admin/tags" },
    { label: "Pending Reviews", value: stats.pendingReviews, href: "/admin/reviews" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl gold-text tracking-wide">DASHBOARD</h1>
          <p className="text-sm text-mute mt-1">
            Welcome back, <b className="text-gold2">{session?.name}</b> — here’s what’s happening.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/games/new" className="btn-gold px-5 py-2.5 text-sm">+ Add Game</Link>
          <Link href="/admin/posts/new" className="btn-violet px-5 py-2.5 text-sm">+ New Post</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card card-hover p-5 block">
            <p className="font-display text-3xl gold-text">{c.value}</p>
            <p className="text-xs text-mute uppercase tracking-widest mt-1">{c.label}</p>
          </Link>
        ))}
        <div className="card p-5">
          <p className="font-display text-3xl violet-text">SEO</p>
          <p className="text-xs text-mute uppercase tracking-widest mt-1">
            <a href="/sitemap.xml" target="_blank" className="hover:text-accent underline">Sitemap</a>
            {" · "}
            <a href="/rss.xml" target="_blank" className="hover:text-accent underline">RSS</a>
          </p>
        </div>
      </div>

      <div className="card-gold p-5 sm:p-6">
        <h2 className="font-display text-2xl gold-text tracking-wide">MANAGE EVERYTHING</h2>
        <p className="text-xs text-mute mt-1 mb-5">Every part of the site is editable below — add games & posts, rename categories, change the site name & logo, manage Telegram/social links, ads and more.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { href: "/admin/games/new", icon: "🎮", label: "Add New Game", desc: "Upload icon, APK/ZIP, SEO" },
            { href: "/admin/posts/new", icon: "📝", label: "Write a Post", desc: "Blog articles & guides" },
            { href: "/admin/categories", icon: "🗂", label: "Categories", desc: "Add, rename, delete" },
            { href: "/admin/tags", icon: "🏷", label: "Tags", desc: "Manage tag pages" },
            { href: "/admin/pages", icon: "📄", label: "Pages", desc: "Privacy, DMCA, Terms…" },
            { href: "/admin/settings", icon: "⚙️", label: "Site Name & Logo", desc: "General settings tab" },
            { href: "/admin/settings", icon: "🔗", label: "Header / Footer Links", desc: "Links Manager tab" },
            { href: "/admin/settings", icon: "✈️", label: "Telegram & Social", desc: "Social Links tab" },
            { href: "/admin/settings", icon: "📢", label: "Ads Manager", desc: "AdSense, banners, popup" },
            { href: "/admin/reviews", icon: "⭐", label: "Reviews", desc: "Approve user ratings" },
            { href: "/admin/redirects", icon: "↪️", label: "Redirects & 404", desc: "Fix broken URLs" },
            { href: "/admin/users", icon: "👥", label: "Users & Roles", desc: "Admins, editors, authors" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="card card-hover p-4 block group">
              <p className="text-xl">{item.icon}</p>
              <p className="font-semibold text-sm mt-2 group-hover:text-gold2 transition-colors">{item.label}</p>
              <p className="text-[0.65rem] text-mute mt-0.5">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="section-title text-lg mb-4">Top Downloaded Games</h2>
          <div className="space-y-3">
            {topGames.map((g, i) => (
              <div key={g.id} className="flex items-center gap-3">
                <span className="font-display text-xl gold-text w-6">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.icon || "/images/logo.png"} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-cover gold-frame" />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/games/${g.id}`} className="text-sm font-semibold hover:text-gold2 line-clamp-1">
                    {g.title}
                  </Link>
                  <p className="text-[0.68rem] text-mute">
                    {formatNumber(g.downloads)} downloads · {formatNumber(g.views)} views · ★ {g.rating.toFixed(1)}
                  </p>
                </div>
                <Link href={`/game/${g.slug}`} target="_blank" className="btn-ghost px-2.5 py-1.5 text-xs">View</Link>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="section-title text-lg mb-4">Recent Posts</h2>
          <div className="space-y-3">
            {recentPosts.length === 0 && <p className="text-sm text-mute">No posts yet.</p>}
            {recentPosts.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/posts/${p.id}`} className="text-sm font-semibold hover:text-gold2 line-clamp-1">
                    {p.title}
                  </Link>
                  <p className="text-[0.68rem] text-mute">
                    {formatDate(p.publishedAt)} · {p.views} views · by {p.authorName || "—"}
                  </p>
                </div>
                <Link href={`/blog/${p.slug}`} target="_blank" className="btn-ghost px-2.5 py-1.5 text-xs">View</Link>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-line text-xs text-mute space-y-1.5">
            <p>Quick tips to rank faster:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Keep meta titles under 60 chars and include your focus keyword.</li>
              <li>Add FAQs to games — they power rich snippets.</li>
              <li>Submit new URLs via Settings → Advanced → IndexNow.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
