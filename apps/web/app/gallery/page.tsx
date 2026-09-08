import type { Metadata } from "next";

import { GalleryView } from "@/components/gallery/gallery-view";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Browse previous video generations with their settings and metadata.",
};

export default function GalleryPage() {
  return <GalleryView />;
}
