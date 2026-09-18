import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The gift mark from components/brand/Wordmark.tsx. The viewBox frames it so
 * the gift fills about 60% of the tile. iOS rounds the corners itself and shows
 * transparency as black, so the tile is a plain opaque white square.
 */
const GIFT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8.917 0.267 13.167 13.167">
  <rect x="8.917" y="0.267" width="13.167" height="13.167" fill="#fff"/>
  <g fill="#EF5B2B">
    <path d="M15.5 5.3 12.9 2.9v2.4Z"/>
    <path d="M15.5 5.3 18.1 2.9v2.4Z"/>
    <rect x="11.9" y="5.3" width="3.1" height="1.9" rx="0.45"/>
    <rect x="16" y="5.3" width="3.1" height="1.9" rx="0.45"/>
    <rect x="12.5" y="7.7" width="2.5" height="3.1" rx="0.4"/>
    <rect x="16" y="7.7" width="2.5" height="3.1" rx="0.4"/>
  </g>
</svg>`;

/**
 * Home-screen icon. Unlike the social preview card, this uses next/og. That
 * card avoids it because of font bundling, but this icon has no text, and iOS
 * needs a PNG.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          width={180}
          height={180}
          src={`data:image/svg+xml,${encodeURIComponent(GIFT_SVG)}`}
        />
      </div>
    ),
    size,
  );
}
