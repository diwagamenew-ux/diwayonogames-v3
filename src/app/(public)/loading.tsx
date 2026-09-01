// Next.js swaps this in immediately on navigation to any page in this
// route group while that page's async Server Component work is still
// resolving. `/games`, `/blog`, `/search`, and `/category/[slug]` all read
// `searchParams`, which makes them dynamic (no static/ISR cache to serve
// instantly) — without this file, clicking a filter or paginating showed a
// blank tab for however long the DB query took. This card-grid skeleton
// keeps the layout stable (no shift when real content arrives) and makes
// every click feel instant even on a slower connection to the database.
function CardSkeleton() {
  return (
    <div className="card p-3 sm:p-3.5 flex flex-col gap-3 overflow-hidden">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="w-14 h-14 min-[480px]:w-[72px] min-[480px]:h-[72px] rounded-2xl bg-panel2 animate-pulse shrink-0" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-4/5 rounded bg-panel2 animate-pulse" />
          <div className="h-3 w-2/5 rounded bg-panel2 animate-pulse" />
        </div>
      </div>
      <div className="h-3 w-full rounded bg-panel2 animate-pulse" />
      <div className="h-8 w-full rounded-xl bg-panel2 animate-pulse" />
    </div>
  );
}

export default function PublicLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10" aria-hidden="true">
      <div className="h-8 w-48 rounded bg-panel2 animate-pulse mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
