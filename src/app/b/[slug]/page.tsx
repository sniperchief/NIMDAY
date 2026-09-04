import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedBirthdayBySlug, toPublicBirthday } from "@/lib/birthday";
import { getTheme } from "@/lib/themes";
import { env } from "@/lib/env";
import { publicBirthdayUrl } from "@/lib/share";
import { countMessages, listMessages } from "@/lib/messages/store";
import { PublicBirthdayView } from "@/components/public/PublicBirthdayView";

type Params = { params: Promise<{ slug: string }> };
type Search = { searchParams: Promise<{ gift?: string; intent?: string }> };

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
  const url = publicBirthdayUrl(env.appOrigin, slug);

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
}: Params & Search) {
  const { slug } = await params;
  const { gift, intent } = await searchParams;
  const b = await getPublishedBirthdayBySlug(slug);
  if (!b) notFound();

  const pub = toPublicBirthday(b);
  const theme = getTheme(pub.theme);
  const url = publicBirthdayUrl(env.appOrigin, b.slug);

  // Messages are server-rendered so the card arrives complete — the feed is
  // part of the page, not something that pops in afterwards.
  const [messages, messageCount] = await Promise.all([
    listMessages(b.id),
    countMessages(b.id),
  ]);

  return (
    <main className={`${theme.page} min-h-dvh px-4 py-6 sm:py-10`}>
      <PublicBirthdayView
        pub={pub}
        url={url}
        origin={env.appOrigin}
        giftParam={gift ?? null}
        intentParam={intent ?? null}
        initialMessages={messages}
        initialMessageCount={messageCount}
        testnet={env.isTestnet()}
      />
    </main>
  );
}
