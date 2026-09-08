"use client";

import * as React from "react";
import { Copy, Download, ImageIcon, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { config } from "@/lib/config";
import { stageHint, stageLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { type GenerationJob, isTerminal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SyntheticClip } from "./synthetic-clip";
import { downloadBlob, recordCanvasToWebm } from "./clip-recorder";

export function StageView({
  job,
  onViewMetadata,
}: {
  job: GenerationJob | null;
  onViewMetadata?: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [recording, setRecording] = React.useState(false);
  const setForm = useStore((s) => s.setForm);
  const resetActive = useStore((s) => s.setActive);

  const aspect = job ? job.settings.width / job.settings.height : 16 / 9;
  const running = job ? !isTerminal(job.status) : false;
  const done = job?.status === "completed";
  const failed = job?.status === "failed";
  const cancelled = job?.status === "cancelled";

  async function handleDownload() {
    if (!job) return;
    if (job.outputUrl) {
      const a = document.createElement("a");
      a.href = job.outputUrl;
      a.download = `motion-atlas-${job.settings.seed}.mp4`;
      a.click();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("Nothing to download yet.");
      return;
    }
    setRecording(true);
    toast.info("Recording the clip…", { description: "Capturing ~3s of the synthetic output." });
    try {
      const blob = await recordCanvasToWebm(canvas, 3200);
      if (!blob) {
        toast.error("This browser can't record the canvas.", {
          description: "Run scripts/make-demo-video.mjs for a bundled MP4 instead.",
        });
        return;
      }
      downloadBlob(blob, `motion-atlas-${job.settings.seed}.webm`);
      toast.success("Downloaded", { description: `motion-atlas-${job.settings.seed}.webm` });
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div
        className="relative w-full bg-black"
        style={{ aspectRatio: `${Math.round(aspect * 1000)} / 1000` }}
      >
        {/* base layer */}
        {job ? (
          job.outputUrl && (done || running) ? (
            <video
              key={job.outputUrl}
              src={job.outputUrl}
              poster={job.posterUrl ?? undefined}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              controls={done}
            />
          ) : (
            <SyntheticClip ref={canvasRef} seed={job.settings.seed} playing aspect={aspect} />
          )
        ) : (
          <EmptyStage />
        )}

        {/* running overlay */}
        {running && job && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 backdrop-blur-[1px]">
            <div className="scanline pointer-events-none absolute inset-0" />
            <Loader2 className="size-5 animate-spin text-accent-strong" />
            <p className="metric text-sm text-foreground">{stageLabel(job.status)}</p>
            <p className="text-xs text-muted">{stageHint(job.status)}</p>
          </div>
        )}

        {/* failure overlay */}
        {(failed || cancelled) && job && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 px-6 text-center">
            <TriangleAlert className={cn("size-5", failed ? "text-danger" : "text-warning")} />
            <p className="text-sm font-medium text-foreground">
              {failed ? "Generation failed" : "Generation cancelled"}
            </p>
            {job.error && <p className="text-xs text-muted">{job.error}</p>}
          </div>
        )}

        {/* mode badge */}
        {job && (
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge variant={done ? "success" : running ? "accent" : "default"}>
              {job.mode === "text-to-video" ? "T2V" : "I2V"}
            </Badge>
            {job.demo && <Badge variant="outline">demo</Badge>}
          </div>
        )}

        <style>{`.scanline{background:repeating-linear-gradient(0deg,rgba(124,156,255,.06) 0 1px,transparent 1px 4px);animation:scan 6s linear infinite}@keyframes scan{to{background-position:0 240px}}`}</style>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
        <Button size="sm" variant="secondary" onClick={handleDownload} disabled={!done || recording}>
          {recording ? <Loader2 className="animate-spin" /> : <Download />}
          Download
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!job}
          onClick={() => {
            if (!job) return;
            void navigator.clipboard.writeText(job.prompt);
            toast.success("Prompt copied");
          }}
        >
          <Copy />
          Copy Prompt
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!job}
          onClick={() => {
            if (!job) return;
            setForm({
              mode: job.mode,
              prompt: job.prompt,
              negativePrompt: job.negativePrompt,
              width: job.settings.width,
              height: job.settings.height,
              frames: job.settings.frames,
              fps: job.settings.fps,
              steps: job.settings.steps,
              guidance: job.settings.guidance,
              seed: null,
            });
            resetActive(null);
            toast.success("Settings loaded into the form");
          }}
        >
          <RotateCcw />
          Generate Again
        </Button>
        <Button size="sm" variant="ghost" disabled={!done} onClick={onViewMetadata}>
          <ImageIcon />
          View Metadata
        </Button>
        {done && (
          <span className="metric ml-auto text-xs text-muted">
            seed {job?.settings.seed}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyStage() {
  return (
    <div className="grid-bg absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-lg border border-border bg-surface-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M4 15l4-7 2 3.5M15 15l-3.5-6M6 12h7"
              stroke="currentColor"
              className="text-accent"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="text-sm text-muted">Your generated video will appear here</p>
        <p className="text-xs text-muted/70">
          {config.modelName} · {config.gpuName.replace("NVIDIA GeForce ", "")}
        </p>
      </div>
    </div>
  );
}
