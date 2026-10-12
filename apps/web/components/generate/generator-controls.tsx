"use client";

import * as React from "react";
import { ChevronDown, Dice5, Film, Loader2, Sparkles, Type, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/generate/image-upload";
import { PromptEnhancer } from "@/components/generate/prompt-enhancer";
import { RemixNotice } from "@/components/generate/remix-notice";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DURATIONS, FPS_OPTIONS, GUIDANCE_RANGE, LIMITS, RESOLUTIONS } from "@/lib/config";
import { EXAMPLE_PROMPT, PROMPT_PRESETS } from "@/lib/demo-data";
import { randomSeed } from "@/lib/provider/mock/synthetic";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function GeneratorControls({ onSubmitted }: { onSubmitted?: (jobId: string) => void }) {
  const form = useStore((s) => s.form);
  const setForm = useStore((s) => s.setForm);
  const setResolution = useStore((s) => s.setResolution);
  const submit = useStore((s) => s.submit);
  const submitting = useStore((s) => s.submitting);
  const formError = useStore((s) => s.formError);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const resKey = `${form.width}x${form.height}`;
  const seedMode: "random" | "custom" = form.seed == null ? "random" : "custom";

  async function handleGenerate() {
    const jobId = await submit();
    if (jobId) {
      toast.success("Generation queued", { description: "Streaming progress on the right." });
      onSubmitted?.(jobId);
    }
  }

  function applyPreset(suffix: string) {
    const base = form.prompt.trim().replace(/[,\s]+$/, "");
    setForm({ prompt: base ? `${base}, ${suffix}` : suffix });
  }

  return (
    <div className="flex flex-col gap-5">
      <RemixNotice />

      {/* Mode */}
      <Field label="Mode">
        <Segmented
          value={form.mode}
          onChange={(mode) => setForm({ mode })}
          options={[
            { value: "text-to-video", label: "Text to Video", icon: <Type className="size-3.5" /> },
            {
              value: "image-to-video",
              label: "Image to Video",
              icon: <Film className="size-3.5" />,
            },
          ]}
        />
      </Field>

      {form.mode === "image-to-video" && (
        <Field label="Input image">
          <ImageUpload />
        </Field>
      )}

      {/* Prompt */}
      <Field
        label="Prompt"
        aside={
          <button
            type="button"
            onClick={() => setForm({ prompt: EXAMPLE_PROMPT })}
            className="text-[11px] text-accent hover:underline"
          >
            use example
          </button>
        }
      >
        <Textarea
          value={form.prompt}
          onChange={(e) => setForm({ prompt: e.target.value })}
          placeholder={EXAMPLE_PROMPT}
          rows={4}
          className="font-sans"
        />
        <PromptEnhancer />
        <div className="flex flex-wrap gap-1.5">
          {PROMPT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.suffix)}
              className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Sparkles className="mr-1 inline size-3 text-accent/70" />
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Generation settings */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Resolution" className="col-span-2">
          <Select
            value={resKey}
            onValueChange={(v) => {
              const found = RESOLUTIONS.find((r) => `${r.width}x${r.height}` === v);
              if (found) setResolution(found.width, found.height);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={`${r.width}x${r.height}`} value={`${r.width}x${r.height}`}>
                  <span className="metric">{r.label}</span>
                  <span className="ml-2 text-xs text-muted">{r.note}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Duration">
          <Segmented
            value={String(form.frames)}
            onChange={(v) => setForm({ frames: Number(v) })}
            options={DURATIONS.map((d) => ({ value: String(d.frames), label: d.label }))}
          />
          <span className="text-[11px] text-muted">
            {form.frames} frames · {(form.frames / form.fps).toFixed(1)}s
          </span>
        </Field>

        <Field label="FPS">
          <Segmented
            value={String(form.fps)}
            onChange={(v) => setForm({ fps: Number(v) })}
            options={FPS_OPTIONS.map((f) => ({ value: String(f), label: String(f) }))}
          />
        </Field>

        <Field label="Seed" className="col-span-2">
          <div className="flex items-center gap-2">
            <Segmented
              className="w-[180px]"
              value={seedMode}
              onChange={(m) => setForm({ seed: m === "random" ? null : randomSeed() })}
              options={[
                { value: "random", label: "Random", icon: <Dice5 className="size-3.5" /> },
                { value: "custom", label: "Custom" },
              ]}
            />
            {seedMode === "custom" && (
              <Input
                type="number"
                min={0}
                value={form.seed ?? 0}
                onChange={(e) => setForm({ seed: Math.max(0, Math.floor(Number(e.target.value))) })}
                className="metric w-40"
              />
            )}
            {seedMode === "random" && (
              <span className="text-xs text-muted">A fresh seed is drawn per run and shown after.</span>
            )}
          </div>
        </Field>
      </div>

      {/* Advanced */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted-strong hover:text-foreground">
          <span className="flex items-center gap-2">
            <Wand2 className="size-4 text-accent/70" />
            Advanced settings
          </span>
          <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 flex flex-col gap-5">
          <Field label="Negative prompt" aside={<span className="text-[11px] text-muted">optional</span>}>
            <Textarea
              value={form.negativePrompt}
              onChange={(e) => setForm({ negativePrompt: e.target.value })}
              placeholder="low quality, watermark, text, jpeg artifacts, distorted"
              rows={2}
            />
          </Field>

          <Field
            label="Guidance (CFG)"
            aside={<span className="metric text-xs text-muted-strong">{form.guidance.toFixed(1)}</span>}
          >
            <Slider
              value={[form.guidance]}
              min={GUIDANCE_RANGE.min}
              max={GUIDANCE_RANGE.max}
              step={GUIDANCE_RANGE.step}
              onValueChange={([v]) => v != null && setForm({ guidance: v })}
            />
            <span className="text-[11px] text-muted">
              Model default ≈ {5}. Higher = follows the prompt more literally.
            </span>
          </Field>

          <Field
            label="Steps"
            aside={<span className="metric text-xs text-muted-strong">{form.steps}</span>}
          >
            <Slider
              value={[form.steps]}
              min={LIMITS.minSteps}
              max={LIMITS.maxSteps}
              step={1}
              onValueChange={([v]) => v != null && setForm({ steps: v })}
            />
            <span className="text-[11px] text-muted">
              Backend caps this at {LIMITS.maxSteps} for the RTX 3070.
            </span>
          </Field>
        </CollapsibleContent>
      </Collapsible>

      {/* Submit */}
      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={handleGenerate} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Generate Video
        </Button>
        {formError && <p className="text-xs text-danger">{formError}</p>}
        <p className="text-[11px] text-muted">
          One generation runs at a time on the GPU. Extra requests queue (max {LIMITS.maxQueueSize}).
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  aside,
  children,
  className,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {aside}
      </div>
      {children}
    </div>
  );
}
