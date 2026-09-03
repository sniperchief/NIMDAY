import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedBirthdayBySlug, toPublicBirthday } from "@/lib/birthday";
import { getTheme } from "@/lib/themes";
import { env } from "@/lib/env";
import { giftDeepLink } from "@/lib/nimiq/deepLink";
import { BirthdayCard } from "@/components/BirthdayCard";
import { GiftCta } from "@/components/GiftCta";
import { ShareControls } from "@/components/ShareControls";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublishedBirthdayBySlug(slug);
  if (!b) return { title: "NIMday not found" };

  const pub = toPublicBirthday(b);
  const first = pub.name.split(/\s+/)[0] || pub.name;
  const title = `It's ${pub.name}'s birthday 🎂`;
  const description =
    pub.message?.slice(0, 160) ||
    `${first} made a NIMday with a few wishes. Take a look and help them celebrate.`;
  const url = `${env.appOrigin}/b/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicBirthdayPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ gift?: string }> }) {
  const { slug } = await params;
  const { gift } = await searchParams;
  const b = await getPublishedBirthdayBySlug(slug);
  if (!b) notFound();

  const pub = toPublicBirthday(b);
  const theme = getTheme(pub.theme);
  const url = `${env.appOrigin}/b/${slug}`;
  const deepLink = giftDeepLink(env.appOrigin, slug);

  return (
    <main className={`${theme.page} min-h-dvh px-4 py-10`}>
      <div className="mx-auto w-full max-w-lg animate-fade-up">
        <BirthdayCard
          data={pub}
          action={
            <div className="space-y-5">
              <GiftCta
                deepLinkHttps={deepLink}
                accentClass={theme.accent}
                accentTextClass={theme.accentText}
                autoOpen={gift === "1"}
              />
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-black/45">
                  Know someone who&apos;d want to celebrate too?
                </p>
                <ShareControls url={url} compact />
              </div>
            </div>
          }
        />
        <p className="mt-6 text-center text-xs text-black/40">
          Made with{" "}
          <a href={env.appOrigin} className="font-medium underline">
            NIMday
          </a>
        </p>
      </div>
    </main>
  );
}
