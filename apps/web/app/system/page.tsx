import type { Metadata } from "next";

import { SystemChecks } from "@/components/system/system-checks";

export const metadata: Metadata = {
  title: "System",
  description: "Local setup diagnostics — GPU, CUDA, ComfyUI, workflow, output directory.",
};

export default function SystemPage() {
  return <SystemChecks />;
}
