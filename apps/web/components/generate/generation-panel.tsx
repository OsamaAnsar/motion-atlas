"use client";

import * as React from "react";

import { activeJob, useStore } from "@/lib/store";
import { isTerminal } from "@/lib/types";
import { StageView } from "./stage-view";
import { GenerationProgress } from "./generation-progress";
import { GenerationTimeline } from "./generation-timeline";
import { LiveGpuPanel } from "./live-gpu-panel";
import { MetadataPanel } from "./metadata-panel";
import { QueueList } from "./queue-list";

export function GenerationPanel() {
  const job = useStore(activeJob);
  const loadHistory = useStore((s) => s.loadHistory);
  const metaRef = React.useRef<HTMLDivElement | null>(null);

  const running = job ? !isTerminal(job.status) : false;
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void loadHistory(), 1500);
    return () => clearInterval(id);
  }, [running, loadHistory]);

  return (
    <div className="flex flex-col gap-4">
      <StageView
        job={job}
        onViewMetadata={() => metaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />

      {job ? (
        <>
          <GenerationProgress job={job} />
          <div className="grid gap-4 sm:grid-cols-2">
            <GenerationTimeline job={job} />
            <div className="flex flex-col gap-4">
              <LiveGpuPanel />
              <QueueList />
            </div>
          </div>
          {job.status === "completed" && (
            <div ref={metaRef}>
              <MetadataPanel job={job} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <LiveGpuPanel />
            <QueueList />
          </div>
          <p className="text-center text-xs text-muted">
            Fill in a prompt and hit <span className="text-foreground">Generate Video</span>. Progress,
            GPU telemetry and metadata stream here.
          </p>
        </>
      )}

      {job && !isTerminal(job.status) && (
        <p className="text-center text-[11px] text-muted">
          Live via <span className="metric">WS /api/generations/{job.id}/events</span> (simulated in
          demo mode)
        </p>
      )}
    </div>
  );
}
