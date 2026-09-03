import type { Metadata } from "next";
import "./globals.css";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.appOrigin),
  title: {
    default: "NIMday — Your birthday. Your wishes. One beautiful link.",
    template: "%s · NIMday",
  },
  description:
    "Make a beautiful birthday page, add a few wishes, and share one link with the people who want to celebrate you.",
  openGraph: {
    siteName: "NIMday",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
