import { config } from "@/lib/config";

export function DemoModeBanner() {
  if (!config.demoMode) return null;
  return (
    <div className="border-b border-accent/20 bg-accent/[0.07] text-accent-strong">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-1.5 text-xs md:px-8">
        <span className="dot text-accent" aria-hidden />
        <span className="font-medium">Demo Mode</span>
        <span className="text-accent-strong/70">
          — simulated inference pipeline. No GPU or ComfyUI required. Numbers are illustrative, not
          measured.
        </span>
      </div>
    </div>
  );
}
