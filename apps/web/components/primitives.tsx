import { cn } from "@/lib/utils";

/** Page width wrapper. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 md:px-8", className)}>{children}</div>;
}

/** Small uppercase section eyebrow. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Labelled metric tile — mono value, optional unit and hint. */
export function Stat({
  label,
  value,
  unit,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("panel-2 flex flex-col gap-1 p-4", className)}>
      <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">{label}</span>
      <span
        className={cn(
          "metric text-xl leading-none",
          accent ? "text-accent-strong" : "text-foreground",
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-sm text-muted">{unit}</span> : null}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

/** key → value row, mono value. */
export function KeyValue({
  k,
  children,
  className,
}: {
  k: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <span className="text-sm text-muted">{k}</span>
      <span className="metric text-sm text-foreground text-right">{children}</span>
    </div>
  );
}

export function StatusDot({
  tone,
  className,
}: {
  tone: "success" | "warning" | "danger" | "muted" | "accent";
  className?: string;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : tone === "accent"
            ? "text-accent"
            : "text-muted";
  return <span className={cn("dot", color, className)} aria-hidden />;
}
