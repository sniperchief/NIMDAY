import { getPublishedBirthdayBySlug, toPublicBirthday } from "@/lib/birthday";
import { getTheme, THEMES } from "@/lib/themes";
import { countdownLabel } from "@/lib/countdown";

export const alt = "A NIMday birthday card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/svg+xml";

type Params = { params: Promise<{ slug: string }> };

const esc = (s: string) =>
  s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Social preview card. Rendered as SVG rather than via next/og — no font
 * bundling, works identically everywhere, and renders in WhatsApp / Telegram /
 * Slack / Facebook / LinkedIn unfurls. (A rasterised PNG could be added later
 * for crawlers that don't accept SVG.)
 */
export default async function OpengraphImage({ params }: Params) {
  const { slug } = await params;
  const b = await getPublishedBirthdayBySlug(slug);
  const pub = b ? toPublicBirthday(b) : null;
  const theme = getTheme(b?.theme ?? THEMES.confetti.id);
  const name = esc(pub?.name ?? "NIMday");
  const line = esc(
    pub
      ? countdownLabel(pub.name, {
          isToday: pub.countdown.isToday,
          daysUntil: pub.countdown.daysUntil,
          nextDate: new Date(pub.countdown.nextDateISO),
          turningAge: pub.countdown.turningAge,
        })
      : "Your birthday. Your wishes. One beautiful link.",
  );
  const [c0, c1, accent] = theme.swatches;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c0}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${c1}" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#fbf7f0"/>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g>
    <circle cx="150" cy="110" r="10" fill="${c0}"/>
    <circle cx="1050" cy="90" r="8" fill="${accent}"/>
    <circle cx="1010" cy="540" r="12" fill="${c1}"/>
    <circle cx="180" cy="520" r="7" fill="${accent}"/>
  </g>
  <rect x="140" y="150" width="920" height="330" rx="42" fill="#ffffff"/>
  <text x="600" y="245" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="#8a7f74">It's a birthday</text>
  <text x="600" y="335" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="76" font-weight="700" fill="${accent}">${name}</text>
  <g>
    <rect x="360" y="380" width="480" height="60" rx="30" fill="${accent}"/>
    <text x="600" y="419" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#ffffff">${line}</text>
  </g>
  <text x="600" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#6b6157">made with NIMday</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
