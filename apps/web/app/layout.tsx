import type { Metadata, Viewport } from "next";

import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "Motion Atlas — self-hosted AI video generation",
    template: "%s · Motion Atlas",
  },
  description:
    "Turn prompts and images into video with an open-source diffusion model (Wan 2.2 TI2V 5B) running on a local NVIDIA RTX 3070 via ComfyUI — with full visibility into the inference process.",
  applicationName: "Motion Atlas",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col">
          <DemoModeBanner />
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
