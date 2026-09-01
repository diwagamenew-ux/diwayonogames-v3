import { IconStar } from "./icons";

export function Stars({ rating, size = "w-4 h-4", showValue = true, className = "" }: {
  rating: number; size?: string; showValue?: boolean; className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const row = (filled: boolean) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar key={i} className={`${size} ${filled ? "text-accent" : "text-line"}`} />
      ))}
    </div>
  );
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-block">
        {row(false)}
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
          {row(true)}
        </span>
      </span>
      {showValue && <span className="text-xs font-semibold text-mute">{rating.toFixed(1)}</span>}
    </span>
  );
}
