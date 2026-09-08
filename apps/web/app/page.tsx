import Link from "next/link";
import { Activity, ArrowRight, Boxes, Gauge, ImagePlay, Radio } from "lucide-react";

import { config } from "@/lib/config";
import { Container, Eyebrow } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion/fade-in";
import { HeroPreview } from "@/components/home/hero-preview";
import { PipelineDiagram } from "@/components/architecture/pipeline-diagram";

const STATS = [
  { label: "Model", value: config.modelName },
  { label: "Runtime", value: config.runtime },
  { label: "GPU", value: config.gpuName.replace("NVIDIA GeForce ", "") + " 8GB" },
  { label: "Hosting", value: config.hosting },
  { label: "Status", value: config.demoMode ? "Demo" : "Online" },
];

const FEATURES = [
  {
    icon: Radio,
    title: "Live inference telemetry",
    body: "Stage, per-step progress, and elapsed time streamed over a WebSocket — the same shape ComfyUI reports.",
  },
  {
    icon: Gauge,
    title: "GPU dashboard",
    body: "Utilization, VRAM, temperature and power sampled every 2s with a rolling 5-minute history.",
  },
  {
    icon: Boxes,
    title: "FIFO job queue",
    body: "One generation on the GPU at a time. Everything else waits in line with a visible position.",
  },
  {
    icon: ImagePlay,
    title: "Image-to-video",
    body: "Upload a first frame, validate it client- and server-side, and animate it with a prompt.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <Container className="relative grid gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <FadeIn>
            <Badge variant="accent" className="mb-4">
              <span className="dot text-accent" /> Open-source · Self-hosted
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              <span className="text-gradient">Motion Atlas</span>
            </h1>
            <p className="mt-3 text-lg text-muted-strong">
              Open-source AI video generation, running on your own GPU.
            </p>
            <p className="mt-3 max-w-xl text-sm text-muted">
              Turn prompts and images into video using a self-hosted video diffusion model — with
              technical visibility into the inference process that Runway, Kling, Luma and Pika keep
              hidden.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/generate">
                  Generate Video <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/architecture">See Architecture</Link>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <HeroPreview />
          </FadeIn>
        </Container>
      </section>

      {/* Tech stats */}
      <section className="border-b border-border">
        <Container className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-5">
              <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted">
                {s.label}
              </div>
              <div className="metric mt-1 text-sm text-foreground">{s.value}</div>
            </div>
          ))}
        </Container>
      </section>

      {/* Features */}
      <section className="py-16">
        <Container>
          <FadeIn>
            <Eyebrow>Technical visibility</Eyebrow>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              See what happens during inference
            </h2>
          </FadeIn>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.05}>
                <div className="panel h-full p-5">
                  <f.icon className="size-5 text-accent" />
                  <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted">{f.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </Container>
      </section>

      {/* Pipeline */}
      <section className="border-t border-border py-16">
        <Container className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <FadeIn>
            <Eyebrow>Architecture</Eyebrow>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              A controlled path from prompt to MP4
            </h2>
            <p className="mt-3 text-sm text-muted">
              The browser never touches ComfyUI. FastAPI is the only gateway — it validates every
              request against the RTX 3070&rsquo;s limits, queues it, submits a known-good workflow,
              tracks execution over ComfyUI&rsquo;s WebSocket, and streams progress back.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm">
              <Activity className="size-4 text-accent" />
              <Link href="/architecture" className="text-accent hover:underline">
                Full architecture breakdown
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <PipelineDiagram />
          </FadeIn>
        </Container>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <Container className="flex flex-col items-center gap-4 py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Your own AI video engine</h2>
          <p className="max-w-lg text-sm text-muted">
            {config.demoMode
              ? "You're in demo mode — the full pipeline is simulated so you can explore every screen without a GPU."
              : "Connected to a local ComfyUI + Wan 2.2 runtime."}
          </p>
          <Button asChild size="lg">
            <Link href="/generate">
              Start generating <ArrowRight />
            </Link>
          </Button>
        </Container>
      </section>
    </div>
  );
}
