"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Maximize2, Shuffle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, truncate } from "@/lib/format";
import { remixHref } from "@/lib/remix";
import type { GenerationJob } from "@/lib/types";
import { SyntheticClip } from "@/components/generate/synthetic-clip";

export function GenerationCard({ job }: { job: GenerationJob }) {
  const [hover, setHover] = React.useState(false);
  const durationS = job.settings.frames / job.settings.fps;

  return (
    <div
      className="group panel relative overflow-hidden transition-colors hover:border-border-strong"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link href={`/generations/${job.id}`} className="block">
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

      {/* Sibling of the card link (links cannot nest). Always visible on touch screens. */}
      <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <RemixLink
          href={remixHref(job, "new")}
          label="Remix"
          title="Open the generator with these settings and a new seed"
        />
        <RemixLink
          href={remixHref(job, "same")}
          label="Same seed"
          title="Open the generator with these settings and the same seed"
        />
      </div>
    </div>
  );
}

function RemixLink({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <Link
      href={href}
      title={title}
      className="inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-foreground outline-none transition-colors hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Shuffle className="size-3" />
      {label}
    </Link>
  );
}
