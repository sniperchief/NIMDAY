"use client";

import { useEffect, useState } from "react";
import { isNimiqPayAvailable } from "@/lib/nimiq/provider";

export type NimiqPayPresence = "checking" | "available" | "missing";

/** How long Nimiq Pay gets to inject its provider before we say it isn't there. */
const GRACE_MS = 1500;
/**
 * Keep looking after that. If the provider arrives late, the page switches
 * over, so someone who really is inside Nimiq Pay never gets stuck on an
 * "install the app" screen.
 */
const WATCH_MS = 10_000;
const POLL_MS = 100;

/**
 * Whether this page is running inside Nimiq Pay. It starts as "checking" on
 * both server and client so the first render matches, then settles within
 * GRACE_MS. This lets the UI show install/handoff options up front instead of
 * waiting for a Connect tap to time out.
 */
export function useNimiqPayPresence(): NimiqPayPresence {
  const [presence, setPresence] = useState<NimiqPayPresence>("checking");

  useEffect(() => {
    if (isNimiqPayAvailable()) {
      setPresence("available");
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (isNimiqPayAvailable()) {
        clearInterval(timer);
        setPresence("available");
        return;
      }
      const elapsed = Date.now() - started;
      if (elapsed >= GRACE_MS) {
        setPresence((p) => (p === "checking" ? "missing" : p));
      }
      if (elapsed >= WATCH_MS) clearInterval(timer);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return presence;
}
