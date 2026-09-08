"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Maximize2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, truncate } from "@/lib/format";
import type { GenerationJob } from "@/lib/types";
import { SyntheticClip } from "@/components/generate/synthetic-clip";

export function GenerationCard({ job }: { job: GenerationJob }) {
  const [hover, setHover] = React.useState(false);
  const durationS = job.settings.frames / job.settings.fps;

  return (
    <Link
      href={`/generations/${job.id}`}
      className="group panel overflow-hidden transition-colors hover:border-border-strong"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {hover ? (
          <SyntheticClip seed={job.settings.seed} playing aspect={16 / 9} />
        ) : job.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid-bg h-full w-full" />
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge variant={job.mode === "text-to-video" ? "default" : "accent"}>
            {job.mode === "text-to-video" ? "T2V" : "I2V"}
          </Badge>
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-muted-strong opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 className="size-3" /> open
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm text-foreground">{truncate(job.prompt, 120)}</p>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span className="metric">
            {job.settings.width}×{job.settings.height} · {durationS.toFixed(1)}s ·{" "}
            {job.settings.fps}fps
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatRelativeDate(job.completedAt ?? job.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}
