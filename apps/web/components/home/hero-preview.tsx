"use client";

import { config } from "@/lib/config";
import { SyntheticClip } from "@/components/generate/synthetic-clip";

export function HeroPreview() {
  return (
    <div className="panel overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        <SyntheticClip seed={738214} playing aspect={16 / 9} />
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-[10px]">
          <div className="flex justify-between">
            <span className="metric rounded bg-black/50 px-1.5 py-0.5 text-accent-strong">
              ● REC · {config.modelName}
            </span>
            <span className="metric rounded bg-black/50 px-1.5 py-0.5 text-muted-strong">
              640×384 · 16fps
            </span>
          </div>
          <div className="flex justify-between">
            <span className="metric rounded bg-black/50 px-1.5 py-0.5 text-muted-strong">
              sampling 21/30
            </span>
            <span className="metric rounded bg-black/50 px-1.5 py-0.5 text-muted-strong">
              VRAM 7.4/8 GB · 71°C
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted">
        <span className="metric">seed 738214</span>
        <span>Synthetic preview · your renders replace this</span>
      </div>
    </div>
  );
}
