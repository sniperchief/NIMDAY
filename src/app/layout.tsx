import type { Metadata, Viewport } from "next";
import "./globals.css";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.appOrigin),
  title: {
    default: "nimDay — Your birthday. Your wishes. One beautiful link.",
    template: "%s · nimDay",
  },
  description:
    "Make a beautiful birthday page, add a few wishes, and share one link with the people who want to celebrate you.",
  openGraph: {
    siteName: "nimDay",
    type: "website",
  },
};

/**
 * Mobile-first: the page must scale with the device, and stay zoomable — a
 * birthday card someone can't pinch to read is a broken birthday card.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-ink antialiased">{children}</body>
    </html>
  );
}
