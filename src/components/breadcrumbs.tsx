import Link from "next/link";
import { IconChevron } from "./icons";

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-mute">
      <Link href="/" className="hover:text-accent transition-colors font-medium">Home</Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <IconChevron className="w-3 h-3 text-line" />
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-accent transition-colors font-medium">
              {item.name}
            </Link>
          ) : (
            <span className="text-ink/80 font-medium line-clamp-1 max-w-[220px] sm:max-w-none">{item.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
