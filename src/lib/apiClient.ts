"use client";

import type { EditorBirthday } from "@/lib/birthday";
import type { WishInput } from "@/lib/validation";
import type { PaymentIntentView, PaymentStatusView } from "@/lib/gifts/intent";
import type { GiftActivity } from "@/lib/gifts/activity";

export type { EditorBirthday, PaymentIntentView, PaymentStatusView, GiftActivity };

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  issues?: ApiIssue[];
  problems?: string[];
  constructor(
    status: number,
    code: string,
    message: string,
    extra?: { issues?: ApiIssue[]; problems?: string[] },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = extra?.issues;
    this.problems = extra?.problems;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* ignore */
  }

  const body = payload as
    | { ok: true; data: T }
    | {
        ok: false;
        error: {
          code: string;
          message: string;
          issues?: ApiIssue[];
          problems?: string[];
        };
      }
    | null;

  if (!res.ok || !body || body.ok === false) {
    const err = body && body.ok === false ? body.error : undefined;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? "Something went wrong",
      { issues: err?.issues, problems: err?.problems },
    );
  }
  return body.data;
}

/* ---- auth ---- */
export const requestNonce = (address: string) =>
  api<{ nonce: string; message: string; expiresAt: string }>("/api/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });

export const verifySignature = (input: {
  nonce: string;
  publicKey: string;
  signature: string;
  address: string;
}) =>
  api<{ user: { walletAddress: string }; signatureEncoding: string }>(
    "/api/auth/verify",
    { method: "POST", body: JSON.stringify(input) },
  );

export const getMe = () =>
  api<{ user: { walletAddress: string } }>("/api/auth/me").catch(() => null);

export const logout = () => api("/api/auth/logout", { method: "POST" });

/* ---- birthday ---- */
/** Null when there is no NIMday yet *or* nobody is signed in — both mean "nothing to load". */
export const getMyBirthday = () =>
  api<{ birthday: EditorBirthday | null }>("/api/birthdays/me")
    .then((d) => d.birthday)
    .catch((err) => {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    });

export const createBirthday = (input: {
  name: string;
  birthday: string;
  message?: string;
  theme: string;
  imageUrl?: string;
  wishes: WishInput[];
}) =>
  api<{ birthday: EditorBirthday }>("/api/birthdays", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((d) => d.birthday);

export const updateBirthday = (
  id: string,
  patch: Partial<{
    name: string;
    birthday: string;
    message: string;
    theme: string;
    imageUrl: string;
  }>,
) =>
  api<{ birthday: EditorBirthday }>(`/api/birthdays/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((d) => d.birthday);

export const publishBirthday = (id: string) =>
  api<{ birthday: EditorBirthday; url: string }>(
    `/api/birthdays/${id}/publish`,
    { method: "POST" },
  );

/* ---- wishes ---- */
export const addWish = (birthdayId: string, wish: WishInput) =>
  api<{ birthday: EditorBirthday }>(`/api/birthdays/${birthdayId}/wishes`, {
    method: "POST",
    body: JSON.stringify(wish),
  }).then((d) => d.birthday);

export const updateWish = (wishId: string, patch: Partial<WishInput>) =>
  api<{ birthday: EditorBirthday }>(`/api/wishes/${wishId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((d) => d.birthday);

export const deleteWish = (wishId: string) =>
  api<{ birthday: EditorBirthday }>(`/api/wishes/${wishId}`, {
    method: "DELETE",
  }).then((d) => d.birthday);

/* ---- gifting (Phase 2) ---- */
export const createGiftIntent = (input: {
  slug: string;
  wishId: string;
  amountNim: string;
  anonymous: boolean;
  senderAddress?: string;
}) =>
  api<{ intent: PaymentIntentView }>("/api/gifts/intent", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((d) => d.intent);

export const getPaymentStatus = (id: string) =>
  api<{ payment: PaymentStatusView }>(`/api/gifts/intent/${id}`).then(
    (d) => d.payment,
  );

export const submitGiftTransaction = (
  id: string,
  input: { txHash: string; senderAddress?: string },
) =>
  api<{ payment: PaymentStatusView }>(`/api/gifts/intent/${id}/submit`, {
    method: "POST",
    body: JSON.stringify(input),
  }).then((d) => d.payment);

export const getMyGiftActivity = () =>
  api<{ activity: GiftActivity }>("/api/birthdays/me/gifts")
    .then((d) => d.activity)
    .catch((err) => {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    });

/* ---- upload ---- */
export const uploadImage = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api<{ url: string }>("/api/upload", { method: "POST", body: fd }).then(
    (d) => d.url,
  );
};
