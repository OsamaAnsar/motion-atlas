"use client";

import * as React from "react";

import { makeRng } from "@/lib/provider/mock/synthetic";
import { cn } from "@/lib/utils";

/**
 * A deterministic in-browser "clip" used as the demo output when no bundled MP4
 * is present. Parallax skyline + rain + camera drift. Same seed → same footage.
 * The <canvas> is exposed via ref so it can be recorded to WebM for download.
 */
export const SyntheticClip = React.forwardRef<
  HTMLCanvasElement,
  {
    seed: number;
    playing?: boolean;
    className?: string;
    aspect?: number;
  }
>(function SyntheticClip({ seed, playing = true, className, aspect = 16 / 9 }, ref) {
  const innerRef = React.useRef<HTMLCanvasElement | null>(null);
  const setRefs = (node: HTMLCanvasElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  React.useEffect(() => {
    const canvas = innerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 640;
    const H = Math.round(W / aspect);
    canvas.width = W;
    canvas.height = H;

    const rng = makeRng(seed || 1);
    const layers = [0.25, 0.5, 0.85].map((depth) => {
      const buildings = Array.from({ length: 22 }, () => ({
        x: rng() * W * 1.4,
        w: 14 + rng() * 46,
        h: (0.2 + rng() * 0.6) * H,
        lit: rng() > 0.5,
      }));
      return { depth, buildings, hue: 224 + rng() * 20 };
    });
    const drops = Array.from({ length: 180 }, () => ({
      x: rng() * W,
      y: rng() * H,
      len: 6 + rng() * 12,
      spd: 3 + rng() * 4,
    }));
    const stars = Array.from({ length: 60 }, () => ({ x: rng() * W, y: rng() * H * 0.6, a: rng() }));

    let raf = 0;
    let t = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      t += reduced ? 0 : 1;
      const drift = Math.sin(t * 0.004) * 26;

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0a0d1a");
      sky.addColorStop(0.55, "#141026");
      sky.addColorStop(1, "#221733");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        ctx.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(t * 0.02 + s.a * 10));
        ctx.fillStyle = "#cdd6ff";
        ctx.fillRect((s.x - drift * 0.1) % W, s.y, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;

      layers.forEach((layer, i) => {
        const off = (drift * layer.depth + t * layer.depth * 0.15) % (W * 1.4);
        layer.buildings.forEach((b) => {
          const x = ((b.x - off) % (W * 1.4)) - 40;
          const y = H - b.h;
          ctx.fillStyle = `hsl(${layer.hue} ${20 + i * 6}% ${6 + i * 4}%)`;
          ctx.fillRect(x, y, b.w, b.h);
          if (b.lit) {
            ctx.fillStyle = `hsla(${layer.hue - 10} 80% 70% / ${0.06 + i * 0.05})`;
            for (let wy = y + 6; wy < H - 6; wy += 10) {
              for (let wx = x + 4; wx < x + b.w - 4; wx += 8) {
                if ((wx + wy + Math.floor(t * 0.05)) % 3 === 0) ctx.fillRect(wx, wy, 3, 4);
              }
            }
          }
        });
      });

      // wet street glow
      const glow = ctx.createLinearGradient(0, H * 0.7, 0, H);
      glow.addColorStop(0, "rgba(124,156,255,0)");
      glow.addColorStop(1, "rgba(124,156,255,0.14)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, H * 0.7, W, H * 0.3);

      // rain
      ctx.strokeStyle = "rgba(180,200,255,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of drops) {
        if (!reduced) {
          d.y += d.spd;
          d.x += 1.2;
          if (d.y > H) {
            d.y = -d.len;
            d.x = rng() * W;
          }
        }
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1.5, d.y + d.len);
      }
      ctx.stroke();

      // vignette
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // grain
      ctx.globalAlpha = 0.04;
      for (let i = 0; i < 80; i += 1) {
        ctx.fillStyle = rng() > 0.5 ? "#fff" : "#000";
        ctx.fillRect(rng() * W, rng() * H, 1, 1);
      }
      ctx.globalAlpha = 1;

      if (playing && !reduced) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [seed, playing, aspect]);

  return (
    <canvas
      ref={setRefs}
      className={cn("h-full w-full object-cover", className)}
      aria-label="Synthetic demo clip"
    />
  );
});
