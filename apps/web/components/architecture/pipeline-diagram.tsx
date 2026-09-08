"use client";

import { motion } from "framer-motion";

import type { GenerationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type NodeId =
  | "browser"
  | "next"
  | "fastapi"
  | "queue"
  | "sqlite"
  | "gpumetrics"
  | "comfyui"
  | "wan"
  | "rtx"
  | "mp4";

const STAGE_NODES: Record<GenerationStatus, NodeId[]> = {
  queued: ["browser", "next", "fastapi", "queue"],
  preparing: ["fastapi", "queue"],
  loading_model: ["comfyui", "wan", "rtx"],
  encoding_prompt: ["comfyui", "wan", "rtx"],
  sampling: ["comfyui", "wan", "rtx"],
  decoding: ["comfyui", "wan", "rtx"],
  saving: ["comfyui", "mp4", "fastapi"],
  completed: ["mp4", "fastapi", "next", "browser"],
  failed: [],
  cancelled: [],
};

function Node({
  id,
  title,
  sub,
  active,
  live,
}: {
  id: NodeId;
  title: string;
  sub?: string;
  active: Set<NodeId>;
  live: boolean;
}) {
  const on = active.has(id);
  return (
    <div
      className={cn(
        "relative rounded-lg border px-3 py-2 text-center transition-colors duration-500",
        on
          ? "border-accent/60 bg-accent/10 text-foreground"
          : "border-border bg-surface-2 text-muted-strong",
      )}
    >
      {on && live && (
        <motion.span
          layoutId={`glow-${id}`}
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-accent/50"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      <div className="text-xs font-medium">{title}</div>
      {sub && <div className="metric text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

function Arrow({ vertical = true, active }: { vertical?: boolean; active?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto my-1 shrink-0",
        vertical ? "h-5 w-px" : "h-px w-5",
        active ? "bg-accent" : "bg-border-strong",
      )}
    />
  );
}

export function PipelineDiagram({
  activeStage = null,
  live = false,
  className,
}: {
  activeStage?: GenerationStatus | null;
  live?: boolean;
  className?: string;
}) {
  const active = new Set<NodeId>(activeStage ? STAGE_NODES[activeStage] : []);

  return (
    <div className={cn("panel p-5", className)}>
      <div className="mx-auto flex max-w-md flex-col items-stretch">
        <Node id="browser" title="Browser" sub="Next.js UI" active={active} live={live} />
        <Arrow active={active.has("next")} />
        <Node id="next" title="Next.js" sub="App Router · SSR" active={active} live={live} />
        <Arrow active={active.has("fastapi")} />

        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <Node id="fastapi" title="FastAPI gateway" sub="validation · streaming" active={active} live={live} />
          <div className="flex flex-col gap-1.5">
            <Node id="queue" title="Job Queue" sub="1 worker" active={active} live={live} />
            <Node id="sqlite" title="SQLite" active={active} live={live} />
            <Node id="gpumetrics" title="GPU Metrics" sub="nvidia-smi" active={active} live={live} />
          </div>
        </div>

        <Arrow active={active.has("comfyui")} />
        <Node id="comfyui" title="ComfyUI" sub="127.0.0.1:8188" active={active} live={live} />
        <Arrow active={active.has("wan")} />
        <Node id="wan" title="Wan 2.2 TI2V 5B" sub="video diffusion" active={active} live={live} />
        <Arrow active={active.has("rtx")} />
        <Node id="rtx" title="RTX 3070" sub="8 GB · low-VRAM" active={active} live={live} />
        <Arrow active={active.has("mp4")} />
        <Node id="mp4" title="MP4 output" sub="→ streamed to browser" active={active} live={live} />
      </div>
    </div>
  );
}
