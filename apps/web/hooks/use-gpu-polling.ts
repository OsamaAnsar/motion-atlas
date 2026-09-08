"use client";

import { useEffect } from "react";

import { useStore } from "@/lib/store";

/** Polls `GET /api/gpu` (mock: in-browser sim) on an interval. */
export function useGpuPolling(intervalMs = 2000): void {
  const refreshGpu = useStore((s) => s.refreshGpu);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) void refreshGpu();
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshGpu, intervalMs]);
}
