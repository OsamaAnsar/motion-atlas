"use client";

import { Check, Loader2 } from "lucide-react";

import { stageHint } from "@/lib/format";
import {
  GENERATION_STAGES,
  type GenerationJob,
  type GenerationStage,
  isTerminal,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<GenerationStage, string> = {
  queued: "Queued",
  preparing: "Workflow prepared",
  loading_model: "Model loaded",
  encoding_prompt: "Prompt encoded",
  sampling: "Diffusion sampling",
  decoding: "VAE decoding",
  saving: "Video saved",
  completed: "Completed",
};

function fmtTime(at: number | null): string {
  if (!at) return "";
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function GenerationTimeline({ job }: { job: GenerationJob }) {
  const currentIndex = GENERATION_STAGES.indexOf(job.status as GenerationStage);
  const failed = job.status === "failed" || job.status === "cancelled";

  return (
    <div className="panel p-4">
      <h3 className="mb-3 text-sm font-semibold">Generation timeline</h3>
      <ol className="relative">
        {GENERATION_STAGES.map((stage, i) => {
          const entry = job.timeline.find((t) => t.status === stage);
          const reached = currentIndex >= 0 && i <= currentIndex && !failed;
          const isCurrent = !isTerminal(job.status) && i === currentIndex;
          const isDone = reached && !isCurrent;
          return (
            <li key={stage} className="flex gap-3 pb-3 last:pb-0">
              <div className="relative flex flex-col items-center">
                <span
                  className={cn(
                    "z-10 grid size-5 place-items-center rounded-full border text-[10px]",
                    isDone && "border-success/50 bg-success/15 text-success",
                    isCurrent && "border-accent bg-accent/15 text-accent-strong",
                    !reached && "border-border bg-surface-2 text-muted",
                  )}
                >
                  {isDone ? (
                    <Check className="size-3" />
                  ) : isCurrent ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <span className="size-1 rounded-full bg-current" />
                  )}
                </span>
                {i < GENERATION_STAGES.length - 1 && (
                  <span
                    className={cn(
                      "absolute top-5 h-full w-px",
                      reached && !isCurrent ? "bg-success/40" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="flex flex-1 items-baseline justify-between gap-2 pt-0.5">
                <div>
                  <p
                    className={cn(
                      "text-sm",
                      isCurrent ? "text-foreground" : reached ? "text-muted-strong" : "text-muted",
                    )}
                  >
                    {STEP_LABELS[stage]}
                  </p>
                  {isCurrent && <p className="text-xs text-muted">{stageHint(job.status)}</p>}
                </div>
                <span className="metric text-[11px] text-muted">{fmtTime(entry?.at ?? null)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
