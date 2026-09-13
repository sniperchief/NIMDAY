import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { Wordmark } from "@/components/brand/Wordmark";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getCreatorDashboard } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "My nimDay",
  robots: { index: false },
};

/**
 * The creator's dashboard. Authorization happens here, on the server: the
 * dashboard is only ever built from the session user's own birthday, so there
 * is no id in the URL to tamper with.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  const dashboard = user ? await getCreatorDashboard(user.id) : null;

  return (
    <main className="min-h-dvh bg-white px-4 py-8 sm:py-12">
      <div className="mx-auto mb-6 max-w-xl">
        <Link
          href="/"
          aria-label="nimDay home"
          className="-ml-1 inline-flex min-h-[44px] items-center rounded-lg px-1 text-ink"
        >
          <Wordmark className="h-6 w-auto" />
        </Link>
      </div>

      {!user ? (
        <Card className="mx-auto max-w-xl text-center">
          <p className="text-3xl">🔒</p>
          <h1 className="mt-3 font-display text-2xl text-ink">
            Sign in to see your nimDay
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
            Connect the Nimiq wallet you created your nimDay with — that&apos;s how
            we know it&apos;s yours.
          </p>
          <Link href="/create" className="mt-5 inline-block">
            <Button size="lg">Connect wallet</Button>
          </Link>
        </Card>
      ) : !dashboard ? (
        <Card className="mx-auto max-w-xl text-center">
          <p className="text-3xl">🎂</p>
          <h1 className="mt-3 font-display text-2xl text-ink">
            You haven&apos;t made a nimDay yet
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
            A card, a few wishes, one link. It takes about a minute.
          </p>
          <Link href="/create" className="mt-5 inline-block">
            <Button size="lg">Create your nimDay</Button>
          </Link>
        </Card>
      ) : (
        <DashboardView data={dashboard} />
      )}
    </main>
  );
}
