"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, cn } from "@/components/ui";
import { BirthdayCard } from "@/components/BirthdayCard";
import { WishList } from "@/components/WishList";
import { ShareSection } from "@/components/ShareControls";
import {
  ApiError,
  addWish,
  createBirthday,
  deleteWish,
  getMe,
  getMyBirthday,
  publishBirthday,
  updateBirthday,
  updateWish,
  type EditorBirthday,
} from "@/lib/apiClient";
import type { WishInput } from "@/lib/validation";
import { prettyUrl } from "@/lib/share";
import { DetailsStep } from "./DetailsStep";
import { WishesStep } from "./WishesStep";
import { ConnectStep } from "./ConnectStep";
import { useDraft, draftFromEditor } from "./useDraft";
import type { DraftWish } from "./types";

type Step = "details" | "wishes" | "connect" | "preview" | "done";
const ORDER: Step[] = ["details", "wishes", "connect", "preview"];
const LABELS: Record<Step, string> = {
  details: "Details",
  wishes: "Wishes",
  connect: "Connect",
  preview: "Preview",
  done: "Done",
};

function toWishInput(w: DraftWish): WishInput {
  return {
    title: w.title.trim(),
    description: w.description.trim() || undefined,
    imageUrl: w.imageUrl || undefined,
    targetAmount: Number(w.targetAmount),
    currency: "NIM",
    giftType: w.giftType,
  };
}

export function CreateWizard() {
  const { draft, setDraft, patch, clear } = useDraft();
  const [step, setStep] = useState<Step>("details");
  const [authedAddress, setAuthedAddress] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<EditorBirthday | null>(null);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [me, existing] = await Promise.all([getMe(), getMyBirthday()]);
        if (me) setAuthedAddress(me.user.walletAddress);
        if (existing) {
          setBirthday(existing);
          setDraft(draftFromEditor(existing));
          if (existing.published && me) {
            setPublishUrl(`${window.location.origin}/b/${existing.slug}`);
          }
        }
      } catch {
        // Nothing to restore (not signed in, or the API is unreachable) —
        // fall through to an empty draft rather than blocking the whole page.
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewData = useMemo(
    () => ({
      name: draft.name,
      birthday: draft.birthday || new Date().toISOString().slice(0, 10),
      message: draft.message || null,
      theme: draft.theme,
      imageUrl: draft.imageUrl || null,
    }),
    [draft],
  );

  const previewWishes = useMemo(
    () =>
      draft.wishes.map((w) => ({
        id: w.key,
        title: w.title || "Untitled wish",
        description: w.description || null,
        imageUrl: w.imageUrl || null,
        targetNim: w.targetAmount || "0",
        currency: "NIM" as const,
        giftType: w.giftType,
      })),
    [draft.wishes],
  );

  async function reconcileWishes(id: string, server: EditorBirthday["wishes"]) {
    const keptIds = new Set(
      draft.wishes.filter((w) => w.serverId).map((w) => w.serverId),
    );
    for (const s of server) {
      // A gifted wish is never deleted — its Gift rows are the authoritative
      // record of money that moved, and they cascade from the wish. The server
      // refuses it too; skipping here means a stale local draft can't turn
      // "publish" into a failure the creator can't act on.
      if (!keptIds.has(s.id) && s.giftCount === 0) await deleteWish(s.id);
    }
    for (const w of draft.wishes) {
      const input = toWishInput(w);
      if (w.serverId) await updateWish(w.serverId, input);
      else await addWish(id, input);
    }
  }

  async function finishPublish() {
    setPublishing(true);
    setPublishError(null);
    setProblems([]);
    try {
      let target = birthday;

      if (!target) {
        try {
          target = await createBirthday({
            name: draft.name.trim(),
            birthday: draft.birthday,
            message: draft.message.trim() || undefined,
            theme: draft.theme,
            imageUrl: draft.imageUrl || undefined,
            wishes: draft.wishes.map(toWishInput),
          });
          setBirthday(target);
        } catch (err) {
          if (err instanceof ApiError && err.code === "conflict") {
            target = await getMyBirthday();
            if (!target) throw err;
            setBirthday(target);
            await updateBirthday(target.id, {
              name: draft.name.trim(),
              birthday: draft.birthday,
              message: draft.message.trim(),
              theme: draft.theme,
              imageUrl: draft.imageUrl,
            });
            await reconcileWishes(target.id, target.wishes);
          } else {
            throw err;
          }
        }
      } else {
        await updateBirthday(target.id, {
          name: draft.name.trim(),
          birthday: draft.birthday,
          message: draft.message.trim(),
          theme: draft.theme,
          imageUrl: draft.imageUrl,
        });
        await reconcileWishes(target.id, target.wishes);
      }

      const { url, birthday: published } = await publishBirthday(target.id);
      setBirthday(published);
      setPublishUrl(url);
      clear();
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // The session lapsed somewhere in the middle. Say so plainly and put
        // them back on the one step that can fix it — the draft is untouched.
        setAuthedAddress(null);
        setPublishError(
          "Your wallet session expired. Connect again and we'll publish — nothing you typed is lost.",
        );
        setStep("connect");
      } else if (err instanceof ApiError) {
        setPublishError(err.message);
        if (err.problems?.length) setProblems(err.problems);
      } else {
        setPublishError("Something went wrong while publishing. Please try again.");
      }
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <Card className="mx-auto max-w-xl">
        <div className="h-40 animate-pulse rounded-xl bg-black/5" />
      </Card>
    );
  }

  if (step === "done" && publishUrl) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              🎉
            </div>
            <h2 className="mt-3 font-display text-2xl text-ink">
              Your NIMday is live
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Share this link with the people who want to celebrate you.
            </p>
          </div>

          <div className="mt-5">
            <ShareSection
              url={publishUrl}
              name={draft.name || birthday?.name || "your"}
              audience="creator"
              tone="soft"
              title="Share it"
              subtitle="One link. Send it to everyone who'd want to celebrate you."
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-ink underline">
              Open My NIMday →
            </Link>
            <a
              href={publishUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-ink/70 underline"
            >
              Preview the public page
            </a>
          </div>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={async () => {
              const fresh = await getMyBirthday();
              if (fresh) {
                setBirthday(fresh);
                setDraft(draftFromEditor(fresh));
              }
              setStep("details");
            }}
          >
            Back to editing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <ol className="mb-6 flex items-center gap-2 text-xs">
        {ORDER.map((s, i) => {
          const active = s === step;
          const done = ORDER.indexOf(step) > i || step === "done";
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full font-semibold",
                  active
                    ? "bg-ink text-cream"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-black/10 text-ink/50",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={cn(active ? "text-ink" : "text-ink/40")}>
                {LABELS[s]}
              </span>
              {i < ORDER.length - 1 && <span className="text-ink/20">·</span>}
            </li>
          );
        })}
      </ol>

      <Card>
        {step === "details" && (
          <DetailsStep
            draft={draft}
            patch={patch}
            onNext={() => setStep("wishes")}
          />
        )}
        {step === "wishes" && (
          <WishesStep
            draft={draft}
            setDraft={setDraft}
            onBack={() => setStep("details")}
            onNext={() => setStep("connect")}
          />
        )}
        {step === "connect" && (
          <div className="space-y-4">
            {publishError ? (
              <p
                role="alert"
                className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
              >
                {publishError}
              </p>
            ) : null}
            <ConnectStep
              authedAddress={authedAddress}
              onAuthed={(a) => {
                setAuthedAddress(a);
                setPublishError(null);
              }}
              onBack={() => setStep("wishes")}
              onNext={() => setStep("preview")}
            />
          </div>
        )}
        {step === "preview" && (
          <div className="space-y-5">
            <div>
              <h3 className="font-medium text-ink">Here&apos;s your NIMday</h3>
              <p className="mt-1 text-sm text-ink/60">
                This is exactly what visitors will see.
              </p>
            </div>

            <div className="rounded-2xl bg-black/[0.03] p-3">
              <BirthdayCard data={previewData} compact>
                <WishList wishes={previewWishes} theme={draft.theme} />
              </BirthdayCard>
            </div>

            {!authedAddress && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
                Connect your wallet before publishing.{" "}
                <button
                  className="font-medium underline"
                  onClick={() => setStep("connect")}
                >
                  Go back
                </button>
              </p>
            )}

            {publishError && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                <p>{publishError}</p>
                {problems.length > 0 && (
                  <ul className="mt-1 list-inside list-disc">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep("details")}>
                  Edit details
                </Button>
                <Button variant="ghost" onClick={() => setStep("wishes")}>
                  Edit wishes
                </Button>
              </div>
              <Button
                size="lg"
                loading={publishing}
                disabled={!authedAddress}
                onClick={finishPublish}
              >
                Publish NIMday
              </Button>
            </div>
          </div>
        )}
      </Card>

      {birthday?.published && step !== "done" && publishUrl && (
        <p className="mt-4 text-center text-xs text-ink/50">
          Your NIMday is already published at{" "}
          <Link href={publishUrl} className="underline">
            {prettyUrl(publishUrl)}
          </Link>
          . Publishing again will update it.{" "}
          <Link href="/dashboard" className="font-medium underline">
            Open My NIMday
          </Link>
        </p>
      )}
    </div>
  );
}
