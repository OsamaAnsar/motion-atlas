import type { Metadata } from "next";

import { GenerateWorkspace } from "@/components/generate/generate-workspace";

export const metadata: Metadata = {
  title: "Generate",
  description: "Text-to-video and image-to-video generation with live inference telemetry.",
};

export default function GeneratePage() {
  return <GenerateWorkspace />;
}
