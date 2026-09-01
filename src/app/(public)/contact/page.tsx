import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CaptchaForm } from "@/components/captcha-form";
import { SocialIcons } from "@/components/social-links";
import { IconMail, IconSend } from "@/components/icons";

export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Contact Us",
    description: "Get in touch with our team for support, DMCA requests, partnerships or app submissions.",
    path: "/contact",
  });
}

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Breadcrumbs items={[{ name: "Contact Us" }]} />
      <h1 className="font-display text-4xl sm:text-5xl tracking-wide mt-5">
        <span className="gold-text">CONTACT US</span>
      </h1>
      <p className="text-mute mt-3 max-w-xl text-sm leading-relaxed">
        Questions, DMCA requests, broken links, app submissions or business inquiries —
        send us a message and we usually reply within 24–48 hours.
      </p>

      <div className="grid md:grid-cols-[1fr_260px] gap-6 mt-8">
        <CaptchaForm kind="contact" />
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="section-title text-lg mb-3">Direct</h2>
            {s.social.email && (
              <a href={`mailto:${s.social.email}`} className="flex items-center gap-2.5 text-sm text-mute hover:text-accent transition-colors">
                <IconMail className="w-4 h-4 text-accent" /> {s.social.email}
              </a>
            )}
            {s.social.telegram && (
              <a href={s.social.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-mute hover:!text-[#229ed9] transition-colors mt-3">
                <IconSend className="w-4 h-4 text-[#229ed9]" /> Telegram channel
              </a>
            )}
          </div>
          <div className="card p-5">
            <h2 className="section-title text-lg mb-3">Follow Us</h2>
            <SocialIcons social={s.social} />
          </div>
        </div>
      </div>
    </div>
  );
}
