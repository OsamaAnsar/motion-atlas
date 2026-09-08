import { cn } from "@/lib/utils";

/**
 * Determinate bar. Pass `indeterminate` when the backend can't give a real
 * fraction yet (ComfyUI phases outside sampling) — never fake a percentage.
 */
export function Progress({
  value,
  indeterminate = false,
  className,
  barClassName,
}: {
  value: number; // 0..1
  indeterminate?: boolean;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-surface-3",
        className,
      )}
    >
      {indeterminate ? (
        <div className="absolute inset-y-0 left-0 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-accent/70" />
      ) : (
        <div
          className={cn("h-full rounded-full bg-accent transition-[width] duration-500 ease-out", barClassName)}
          style={{ width: `${pct}%` }}
        />
      )}
      <style>{`@keyframes indeterminate{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}`}</style>
    </div>
  );
}
