import { config } from "@/lib/config";
import { formatDurationLong, formatVram, modeLabel } from "@/lib/format";
import { KeyValue } from "@/components/primitives";
import type { GenerationJob } from "@/lib/types";

export function MetadataPanel({ job }: { job: GenerationJob }) {
  const s = job.settings;
  return (
    <div className="panel p-4">
      <h3 className="mb-2 text-sm font-semibold">Generation metadata</h3>
      <div className="divide-y divide-border">
        <KeyValue k="Model">{config.modelName}</KeyValue>
        <KeyValue k="Mode">{modeLabel(job.mode)}</KeyValue>
        <KeyValue k="Resolution">
          {s.width} × {s.height}
        </KeyValue>
        <KeyValue k="Frames">
          {s.frames} <span className="text-muted">({(s.frames / s.fps).toFixed(1)}s)</span>
        </KeyValue>
        <KeyValue k="FPS">{s.fps}</KeyValue>
        <KeyValue k="Seed">{s.seed}</KeyValue>
        <KeyValue k="Steps">{s.steps}</KeyValue>
        <KeyValue k="Guidance">{s.guidance}</KeyValue>
        <KeyValue k="Generation time">
          {job.generationSeconds != null ? formatDurationLong(job.generationSeconds) : "—"}
        </KeyValue>
        <KeyValue k="GPU">{config.gpuName.replace("NVIDIA GeForce ", "")}</KeyValue>
        <KeyValue k="Peak VRAM">
          {job.peakVramMb != null ? formatVram(job.peakVramMb) : "—"}
        </KeyValue>
        <KeyValue k="Avg GPU util">
          {job.averageGpuUtilization != null ? `${job.averageGpuUtilization}%` : "—"}
        </KeyValue>
        <KeyValue k="prompt_id">
          <span className="text-muted">{job.promptId ?? "—"}</span>
        </KeyValue>
      </div>
    </div>
  );
}
