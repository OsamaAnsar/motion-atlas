"use client";

import * as React from "react";
import { Check, Loader2, Undo2, WandSparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CAMERA_OPTIONS, LIGHTING_OPTIONS, STYLE_OPTIONS, normalizeWhitespace } from "@/lib/prompt/enhance";
import { getProvider } from "@/lib/provider/factory";
import { useStore } from "@/lib/store";
import type {
  CameraMove,
  LightingPreset,
  PromptEnhanceRequest,
  PromptEnhanceResult,
  PromptStyle,
  SegmentCategory,
  SkipReason,
} from "@/lib/types";

const CATEGORY_LABEL: Record<SegmentCategory, string> = {
  style: "Style",
  camera: "Camera",
  lighting: "Lighting",
  continuity: "Continuity",
};

const SKIP_COPY: Record<SkipReason, string> = {
  already_specified: "already in your prompt",
  too_long: "left out to stay under the length cap",
};

/**
 * "Enhance" control for the prompt field: previews what the rule-based enhancer
 * would append (before / after), then Accept applies it and Undo reverts it.
 * Rule-based means fixed text rules, not a language model.
 */
export function PromptEnhancer() {
  const prompt = useStore((s) => s.form.prompt);
  const mode = useStore((s) => s.form.mode);
  const setForm = useStore((s) => s.setForm);

  const [open, setOpen] = React.useState(false);
  const [style, setStyle] = React.useState<PromptStyle | "auto">("auto");
  const [camera, setCamera] = React.useState<CameraMove | "none">("none");
  const [lighting, setLighting] = React.useState<LightingPreset | "none">("none");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PromptEnhanceResult | null>(null);
  const [undo, setUndo] = React.useState<{ previous: string; applied: string } | null>(null);

  const promptRef = React.useRef(prompt);
  promptRef.current = prompt;
  const runId = React.useRef(0);

  const blank = normalizeWhitespace(prompt) === "";

  const run = React.useCallback(async () => {
    const id = ++runId.current;
    const request: PromptEnhanceRequest = {
      prompt: promptRef.current,
      mode,
      ...(style !== "auto" ? { style } : {}),
      ...(camera !== "none" ? { camera } : {}),
      ...(lighting !== "none" ? { lighting } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      const next = await getProvider().enhancePrompt(request);
      if (id === runId.current) setResult(next);
    } catch (err) {
      if (id === runId.current) {
        setResult(null);
        setError(err instanceof Error ? err.message : "Could not enhance the prompt.");
      }
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }, [mode, style, camera, lighting]);

  // Preview whenever the panel opens or an option changes (not on every keystroke).
  React.useEffect(() => {
    if (open) void run();
  }, [open, run]);

  const stale = result !== null && result.original !== normalizeWhitespace(prompt);
  const changed = result !== null && result.enhanced !== prompt;
  const canUndo = undo !== null && undo.applied === prompt;

  function accept() {
    if (!result) return;
    setUndo({ previous: prompt, applied: result.enhanced });
    setForm({ prompt: result.enhanced });
    setOpen(false);
    setResult(null);
  }

  function revert() {
    if (!undo) return;
    setForm({ prompt: undo.previous });
    setUndo(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={blank}
          aria-expanded={open}
          title={blank ? "Write a prompt first" : "Preview rule-based enhancement"}
          onClick={() => setOpen((o) => !o)}
        >
          <WandSparkles className="text-accent" />
          Enhance
        </Button>
        <Badge
          variant="outline"
          title="Deterministic text rules. It does not use a language model."
        >
          Rule-based, not AI
        </Badge>
        {canUndo && (
          <button
            type="button"
            onClick={revert}
            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            <Undo2 className="size-3" /> Enhanced. Undo
          </button>
        )}
      </div>

      {open && (
        <div className="panel-2 flex flex-col gap-3 p-3" aria-live="polite">
          <div className="grid grid-cols-3 gap-2">
            <OptionSelect
              label="Style"
              value={style}
              onChange={(v) => setStyle(v as PromptStyle | "auto")}
              options={[
                {
                  value: "auto",
                  label: mode === "image-to-video" ? "Auto (none)" : "Auto (cinematic)",
                },
                ...STYLE_OPTIONS,
              ]}
            />
            <OptionSelect
              label="Camera"
              value={camera}
              onChange={(v) => setCamera(v as CameraMove | "none")}
              options={CAMERA_OPTIONS}
            />
            <OptionSelect
              label="Lighting"
              value={lighting}
              onChange={(v) => setLighting(v as LightingPreset | "none")}
              options={LIGHTING_OPTIONS}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          {result && (
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Before
                </span>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-strong">
                  {prompt}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  After
                </span>
                <p className="mt-0.5 break-words text-sm text-foreground">
                  <AfterText result={result} />
                </p>
              </div>

              {result.segments.length === 0 && (
                <p className="text-xs text-muted">
                  Nothing to add{result.skipped.length > 0 ? "." : ": every option is off."}
                </p>
              )}
              {result.skipped.length > 0 && (
                <ul className="text-[11px] text-muted">
                  {result.skipped.map((s) => (
                    <li key={s.category}>
                      {CATEGORY_LABEL[s.category]}: {SKIP_COPY[s.reason]}.
                    </li>
                  ))}
                </ul>
              )}
              <p className="metric text-[11px] text-muted">
                {Array.from(result.enhanced).length} / {result.maxChars} chars (heuristic cap)
              </p>
              {stale && (
                <p className="text-xs text-warning">
                  The prompt changed since this preview.{" "}
                  <button type="button" onClick={() => void run()} className="underline">
                    Refresh
                  </button>
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {busy && <Loader2 className="size-4 animate-spin text-muted" />}
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              <X /> Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={accept}
              disabled={!result || stale || !changed || busy}
            >
              <Check /> Accept
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The enhanced text with the appended part highlighted. */
function AfterText({ result }: { result: PromptEnhanceResult }) {
  // `enhanced` is always `original` followed by the appended segments.
  const head = result.enhanced.startsWith(result.original) ? result.original : "";
  const tail = result.enhanced.slice(head.length);
  return (
    <>
      <span>{head}</span>
      {tail && <span className="rounded bg-accent/15 px-0.5 text-accent-strong">{tail}</span>}
    </>
  );
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-[11px]">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
