import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CaptchaForm } from "@/components/captcha-form";
import { IconCrown } from "@/components/icons";

export const dynamic = "force-static";
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Request a Game",
    description: "Can't find the APK you're looking for? Request any Android game or app and our team will upload it within 24–48 hours.",
    path: "/request",
  });
}

export default function RequestPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Breadcrumbs items={[{ name: "Request a Game" }]} />
      <div className="text-center mt-6 mb-8">
        <div className="w-14 h-14 mx-auto rounded-2xl btn-gold flex items-center justify-center animate-glow">
          <IconCrown className="w-7 h-7" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide mt-5">
          <span className="gold-text">REQUEST A GAME</span>
        </h1>
        <p className="text-mute mt-3 text-sm max-w-md mx-auto leading-relaxed">
          Can’t find the APK you’re looking for? Tell us the game or app name and our team
          will hunt it down and publish it — usually within 24–48 hours.
        </p>
      </div>
      <CaptchaForm kind="request" />
    </div>
  );
}
