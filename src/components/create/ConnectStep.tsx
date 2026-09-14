"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  connectWallet,
  signMessage,
  describeWalletError,
  WalletError,
} from "@/lib/nimiq/provider";
import { requestNonce, verifySignature, ApiError } from "@/lib/apiClient";
import { useNimiqPayPresence } from "@/lib/nimiq/useNimiqPayPresence";
import { NimiqPayHandoff } from "@/components/nimiq/NimiqPayHandoff";

type Status = "idle" | "working" | "done" | "error";

export function ConnectStep({
  authedAddress,
  onAuthed,
  onNext,
}: {
  authedAddress: string | null;
  onAuthed: (address: string) => void;
  onNext: () => void;
}) {
  const [status, setStatus] = useState<Status>(authedAddress ? "done" : "idle");
  const [message, setMessage] = useState<string | null>(null);

  const devAllowed = process.env.NEXT_PUBLIC_ALLOW_DEV_WALLET === "1";
  const presence = useNimiqPayPresence();

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
      if (err instanceof WalletError) setMessage(describeWalletError(err, "connect"));
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
            Gifts from your nimDay will arrive straight to this wallet.
          </p>
        </div>
        <div className="flex justify-end">
          <Button size="lg" onClick={onNext} className="w-full sm:w-auto">
            Next: birthday details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-medium text-ink">First, connect your Nimiq wallet</h3>
        <p className="mt-1 text-sm text-ink/60">
          You&apos;ll approve a signature in Nimiq Pay. No transaction, no fees.
          This proves the wallet is yours, so only you can edit this nimDay and
          gifts arrive straight to you.
        </p>
      </div>

      {/* Outside Nimiq Pay a Connect button can only time out, so offer the
          way into the app instead. */}
      {presence === "missing" && (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-medium text-amber-900">
            You&apos;re not in Nimiq Pay right now
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Connecting a wallet only works inside the Nimiq Pay app.
          </p>
          <NimiqPayHandoff
            className="mt-4"
            targetUrl={typeof window !== "undefined" ? window.location.href : ""}
          />
        </div>
      )}

      {message ? (
        <p
          role="alert"
          className="whitespace-pre-line break-words rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {presence !== "missing" && (
          <Button
            size="lg"
            loading={status === "working" || presence === "checking"}
            onClick={run}
            className="w-full sm:w-auto"
          >
            Connect Nimiq Wallet
          </Button>
        )}
        {devAllowed && (
          <Button variant="ghost" onClick={devLogin} disabled={status === "working"}>
            Use a test wallet (dev)
          </Button>
        )}
      </div>
    </div>
  );
}
