import { cn } from "@/lib/utils";

/**
 * Entrance fade/rise. Pure CSS keyframe (see `.motion-fade-in` in globals.css):
 * the element's resting style is fully visible, so if the animation is throttled
 * or never runs the content still shows — unlike a JS `whileInView` that could
 * leave sections stuck at partial opacity. Honors `prefers-reduced-motion`.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn("motion-fade-in", className)} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
