import type { Metadata } from "next";
import { Suspense } from "react";

import { GalleryView } from "@/components/gallery/gallery-view";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Browse previous video generations with their settings and metadata.",
};

export default function GalleryPage() {
  // GalleryView reads its filters from the query string (needs a Suspense boundary).
  return (
    <Suspense fallback={null}>
      <GalleryView />
    </Suspense>
  );
}
