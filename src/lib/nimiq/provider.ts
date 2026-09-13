"use client";

/**
 * Thin client-side wrapper around the official Nimiq Mini App SDK.
 * Everything the UI needs from the wallet goes through here, with typed errors
 * so components never surface raw provider messages to users.
 */

import { init } from "@nimiq/mini-app-sdk";
import { parseSendResult } from "@/lib/nimiq/txResult";
import {
  WalletError,
  classifyWalletError,
  describeWalletError,
  friendlyWalletMessage,
  isProviderError,
  type WalletErrorCode,
} from "@/lib/nimiq/walletError";

export {
  WalletError,
  describeWalletError,
  friendlyWalletMessage,
  type WalletErrorCode,
};

type ProviderError = { error: { type: string; message: string } };

interface NimiqProviderLike {
  listAccounts(): Promise<string[] | ProviderError>;
  sign(
    message: string,
  ): Promise<{ publicKey: string; signature: string } | ProviderError>;
  isConsensusEstablished(): Promise<boolean>;
  sendBasicTransactionWithData(tx: {
    recipient: string;
    value: number;
    data: string;
    fee?: number;
    validityStartHeight?: number;
  }): Promise<string | ProviderError>;
}

let providerPromise: Promise<NimiqProviderLike> | null = null;

function getProvider(): Promise<NimiqProviderLike> {
  if (!providerPromise) {
    providerPromise = init({ timeout: 4000 })
      .then((p) => p as unknown as NimiqProviderLike)
      .catch((err) => {
        providerPromise = null;
        throw new WalletError(
          "unavailable",
          err instanceof Error ? err.message : "Nimiq Pay not detected",
        );
      });
  }
  return providerPromise;
}

/** Quick, non-throwing check for whether we're inside Nimiq Pay. */
export function isNimiqPayAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as { nimiq?: unknown }).nimiq !== "undefined"
  );
}

/** All wallet failures funnel through the shared classifier. */
const mapThrown = classifyWalletError;

export async function getConsensusReady(): Promise<boolean> {
  try {
    const provider = await getProvider();
    return await provider.isConsensusEstablished();
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<{ address: string }> {
  const provider = await getProvider();
  let result: Awaited<ReturnType<NimiqProviderLike["listAccounts"]>>;
  try {
    result = await provider.listAccounts();
  } catch (err) {
    throw mapThrown(err);
  }
  if (isProviderError(result)) {
    throw mapThrown(result);
  }
  const address = Array.isArray(result) ? result[0] : undefined;
  if (!address) throw new WalletError("no-account", "No Nimiq account was returned");
  return { address };
}

export async function signMessage(
  message: string,
): Promise<{ publicKey: string; signature: string }> {
  const provider = await getProvider();
  let result: Awaited<ReturnType<NimiqProviderLike["sign"]>>;
  try {
    result = await provider.sign(message);
  } catch (err) {
    throw mapThrown(err);
  }
  if (isProviderError(result)) {
    throw mapThrown(result);
  }
  if (!result.publicKey || !result.signature) {
    throw new WalletError("unknown", "Signature response was incomplete");
  }
  return { publicKey: result.publicKey, signature: result.signature };
}

/**
 * Send a NIM gift with the nimDay memo attached. The returned value is run
 * through the isolated `parseSendResult` adapter (see txResult.ts).
 */
export async function sendGiftTransaction(params: {
  recipient: string;
  valueLuna: number;
  data: string;
}): Promise<{ txHash: string }> {
  const provider = await getProvider();
  let result: string | { error: { type: string; message: string } };
  try {
    result = await provider.sendBasicTransactionWithData({
      recipient: params.recipient,
      value: params.valueLuna,
      data: params.data,
      // fee omitted — Nimiq Pay picks one (0 where possible).
    });
  } catch (err) {
    throw mapThrown(err);
  }
  if (isProviderError(result)) {
    throw mapThrown(result);
  }
  return parseSendResult(result);
}




