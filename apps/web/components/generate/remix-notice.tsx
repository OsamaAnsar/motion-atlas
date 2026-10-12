"use client";

import { Shuffle, X } from "lucide-react";

import { useStore } from "@/lib/store";

/** Explains what a remix loaded, including anything it had to reject or adjust. */
export function RemixNotice() {
  const notice = useStore((s) => s.remixNotice);
  const dismiss = useStore((s) => s.dismissRemixNotice);
  const imageReady = useStore((s) => s.form.imageName !== null);

  if (!notice) return null;

  const seedText =
    notice.seedMode === "same" && notice.seed !== null
      ? `same seed (${notice.seed})`
      : "a new random seed";

  return (
    <div className="panel-2 flex items-start gap-2.5 border-accent/30 p-3 text-xs" role="status">
      <Shuffle className="mt-0.5 size-3.5 shrink-0 text-accent" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-foreground">
          Settings loaded from a previous generation, with {seedText}.
        </p>
        {notice.needsImage && !imageReady && (
          <p className="text-warning">
            This was an image-to-video generation. The source image is not carried over, so upload
            it again below (or switch to Text to Video).
          </p>
        )}
        {notice.warnings.map((w) => (
          <p key={w} className="text-muted-strong">
            {w}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="rounded p-1 text-muted hover:bg-surface-3 hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
