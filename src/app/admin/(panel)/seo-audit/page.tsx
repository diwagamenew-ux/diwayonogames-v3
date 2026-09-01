"use client";
import { useEffect, useState } from "react";

type Item = { type:string; id:number; title:string; path:string; score:number; issues:string[] };
type Technical = { siteUrl:string; sitemapUrl:string; robotsUrl:string; sitemapConfigured:boolean; indexableGames:number; indexablePosts:number; indexableCategories:number; indexablePages:number; brokenInternalLinks:{source:string;href:string}[] };
export default function SeoAuditPage() {
  const [items,setItems]=useState<Item[]>([]); const [summary,setSummary]=useState<any>(null); const [technical,setTechnical]=useState<Technical|null>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/admin/seo-audit").then(r=>r.json()).then(d=>{setItems(d.items||[]);setSummary(d.summary||null);setTechnical(d.technical||null);}).finally(()=>setLoading(false));},[]);
  return <div className="space-y-6">
    <div><h1 className="font-display text-4xl gold-text tracking-wide">SEO AUDIT</h1><p className="text-sm text-mute mt-1">Find missing metadata, thin content and indexing risks before publishing at scale.</p></div>
    {summary && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Pages",summary.total],["Average",summary.average+"/100"],["Needs work",summary.needsWork],["Noindex",summary.noindex]].map(([a,b])=><div className="card p-4" key={String(a)}><div className="text-xs text-mute uppercase">{a}</div><div className="text-2xl font-semibold mt-1">{b}</div></div>)}</div>}
    {technical && <div className="card p-5 space-y-4">
      <div><h2 className="font-semibold">Technical SEO & Sitemap</h2><p className="text-xs text-mute mt-1">Code-level checks for sitemap/robots configuration and broken internal editable links. This does not read Google Search Console's private error report.</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div><span className="text-mute">Sitemap</span><div className="text-emerald-400 font-semibold mt-1">{technical.sitemapConfigured ? "Configured" : "Check site URL"}</div></div>
        <div><span className="text-mute">Indexable games</span><div className="font-semibold mt-1">{technical.indexableGames}</div></div>
        <div><span className="text-mute">Indexable posts</span><div className="font-semibold mt-1">{technical.indexablePosts}</div></div>
        <div><span className="text-mute">Broken internal links</span><div className={technical.brokenInternalLinks.length ? "text-rose-400 font-semibold mt-1" : "text-emerald-400 font-semibold mt-1"}>{technical.brokenInternalLinks.length}</div></div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <a href="/sitemap.xml" target="_blank" className="text-accent underline">Open sitemap.xml</a>
        <a href="/robots.txt" target="_blank" className="text-accent underline">Open robots.txt</a>
      </div>
      {technical.brokenInternalLinks.length > 0 && <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300 space-y-1">{technical.brokenInternalLinks.slice(0, 20).map((x,i)=><div key={i}><b>{x.source}</b> → {x.href}</div>)}</div>}
    </div>}
    <div className="card overflow-x-auto"><table className="admin-table w-full min-w-[760px]"><thead><tr><th>Type</th><th>Page</th><th>Score</th><th>Issues</th><th>URL</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={5} className="py-8 text-center text-mute">Running audit…</td></tr> : items.map(i=><tr key={`${i.type}-${i.id}`}><td className="capitalize">{i.type}</td><td className="font-medium">{i.title}</td><td><span className={i.score>=85?"text-emerald-400":i.score>=60?"text-amber-400":"text-rose-400"}>{i.score}/100</span></td><td className="text-xs text-mute max-w-md">{i.issues.length?i.issues.join(" • "):"No obvious issues"}</td><td className="font-mono text-xs text-mute">{i.path}</td></tr>)}
      {!loading && !items.length && <tr><td colSpan={5} className="py-8 text-center text-mute">No indexable content found.</td></tr>}
    </tbody></table></div>
  </div>;
}
