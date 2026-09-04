/**
 * Human-readable copy for verification outcomes and payment states.
 *
 * The verification rules themselves are untouched — this only decides what a
 * person reads. A visitor should never see `PaymentVerificationError:
 * wrong_recipient`; they should read what happened and what to do next.
 */
import type { VerificationFailure } from "@/lib/gifts/verification";

const FAILURE_COPY: Record<VerificationFailure, string> = {
  wrong_recipient:
    "We couldn't confirm this gift. The payment was sent to a different address.",
  wrong_sender: "The payment came from a different wallet than this gift expected.",
  wrong_memo: "We couldn't match that payment to this gift.",
  wrong_network: "That payment wasn't on the Nimiq network we verify against.",
  wrong_currency: "Only NIM gifts are supported right now.",
  amount_too_low: "The amount that arrived was less than the gift amount.",
  not_confirmed: "The network hasn't confirmed that payment yet.",
  invalidated: "That transaction was rolled back by the network, so the gift was undone.",
  not_creditable: "That transaction can't be counted as a gift.",
};

const EXTRA_COPY: Record<string, string> = {
  expired: "This gift request expired before the payment arrived.",
};

/** Never leaks a raw reason code; unknown reasons fall back to a plain sentence. */
export function giftFailureMessage(reason: string | null | undefined): string {
  if (!reason) return "We couldn't confirm that gift, so nothing was recorded.";
  return (
    FAILURE_COPY[reason as VerificationFailure] ??
    EXTRA_COPY[reason] ??
    "We couldn't confirm that gift, so nothing was recorded."
  );
}

/** Headline + body for each payment state the giver can be looking at. */
export function paymentStateCopy(
  status: string,
  failureReason: string | null,
): { title: string; body: string } {
  switch (status) {
    case "CREATED":
      return {
        title: "Ready when you are",
        body: "Nothing has left your wallet yet.",
      };
    case "SUBMITTED":
      return {
        title: "Payment submitted — verifying",
        body: "We're checking it on the Nimiq network. This usually takes a few seconds.",
      };
    case "PENDING":
      return {
        title: "Almost there",
        body: "The network has seen your payment and is confirming it.",
      };
    case "CONFIRMED":
      return { title: "Gift confirmed", body: "It's on its way to their wallet." };
    case "EXPIRED":
      return {
        title: "This gift request expired",
        body: "Start again to send your gift — nothing was taken.",
      };
    case "FAILED":
      return {
        title: "We couldn't confirm that gift",
        body: giftFailureMessage(failureReason),
      };
    default:
      return {
        title: "Checking your gift",
        body: "Hang tight while we look this up.",
      };
  }
}
