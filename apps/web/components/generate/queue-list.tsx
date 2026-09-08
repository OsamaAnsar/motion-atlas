"use client";

import { Layers } from "lucide-react";

import { LIMITS } from "@/lib/config";
import { stageLabel, truncate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { type GenerationStatus, isTerminal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QueueList() {
  const jobs = useStore((s) => s.jobs);
  const activeJobId = useStore((s) => s.activeJobId);

  const pending = Object.values(jobs)
    .filter((j) => !isTerminal(j.status))
    .sort((a, b) => a.createdAt - b.createdAt);

  const running = pending.find((j) => j.status !== "queued");
  const queued = pending.filter((j) => j.status === "queued");

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="size-4 text-accent/70" />
          Queue
        </h3>
        <span className="metric text-xs text-muted">
          {queued.length}/{LIMITS.maxQueueSize} waiting
        </span>
      </div>

      {pending.length === 0 ? (
        <p className="text-xs text-muted">GPU idle — no jobs queued.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {running && <QueueRow label="running" job={running} active={running.id === activeJobId} />}
          {queued.map((j, i) => (
            <QueueRow key={j.id} label={`#${i + 1}`} job={j} active={j.id === activeJobId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueRow({
  label,
  job,
  active,
}: {
  label: string;
  job: { id: string; prompt: string; status: GenerationStatus };
  active: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        active ? "border-accent/40 bg-accent/5" : "border-border bg-surface-2",
      )}
    >
      <span
        className={cn(
          "metric w-14 shrink-0",
          job.status === "queued" ? "text-warning" : "text-accent-strong",
        )}
      >
        {label}
      </span>
      <span className="flex-1 truncate text-muted-strong">{truncate(job.prompt, 46)}</span>
      <span className="metric shrink-0 text-muted">{stageLabel(job.status)}</span>
    </li>
  );
}
