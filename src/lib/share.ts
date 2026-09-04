/**
 * One canonical public URL for a NIMday, and the copy that travels with it.
 * Everything that shares a link — the public page, the dashboard, the publish
 * confirmation — goes through here so there is only ever one URL format.
 * (Nimiq Pay deep links are a separate, deliberate format: see nimiq/deepLink.)
 */

export function publicBirthdayUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/b/${encodeURIComponent(slug)}`;
}

/** The link without the scheme — for showing a URL inside a pill or button. */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/** What the creator sends out: "here's my NIMday". */
export function creatorShareText(name: string): string {
  return `🎂 It's my birthday! I made a NIMday with a few things I'd love this year — ${firstName(
    name,
  )}`;
}

/** What a visitor sends on: "come and celebrate them too". */
export function visitorShareText(name: string): string {
  return `🎂 It's ${firstName(name)}'s birthday — leave them a message or send a little gift`;
}

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export function sharePayload(
  name: string,
  url: string,
  audience: "creator" | "visitor",
): SharePayload {
  return {
    title: "NIMday",
    text: audience === "creator" ? creatorShareText(name) : visitorShareText(name),
    url,
  };
}

/** Fallback when the Web Share API isn't available: a WhatsApp web intent. */
export function whatsappShareUrl(payload: SharePayload): string {
  return `https://wa.me/?text=${encodeURIComponent(`${payload.text}\n${payload.url}`)}`;
}
