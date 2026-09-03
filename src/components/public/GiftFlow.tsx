"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, cn } from "@/components/ui";
import type { PublicWish } from "@/lib/birthday";
import { nimStringToLuna, lunaToNimString, lunaToSdkValue, MoneyError } from "@/lib/money";
import {
  connectWallet,
  sendGiftTransaction,
  isNimiqPayAvailable,
  friendlyWalletMessage,
  WalletError,
} from "@/lib/nimiq/provider";
import {
  ApiError,
  createGiftIntent,
  getPaymentStatus,
  submitGiftTransaction,
  type PaymentIntentView,
  type PaymentStatusView,
} from "@/lib/apiClient";

type Step =
  | "amount"
  | "handoff"
  | "connect"
  | "review"
  | "sending"
  | "verifying"
  | "confirmed"
  | "failed";

const FAILURE_COPY: Record<string, string> = {
  wrong_recipient: "That payment didn't reach the birthday person's wallet.",
  wrong_sender: "The payment came from a different wallet than expected.",
  wrong_memo: "We couldn't match that payment to this gift.",
  wrong_network: "That payment wasn't on the Nimiq mainnet.",
  wrong_currency: "Only NIM gifts are supported right now.",
  amount_too_low: "The amount received was less than the gift amount.",
  invalidated: "That transaction was rolled back by the network.",
  not_creditable: "That transaction can't be counted.",
  expired: "This gift request expired before the payment arrived.",
};

function reasonCopy(reason: string | null): string {
  if (!reason) return "We couldn't verify that payment. No gift was recorded.";
  return FAILURE_COPY[reason] ?? "We couldn't verify that payment.";
}

export function GiftFlow({
  slug,
  birthdayName,
  wishes,
  open,
  initialWishId,
  resumeIntentId,
  onClose,
}: {
  slug: string;
  origin: string;
  birthdayName: string;
  wishes: PublicWish[];
  open: boolean;
  initialWishId: string | null;
  resumeIntentId: string | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("amount");
  const [wishId, setWishId] = useState<string | null>(initialWishId);
  const [amount, setAmount] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [intent, setIntent] = useState<PaymentIntentView | null>(null);
  const [status, setStatus] = useState<PaymentStatusView | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wish = useMemo(
    () => wishes.find((w) => w.id === wishId) ?? null,
    [wishes, wishId],
  );

  const inNimiqPay = typeof window !== "undefined" && isNimiqPayAvailable();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startVerifying = useCallback(
    (intentId: string) => {
      setStep("verifying");
      stopPolling();
      const check = async () => {
        try {
          const s = await getPaymentStatus(intentId);
          setStatus(s);
          if (s.status === "CONFIRMED") {
            stopPolling();
            setStep("confirmed");
          } else if (s.status === "FAILED" || s.status === "EXPIRED") {
            stopPolling();
            setStep("failed");
          }
        } catch {
          /* keep polling */
        }
      };
      void check();
      pollRef.current = setInterval(check, 3000);
    },
    [stopPolling],
  );

  // Resume a payment opened via a Nimiq Pay deep link (?intent=<id>).
  useEffect(() => {
    if (!open || !resumeIntentId) return;
    (async () => {
      try {
        const s = await getPaymentStatus(resumeIntentId);
        setStatus(s);
        setWishId(s.wishId);
        if (s.status === "CONFIRMED") setStep("confirmed");
        else if (s.status === "FAILED" || s.status === "EXPIRED") setStep("failed");
        else if (s.txHash) startVerifying(resumeIntentId);
        else if (s.payContext) {
          setIntent({
            id: s.id,
            shortId: "",
            memo: s.payContext.memo,
            recipientAddress: s.payContext.recipientAddress,
            amountLuna: s.payContext.amountLuna,
            amountNim: s.amountNim,
            currency: "NIM",
            anonymous: s.anonymous,
            status: s.status,
            expiresAt: s.payContext.expiresAt,
            birthdayName: s.birthdayName,
            birthdaySlug: s.birthdaySlug,
            wishId: s.wishId,
            wishTitle: s.wishTitle,
            deepLink: "",
          });
          setStep(inNimiqPay ? "connect" : "handoff");
        }
      } catch {
        setError("We couldn't find that gift. Please start again.");
        setStep("amount");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resumeIntentId]);

  // Default amount = remaining to target (or the target if already fulfilled).
  useEffect(() => {
    if (!wish || amount) return;
    try {
      const target = nimStringToLuna(wish.targetNim || "0");
      const raised = BigInt(wish.raisedLuna || "0");
      const remaining = target - raised;
      setAmount(lunaToNimString(remaining > 0n ? remaining : target));
    } catch {
      setAmount(wish.targetNim || "10");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishId]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      // reset for next time
      setStep(resumeIntentId ? "verifying" : "amount");
      setIntent(null);
      setStatus(null);
      setError(null);
      setBusy(false);
    }
    return stopPolling;
  }, [open, stopPolling, resumeIntentId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function continueFromAmount() {
    setAmountError(null);
    setError(null);
    if (!wish) {
      setAmountError("Choose a wish first");
      return;
    }
    let luna: bigint;
    try {
      luna = nimStringToLuna(amount);
    } catch (e) {
      setAmountError(e instanceof MoneyError ? e.message : "Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const created = await createGiftIntent({
        slug,
        wishId: wish.id,
        amountNim: lunaToNimString(luna),
        anonymous,
      });
      setIntent(created);
      setStep(inNimiqPay ? "connect" : "handoff");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start the gift. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function doConnect() {
    setBusy(true);
    setError(null);
    try {
      const { address } = await connectWallet();
      setConnectedAddress(address);
      setStep("review");
    } catch (e) {
      setError(
        e instanceof WalletError
          ? friendlyWalletMessage(e.code)
          : "Couldn't connect to Nimiq Pay.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function doSend() {
    if (!intent) return;
    setStep("sending");
    setError(null);
    try {
      const { txHash } = await sendGiftTransaction({
        recipient: intent.recipientAddress,
        valueLuna: lunaToSdkValue(BigInt(intent.amountLuna)),
        data: intent.memo,
      });
      const s = await submitGiftTransaction(intent.id, {
        txHash,
        senderAddress: connectedAddress ?? undefined,
      });
      setStatus(s);
      if (s.status === "CONFIRMED") setStep("confirmed");
      else startVerifying(intent.id);
    } catch (e) {
      setStep("review");
      setError(
        e instanceof WalletError
          ? friendlyWalletMessage(e.code)
          : e instanceof ApiError
            ? e.message
            : "The gift couldn't be sent. Please try again.",
      );
    }
  }

  const amountNim = intent?.amountNim ?? status?.amountNim ?? amount;
  const wishTitle = wish?.title ?? intent?.wishTitle ?? status?.wishTitle ?? "this wish";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Send a gift to ${birthdayName}`}
    >
      <div
        className="w-full max-w-sm animate-pop-in rounded-3xl bg-white p-5 text-ink shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------- amount ---------- */}
        {step === "amount" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-xl">Send a gift</h3>
              <p className="mt-0.5 text-sm text-ink/60">
                to {birthdayName} · {wishTitle}
              </p>
            </div>

            {wishes.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {wishes.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setWishId(w.id);
                      setAmount("");
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs ring-1 transition",
                      w.id === wishId
                        ? "bg-ink text-cream ring-ink"
                        : "bg-white text-ink/70 ring-black/10",
                    )}
                  >
                    {w.title}
                  </button>
                ))}
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/80">
                Amount
              </span>
              <div className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10"
                />
                <span className="text-sm font-medium text-ink/60">NIM</span>
              </div>
              {amountError ? (
                <span className="mt-1 block text-xs text-red-600">{amountError}</span>
              ) : wish?.raisedNim !== undefined ? (
                <span className="mt-1 block text-xs text-ink/45">
                  {wish.fulfilled
                    ? "This wish is fully funded — anything extra still goes to them."
                    : `${wish.raisedNim} of ${wish.targetNim} NIM so far`}
                </span>
              ) : null}
            </label>

            <label className="flex items-center gap-2 text-sm text-ink/75">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Give anonymously
              <span className="text-xs text-ink/40">(hidden in NIMday, not on-chain)</span>
            </label>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={busy} onClick={continueFromAmount}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ---------- handoff (not in Nimiq Pay) ---------- */}
        {step === "handoff" && intent && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/5 text-2xl">
              💛
            </div>
            <div>
              <h3 className="font-display text-xl">Open in Nimiq Pay</h3>
              <p className="mt-1 text-sm text-ink/60">
                Your {intent.amountNim} NIM gift to {birthdayName} for “{intent.wishTitle}”
                is ready. Finish it in the Nimiq Pay app.
              </p>
            </div>
            <a
              href={intent.deepLink}
              className="block rounded-full bg-ink px-5 py-3 text-sm font-medium text-cream"
            >
              Open in Nimiq Pay
            </a>
            <p className="text-xs text-ink/45">
              Don&apos;t have it yet? Install Nimiq Pay, then reopen this link.
            </p>
            <Button variant="ghost" onClick={onClose}>
              Not now
            </Button>
          </div>
        )}

        {/* ---------- connect ---------- */}
        {step === "connect" && intent && (
          <div className="space-y-4">
            <h3 className="font-display text-xl">Connect your wallet</h3>
            <p className="text-sm text-ink/60">
              Sending {intent.amountNim} NIM to {birthdayName} for “{intent.wishTitle}”.
            </p>
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={busy} onClick={doConnect}>
                Connect Nimiq Wallet
              </Button>
            </div>
          </div>
        )}

        {/* ---------- review ---------- */}
        {step === "review" && intent && (
          <div className="space-y-4">
            <h3 className="font-display text-xl">Confirm your gift</h3>
            <dl className="space-y-1.5 rounded-2xl bg-black/[0.04] p-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/55">To</dt>
                <dd className="font-medium">{birthdayName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/55">Wish</dt>
                <dd className="font-medium">{intent.wishTitle}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/55">Amount</dt>
                <dd className="font-medium">{intent.amountNim} NIM</dd>
              </div>
              {connectedAddress ? (
                <div className="flex justify-between">
                  <dt className="text-ink/55">From</dt>
                  <dd className="font-mono text-xs">{connectedAddress}</dd>
                </div>
              ) : null}
              {intent.anonymous ? (
                <div className="flex justify-between">
                  <dt className="text-ink/55">Shown as</dt>
                  <dd className="font-medium">Anonymous</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs text-ink/45">
              Nimiq Pay will ask you to approve. Nothing leaves your wallet until you do.
            </p>
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={doSend}>Confirm &amp; send NIM</Button>
            </div>
          </div>
        )}

        {/* ---------- sending / verifying ---------- */}
        {(step === "sending" || step === "verifying") && (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
            <p className="text-sm font-medium">
              {step === "sending"
                ? "Waiting for you to approve in Nimiq Pay…"
                : "Payment submitted — verifying on the Nimiq network…"}
            </p>
            <p className="text-xs text-ink/45">
              This usually takes a few seconds. You can keep this open.
            </p>
          </div>
        )}

        {/* ---------- confirmed ---------- */}
        {step === "confirmed" && (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              🎁
            </div>
            <div>
              <h3 className="font-display text-2xl">Gift confirmed</h3>
              <p className="mt-1 text-sm text-ink/65">
                You sent {status?.confirmedGift?.amountNim ?? amountNim} NIM to{" "}
                {birthdayName} for “{status?.wishTitle ?? wishTitle}”.
                {status?.anonymous ? " Your name stays hidden in NIMday." : ""}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={onClose}>Back to the card</Button>
            </div>
          </div>
        )}

        {/* ---------- failed ---------- */}
        {step === "failed" && (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
              ⚠️
            </div>
            <div>
              <h3 className="font-display text-xl">
                {status?.status === "EXPIRED" ? "This gift request expired" : "We couldn't confirm that gift"}
              </h3>
              <p className="mt-1 text-sm text-ink/65">
                {status?.status === "EXPIRED"
                  ? "Start again to send your gift."
                  : reasonCopy(status?.failureReason ?? null)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setStep("amount");
                  setIntent(null);
                  setStatus(null);
                  setError(null);
                }}
              >
                Try again
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Back to the card
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
