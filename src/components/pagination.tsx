import Link from "next/link";

export function Pagination({ page, totalPages, basePath, query = {} }: {
  page: number; totalPages: number; basePath: string; query?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;
  const build = (p: number) => {
    const params = new URLSearchParams({ ...query, ...(p > 1 ? { page: String(p) } : {}) });
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = start; p <= Math.min(totalPages, start + 4); p++) pages.push(p);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-10">
      {page > 1 && (
        <Link href={build(page - 1)} rel="prev" className="btn-ghost px-3.5 py-2 text-sm">
          ← Prev
        </Link>
      )}
      {start > 1 && <span className="text-mute text-sm px-1">…</span>}
      {pages.map((p) => (
        <Link
          key={p}
          href={build(p)}
          aria-current={p === page ? "page" : undefined}
          className={`px-3.5 py-2 text-sm rounded-lg border transition-colors ${
            p === page
              ? "btn-gold border-transparent font-bold"
              : "btn-ghost"
          }`}
        >
          {p}
        </Link>
      ))}
      {pages[pages.length - 1] < totalPages && <span className="text-mute text-sm px-1">…</span>}
      {page < totalPages && (
        <Link href={build(page + 1)} rel="next" className="btn-ghost px-3.5 py-2 text-sm">
          Next →
        </Link>
      )}
    </nav>
  );
}
