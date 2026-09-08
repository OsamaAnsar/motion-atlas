"use client";

import * as React from "react";
import { Thermometer, Zap } from "lucide-react";

import { LIMITS, config } from "@/lib/config";
import { formatDurationLong } from "@/lib/format";
import { useBootstrap } from "@/hooks/use-bootstrap";
import { useGpuPolling } from "@/hooks/use-gpu-polling";
import { activeJob, useStore } from "@/lib/store";
import { isTerminal } from "@/lib/types";
import { Container, Eyebrow, Stat, StatusDot } from "@/components/primitives";
import { MetricChart } from "./metric-chart";

export function GpuDashboard() {
  useBootstrap();
  useGpuPolling(2000);
  const gpu = useStore((s) => s.gpu);
  const gpuHistory = useStore((s) => s.gpuHistory);
  const history = useStore((s) => s.history);
  const jobs = useStore((s) => s.jobs);
  const job = useStore(activeJob);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  const running = job ? !isTerminal(job.status) : false;
  const completed = history.filter((j) => j.status === "completed");
  const avgGen =
    completed.length > 0
      ? completed.reduce((s, j) => s + (j.generationSeconds ?? 0), 0) / completed.length
      : 0;

  const utilData = gpuHistory.map((s) => ({ t: s.t, value: s.utilization }));
  const vramData = gpuHistory.map((s) => ({ t: s.t, value: s.memoryUsedMb / 1024 }));

  const vramPct = gpu ? (gpu.memoryUsedMb / (gpu.memoryTotalMb || LIMITS.vramTotalMb)) * 100 : 0;

  return (
    <Container className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Eyebrow>GPU</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {gpu?.name ?? config.gpuName}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <StatusDot tone={gpu?.available ? "success" : "danger"} />
            {gpu?.available ? "CUDA available" : "GPU metrics unavailable"}
            {config.demoMode && " · simulated"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] uppercase tracking-wide text-muted">Current job</div>
          <div className="metric text-sm text-foreground">
            {running ? job?.status : "idle"}
          </div>
        </div>
      </div>

      {/* metric tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Utilization"
          value={gpu ? gpu.utilization : "—"}
          unit="%"
          accent
          hint="compute"
        />
        <Stat
          label="VRAM"
          value={gpu ? (gpu.memoryUsedMb / 1024).toFixed(1) : "—"}
          unit={`/ ${((gpu?.memoryTotalMb ?? LIMITS.vramTotalMb) / 1024).toFixed(0)} GB`}
          hint={`${Math.round(vramPct)}% used`}
        />
        <Stat
          label="Temp"
          value={gpu ? gpu.temperature : "—"}
          unit="°C"
        />
        <Stat label="Power" value={gpu ? gpu.powerWatts : "—"} unit="W" />
      </div>

      {/* charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">GPU utilization</h3>
            <span className="metric text-xs text-muted">last {Math.round((gpuHistory.length * 2) / 60)}m</span>
          </div>
          {ready && <MetricChart data={utilData} unit="%" domain={[0, 100]} color="#7c9cff" />}
        </div>
        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">VRAM usage</h3>
            <span className="metric text-xs text-muted">GB</span>
          </div>
          {ready && (
            <MetricChart
              data={vramData}
              unit=" GB"
              domain={[0, Math.ceil((gpu?.memoryTotalMb ?? LIMITS.vramTotalMb) / 1024)]}
              color="#3fb950"
            />
          )}
        </div>
      </div>

      {/* secondary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Videos generated" value={completed.length} />
        <Stat label="Avg generation time" value={avgGen ? formatDurationLong(avgGen) : "—"} />
        <Stat
          label="Queue length"
          value={Object.values(jobs).filter((j) => j.status === "queued").length}
        />
        <Stat
          label="Thermals"
          value={
            <span className="flex items-center gap-1">
              <Thermometer className="size-4 text-muted" />
              {gpu && gpu.temperature >= 78 ? "hot" : "nominal"}
            </span>
          }
        />
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted">
        <Zap className="size-3" />
        Metrics come from <span className="metric">nvidia-smi</span> via{" "}
        <span className="metric">GET /api/gpu</span>. History is kept in-memory for ~5 minutes.
      </p>
    </Container>
  );
}
