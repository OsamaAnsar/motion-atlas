"use client";

import * as React from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDuration, stageHint, stageLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { type GenerationJob, isTerminal } from "@/lib/types";

function useElapsed(job: GenerationJob): number {
  const [now, setNow] = React.useState(() => Date.now());
  const running = !isTerminal(job.status);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);
  if (isTerminal(job.status) && job.generationSeconds != null) return job.generationSeconds;
  if (!job.startedAt) return 0;
  return (now - job.startedAt) / 1000;
}

export function GenerationProgress({ job }: { job: GenerationJob }) {
  const elapsed = useElapsed(job);
  const cancel = useStore((s) => s.cancel);
  const running = !isTerminal(job.status);
  const sampling = job.status === "sampling";
  const queued = job.status === "queued";
  const indeterminate = running && !sampling && job.progress < 0.02;

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold">
            {running ? "Generating" : stageLabel(job.status)}
          </h3>
          {queued && job.queuePosition != null && (
            <span className="metric text-xs text-warning">#{job.queuePosition} in queue</span>
          )}
        </div>
        <span className="metric text-2xl leading-none text-foreground">
          {Math.round(job.progress * 100)}
          <span className="text-sm text-muted">%</span>
        </span>
      </div>

      <Progress value={job.progress} indeterminate={indeterminate} />

      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex flex-col">
          <span className="text-muted-strong">{stageLabel(job.status)}</span>
          <span className="text-muted">{stageHint(job.status)}</span>
        </div>
        <div className="flex flex-col items-end">
          {sampling ? (
            <span className="metric text-muted-strong">
              Step {job.currentStep} / {job.totalSteps}
            </span>
          ) : (
            <span className="metric text-muted-strong">
              {running ? "—" : job.status === "completed" ? "done" : job.status}
            </span>
          )}
          <span className="metric text-muted">Elapsed {formatDuration(elapsed)}</span>
        </div>
      </div>

      {running && (
        <div className="mt-3 border-t border-border pt-3">
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              await cancel(job.id);
              toast.message(
                queued ? "Removed from queue" : "Cancellation requested",
                queued
                  ? undefined
                  : {
                      description:
                        "In real mode a running ComfyUI step may finish before it stops.",
                    },
              );
            }}
          >
            <Ban />
            {queued ? "Remove from queue" : "Cancel generation"}
          </Button>
        </div>
      )}
    </div>
  );
}
