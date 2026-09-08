"use client";

import { useMemo } from "react";

import { config } from "@/lib/config";
import { useGpuPolling } from "@/hooks/use-gpu-polling";
import { useStore } from "@/lib/store";
import { isTerminal } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHORT_GPU = config.gpuName.replace("NVIDIA GeForce ", "").replace("NVIDIA ", "");

export function GpuStatusIndicator({ className }: { className?: string }) {
  useGpuPolling(2000);
  const gpu = useStore((s) => s.gpu);
  const jobs = useStore((s) => s.jobs);
  const activeJobId = useStore((s) => s.activeJobId);

  const state = useMemo<"offline" | "generating" | "ready">(() => {
    const active = activeJobId ? jobs[activeJobId] : undefined;
    if (active && !isTerminal(active.status)) return "generating";
    if (!gpu || !gpu.available) return "offline";
    return "ready";
  }, [gpu, jobs, activeJobId]);

  const label =
    state === "offline"
      ? "GPU • Offline"
      : state === "generating"
        ? `${SHORT_GPU} • Generating`
        : `${SHORT_GPU} • Ready`;

  const tone =
    state === "offline" ? "text-danger" : state === "generating" ? "text-warning" : "text-success";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs",
        className,
      )}
      title={
        gpu?.available
          ? `${gpu.utilization}% util · ${(gpu.memoryUsedMb / 1024).toFixed(1)}/${(
              gpu.memoryTotalMb / 1024
            ).toFixed(0)} GB`
          : "GPU metrics unavailable"
      }
    >
      <span className={cn("dot", tone, state === "generating" && "animate-pulse-ring")} aria-hidden />
      <span className="metric text-muted-strong">{label}</span>
    </div>
  );
}
