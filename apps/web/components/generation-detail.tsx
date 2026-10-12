"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Shuffle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { config } from "@/lib/config";
import {
  formatDurationLong,
  formatRelativeDate,
  formatVram,
  modeLabel,
  stageLabel,
} from "@/lib/format";
import { getProvider } from "@/lib/provider/factory";
import { remixHref } from "@/lib/remix";
import { useStore } from "@/lib/store";
import { type GenerationJob, isTerminal } from "@/lib/types";
import { Container, Eyebrow, KeyValue } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SyntheticClip } from "@/components/generate/synthetic-clip";
import { GenerationTimeline } from "@/components/generate/generation-timeline";
import { MetricChart } from "@/components/gpu/metric-chart";

export function GenerationDetail({ id }: { id: string }) {
  const router = useRouter();
  const remove = useStore((s) => s.remove);
  const [job, setJob] = React.useState<GenerationJob | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const load = () =>
      getProvider()
        .getGeneration(id)
        .then((j) => alive && setJob(j))
        .catch(() => alive && setNotFound(true));
    void load();
    const timer = setInterval(() => {
      if (!alive) return;
      setJob((cur) => {
        if (cur && !isTerminal(cur.status)) void load();
        return cur;
      });
    }, 1200);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  if (notFound) {
    return (
      <Container className="py-16 text-center">
        <p className="text-sm text-muted">Generation not found.</p>
        <Link href="/gallery" className="mt-2 inline-block text-sm text-accent hover:underline">
          Back to gallery
        </Link>
      </Container>
    );
  }

  if (!job) {
    return (
      <Container className="py-8">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Container>
    );
  }

  const s = job.settings;
  const done = job.status === "completed";
  const utilData = job.gpuSamples.map((p) => ({ t: p.t, value: p.utilization }));
  const vramData = job.gpuSamples.map((p) => ({ t: p.t, value: p.memoryUsedMb / 1024 }));

  return (
    <Container className="py-8">
      <Link
        href="/gallery"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Gallery
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Generation</Eyebrow>
          <h1 className="metric mt-1 text-lg text-foreground">{job.id}</h1>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
            <Badge variant={done ? "success" : isTerminal(job.status) ? "danger" : "accent"}>
              {stageLabel(job.status)}
            </Badge>
            {modeLabel(job.mode)} · {formatRelativeDate(job.completedAt ?? job.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            asChild
            title="Open the generator with these settings and a new seed"
          >
            <Link href={remixHref(job, "new")}>
              <Shuffle /> Remix
            </Link>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            asChild
            title="Open the generator with these settings and the same seed"
          >
            <Link href={remixHref(job, "same")}>
              <Shuffle /> Remix, same seed
            </Link>
          </Button>
          {done && job.outputUrl && (
            <Button size="sm" variant="secondary" asChild>
              <a href={job.outputUrl} download={`motion-atlas-${s.seed}.mp4`}>
                <Download /> MP4
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              await remove(job.id);
              toast.success("Generation deleted");
              router.push("/gallery");
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-4">
          <div className="panel overflow-hidden">
            <div className="aspect-video w-full bg-black">
              {job.outputUrl ? (
                <video
                  src={job.outputUrl}
                  poster={job.posterUrl ?? undefined}
                  className="h-full w-full object-cover"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <SyntheticClip seed={s.seed} playing aspect={16 / 9} />
              )}
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="mb-2 text-sm font-semibold">Prompt</h3>
            <p className="text-sm text-muted-strong">{job.prompt}</p>
            {job.negativePrompt && (
              <>
                <h3 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  Negative
                </h3>
                <p className="text-sm text-muted">{job.negativePrompt}</p>
              </>
            )}
          </div>

          {job.gpuSamples.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="panel p-4">
                <h3 className="mb-2 text-sm font-semibold">GPU utilization</h3>
                <MetricChart data={utilData} unit="%" domain={[0, 100]} color="#7c9cff" height={140} />
              </div>
              <div className="panel p-4">
                <h3 className="mb-2 text-sm font-semibold">VRAM</h3>
                <MetricChart
                  data={vramData}
                  unit=" GB"
                  domain={[0, 8]}
                  color="#3fb950"
                  height={140}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <h3 className="mb-2 text-sm font-semibold">Settings</h3>
            <div className="divide-y divide-border">
              <KeyValue k="Model">{config.modelName}</KeyValue>
              <KeyValue k="Mode">{modeLabel(job.mode)}</KeyValue>
              <KeyValue k="Resolution">
                {s.width} × {s.height}
              </KeyValue>
              <KeyValue k="Frames">{s.frames}</KeyValue>
              <KeyValue k="FPS">{s.fps}</KeyValue>
              <KeyValue k="Seed">{s.seed}</KeyValue>
              <KeyValue k="Steps">{s.steps}</KeyValue>
              <KeyValue k="Guidance">{s.guidance}</KeyValue>
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="mb-2 text-sm font-semibold">Technical</h3>
            <div className="divide-y divide-border">
              <KeyValue k="prompt_id">
                <span className="text-muted">{job.promptId ?? "—"}</span>
              </KeyValue>
              <KeyValue k="Generation time">
                {job.generationSeconds != null ? formatDurationLong(job.generationSeconds) : "—"}
              </KeyValue>
              <KeyValue k="Peak VRAM">
                {job.peakVramMb != null ? formatVram(job.peakVramMb) : "—"}
              </KeyValue>
              <KeyValue k="Avg GPU util">
                {job.averageGpuUtilization != null ? `${job.averageGpuUtilization}%` : "—"}
              </KeyValue>
              <KeyValue k="GPU">{config.gpuName.replace("NVIDIA GeForce ", "")}</KeyValue>
              <KeyValue k="Source">{job.demo ? "Demo (simulated)" : "ComfyUI + Wan 2.2"}</KeyValue>
            </div>
          </div>

          <GenerationTimeline job={job} />
        </div>
      </div>
    </Container>
  );
}
