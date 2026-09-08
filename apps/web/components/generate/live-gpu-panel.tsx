"use client";

import * as React from "react";

import { LIMITS } from "@/lib/config";
import { formatDuration } from "@/lib/format";
import { activeJob, useStore } from "@/lib/store";
import { isTerminal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LiveGpuPanel() {
  const gpu = useStore((s) => s.gpu);
  const job = useStore(activeJob);
  const [now, setNow] = React.useState(() => Date.now());

  const running = job ? !isTerminal(job.status) : false;
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const genTime = job
    ? isTerminal(job.status) && job.generationSeconds != null
      ? job.generationSeconds
      : job.startedAt
        ? (now - job.startedAt) / 1000
        : 0
    : 0;

  const vramPct = gpu ? (gpu.memoryUsedMb / (gpu.memoryTotalMb || LIMITS.vramTotalMb)) * 100 : 0;
  const hot = (gpu?.temperature ?? 0) >= 78;

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live GPU</h3>
        <span className="metric text-xs text-muted">
          {gpu?.name.replace("NVIDIA GeForce ", "") ?? "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Utilization" value={gpu ? `${gpu.utilization}` : "—"} unit="%" />
        <Tile
          label="Temp"
          value={gpu ? `${gpu.temperature}` : "—"}
          unit="°C"
          tone={hot ? "warning" : undefined}
        />
        <Tile
          label="VRAM"
          value={gpu ? (gpu.memoryUsedMb / 1024).toFixed(1) : "—"}
          unit={`/ ${((gpu?.memoryTotalMb ?? LIMITS.vramTotalMb) / 1024).toFixed(0)} GB`}
        />
        <Tile label="Power" value={gpu ? `${gpu.powerWatts}` : "—"} unit="W" />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>VRAM</span>
          <span className="metric">{Math.round(vramPct)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700",
              vramPct > 92 ? "bg-danger" : vramPct > 75 ? "bg-warning" : "bg-accent",
            )}
            style={{ width: `${Math.min(100, vramPct)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted">Generation time</span>
        <span className="metric text-foreground">{formatDuration(genTime)}</span>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div
        className={cn(
          "metric text-lg leading-tight",
          tone === "warning" ? "text-warning" : "text-foreground",
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-xs text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}
