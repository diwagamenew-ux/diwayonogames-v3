import Link from "next/link";
import { SafeImage } from "./safe-image";
import { Stars } from "./stars";
import { IconDownload } from "./icons";
import { formatNumber, displayRating } from "@/lib/util";
import { BLUR_DATA_URL, SIZES_CARD, SIZES_ROW } from "@/lib/blur";

export type CardGame = {
  title: string; slug: string; icon: string; rating: number; ratingCount: number;
  downloads: number; version: string; size: string; bonus: string;
  categoryName?: string | null; shortDesc?: string; editorialRating?: number | null;
};

export function GameCard({ game }: { game: CardGame }) {
  const r = displayRating(game);
  return (
    <Link
      href={`/game/${game.slug}`}
      className="card card-hover group p-3 sm:p-3.5 flex flex-col gap-3 overflow-hidden"
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <SafeImage
          src={game.icon || "/images/logo.png"}
          alt={`${game.title} APK icon`}
          title={game.title}
          loading="lazy"
          width={72}
          height={72}
          sizes={SIZES_ROW}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="w-14 h-14 min-[480px]:w-[72px] min-[480px]:h-[72px] rounded-2xl object-cover gold-frame shrink-0 group-hover:scale-105 transition-transform"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-[0.95rem] leading-snug line-clamp-2 group-hover:text-gold2 transition-colors">
            {game.title}
          </h3>
          {game.bonus ? (
            <p className="text-[0.65rem] font-semibold tracking-widest uppercase text-accent mt-1 line-clamp-1">
              {game.bonus}
            </p>
          ) : null}
          <p className="text-[0.68rem] text-mute mt-0.5 line-clamp-1">
            {game.categoryName || "Game"} · v{game.version}{game.size ? ` · ${game.size}` : ""}
          </p>
        </div>
      </div>
      <div className="text-xs text-mute">Game information available on the details page</div>
      <span className="btn-gold w-full py-2 min-[480px]:py-2.5 px-2 text-[0.72rem] min-[480px]:text-sm inline-flex items-center justify-center gap-1.5 min-[480px]:gap-2 whitespace-nowrap">
        <IconDownload className="w-3.5 h-3.5 min-[480px]:w-4 min-[480px]:h-4 shrink-0" />
        Download<span className="hidden min-[560px]:inline">&nbsp;APK</span>
      </span>
    </Link>
  );
}

export function GameRow({ game, rank }: { game: CardGame; rank?: number }) {
  const r = displayRating(game);
  return (
    <Link
      href={`/game/${game.slug}`}
      className="card card-hover p-3 flex items-center gap-3 group"
    >
      {rank !== undefined && (
        <span className="font-display text-2xl w-7 text-center gold-text shrink-0">{rank}</span>
      )}
      <SafeImage
        src={game.icon || "/images/logo.png"}
        alt={`${game.title} icon`}
        loading="lazy"
        width={56}
        height={56}
        sizes={SIZES_ROW}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="w-14 h-14 rounded-xl object-cover gold-frame shrink-0"
      />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-gold2 transition-colors">
          {game.title}
        </h3>
        <p className="text-[0.68rem] text-mute mt-0.5 line-clamp-1">
          {game.categoryName || "Game"} · v{game.version}
        </p>
      </div>
      <span className="btn-ghost p-2.5 text-accent shrink-0" aria-label={`Download ${game.title}`}>
        <IconDownload className="w-4 h-4" />
      </span>
    </Link>
  );
}
