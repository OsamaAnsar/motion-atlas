import type { Metadata } from "next";

import { GpuDashboard } from "@/components/gpu/gpu-dashboard";

export const metadata: Metadata = {
  title: "GPU",
  description: "Live RTX 3070 telemetry — utilization, VRAM, temperature, power, and history.",
};

export default function GpuPage() {
  return <GpuDashboard />;
}
