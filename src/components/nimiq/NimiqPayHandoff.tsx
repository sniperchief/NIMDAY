"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { QrCode } from "@/components/nimiq/QrCode";
import {
  NIMIQ_PAY_STORE_LINKS,
  createNimiqPayDeepLink,
  detectPlatform,
  type DevicePlatform,
} from "@/lib/nimiq/deepLink";

const primaryLink =
  "block rounded-full bg-ink px-5 py-3 text-center text-sm font-medium text-cream";
const storeLink =
  "block rounded-full bg-white px-5 py-2.5 text-center text-sm font-medium text-ink ring-1 ring-black/10";

/**
 * Next steps for a visitor who isn't inside Nimiq Pay.
 * - Phone: open this page in the app, or install it from the right store.
 * - Computer: Nimiq Pay is phone-only, so show a QR code that carries the
 *   page to a phone.
 */
export function NimiqPayHandoff({
  targetUrl,
  deepLink,
  className,
}: {
  /** absolute URL of the nimDay page to continue on */
  targetUrl: string;
  /** a ready-made deep link; built from targetUrl when omitted */
  deepLink?: string;
  className?: string;
}) {
  // navigator is browser-only, so the platform is known only after mount.
  const [platform, setPlatform] = useState<DevicePlatform | null>(null);
  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  const openLink = deepLink || createNimiqPayDeepLink(targetUrl);

  if (platform === "desktop") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex justify-center">
          <QrCode value={targetUrl} label="QR code that opens this page on your phone" />
        </div>
        <p className="text-sm text-ink/70">
          Nimiq Pay is a phone app. Scan this with your phone&apos;s camera to
          carry on there.
        </p>
        <p className="text-xs text-ink/50">Don&apos;t have Nimiq Pay yet?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <a className={storeLink} href={NIMIQ_PAY_STORE_LINKS.ios} target="_blank" rel="noopener noreferrer">
            App Store
          </a>
          <a className={storeLink} href={NIMIQ_PAY_STORE_LINKS.android} target="_blank" rel="noopener noreferrer">
            Google Play
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <a className={primaryLink} href={openLink}>
        Open in Nimiq Pay
      </a>
      {platform && (
        <>
          <p className="text-xs text-ink/50">
            Don&apos;t have Nimiq Pay yet? Install it, then come back to this page
            and tap Open in Nimiq Pay.
          </p>
          <a
            className={storeLink}
            href={platform === "ios" ? NIMIQ_PAY_STORE_LINKS.ios : NIMIQ_PAY_STORE_LINKS.android}
            target="_blank"
            rel="noopener noreferrer"
          >
            {platform === "ios" ? "Get Nimiq Pay on the App Store" : "Get Nimiq Pay on Google Play"}
          </a>
        </>
      )}
    </div>
  );
}
