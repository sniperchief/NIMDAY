"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  connectWallet,
  signMessage,
  isNimiqPayAvailable,
  friendlyWalletMessage,
  WalletError,
} from "@/lib/nimiq/provider";
import { requestNonce, verifySignature, ApiError } from "@/lib/apiClient";
import { createNimiqPayDeepLink } from "@/lib/nimiq/deepLink";

type Status = "idle" | "working" | "done" | "error";

export function ConnectStep({
  authedAddress,
  onAuthed,
  onBack,
  onNext,
}: {
  authedAddress: string | null;
  onAuthed: (address: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [status, setStatus] = useState<Status>(authedAddress ? "done" : "idle");
  const [message, setMessage] = useState<string | null>(null);

  const devAllowed = process.env.NEXT_PUBLIC_ALLOW_DEV_WALLET === "1";
  const inNimiqPay = typeof window !== "undefined" && isNimiqPayAvailable();

  async function run() {
    setStatus("working");
    setMessage(null);
    try {
      const { address } = await connectWallet();
      const { nonce, message: challenge } = await requestNonce(address);
      const { publicKey, signature } = await signMessage(challenge);
      const res = await verifySignature({ nonce, publicKey, signature, address });
      onAuthed(res.user.walletAddress);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      if (err instanceof WalletError) setMessage(friendlyWalletMessage(err.code));
      else if (err instanceof ApiError) setMessage(err.message);
      else setMessage("Something went wrong. Please try again.");
    }
  }

  async function devLogin() {
    setStatus("working");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/dev-login", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body?.error?.message ?? "failed");
      onAuthed(body.data.user.walletAddress);
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Dev login isn't available. Set ALLOW_DEV_LOGIN=1.");
    }
  }

  if (status === "done" && authedAddress) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-sm font-medium text-emerald-900">
            Wallet connected
          </p>
          <p className="mt-1 break-all font-mono text-xs text-emerald-800">
            {authedAddress}
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            Gifts from your NIMday will arrive straight to this wallet.
          </p>
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button size="lg" onClick={onNext}>
            Next: preview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-medium text-ink">Connect your Nimiq wallet</h3>
        <p className="mt-1 text-sm text-ink/60">
          You&apos;ll approve a signature in Nimiq Pay — no transaction, no fees.
          This proves the wallet is yours so only you can edit this NIMday.
        </p>
      </div>

      {!inNimiqPay && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
          <p className="font-medium text-amber-900">Open this in Nimiq Pay</p>
          <p className="mt-1 text-amber-800">
            Wallet connection works inside the Nimiq Pay app. Open this page there
            to continue.
          </p>
          <a
            className="mt-3 inline-block rounded-full bg-amber-900 px-4 py-2 text-xs font-medium text-amber-50"
            href={createNimiqPayDeepLink(
              typeof window !== "undefined" ? window.location.href : "",
            )}
          >
            Open in Nimiq Pay
          </a>
        </div>
      )}

      {message ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" loading={status === "working"} onClick={run}>
          Connect Nimiq Wallet
        </Button>
        {devAllowed && (
          <Button variant="ghost" onClick={devLogin} disabled={status === "working"}>
            Use a test wallet (dev)
          </Button>
        )}
      </div>

      <div className="pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
