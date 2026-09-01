import type { SiteSettings } from "@/lib/settings";
import {
  IconSend, IconWhatsapp, IconDiscord, IconFacebook, IconInstagram,
  IconX, IconYoutube, IconMail, IconGlobe,
} from "./icons";

export function SocialIcons({ social, size = "w-4 h-4", className = "" }: {
  social: SiteSettings["social"]; size?: string; className?: string;
}) {
  const items = [
    { key: "telegram", href: social.telegram, Icon: IconSend, label: "Telegram" },
    { key: "whatsapp", href: social.whatsapp, Icon: IconWhatsapp, label: "WhatsApp" },
    { key: "discord", href: social.discord, Icon: IconDiscord, label: "Discord" },
    { key: "facebook", href: social.facebook, Icon: IconFacebook, label: "Facebook" },
    { key: "instagram", href: social.instagram, Icon: IconInstagram, label: "Instagram" },
    { key: "twitter", href: social.twitter, Icon: IconX, label: "X (Twitter)" },
    { key: "youtube", href: social.youtube, Icon: IconYoutube, label: "YouTube" },
    { key: "email", href: social.email ? `mailto:${social.email}` : "", Icon: IconMail, label: "Email" },
    { key: "website", href: social.website, Icon: IconGlobe, label: "Website" },
  ].filter((i) => i.href);
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {items.map(({ key, href, Icon, label }) => (
        <a
          key={key}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`btn-ghost p-2.5 text-mute transition-colors ${
            key === "telegram" ? "hover:!text-[#229ed9] hover:!border-[#229ed9]/50" : "hover:text-accent"
          }`}
        >
          <Icon className={`${size} ${key === "telegram" ? "text-[#229ed9]" : ""}`} />
        </a>
      ))}
    </div>
  );
}

export function TelegramButton({ url, label = "JOIN TELEGRAM NOW", className = "" }: {
  url: string; label?: string; className?: string;
}) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn-telegram inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-sm font-extrabold tracking-widest uppercase animate-glow ${className}`}
    >
      <IconSend className="w-5 h-5" />
      {label}
    </a>
  );
}
