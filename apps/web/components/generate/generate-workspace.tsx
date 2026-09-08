"use client";

import { useBootstrap } from "@/hooks/use-bootstrap";
import { Container, Eyebrow } from "@/components/primitives";
import { GeneratorControls } from "./generator-controls";
import { GenerationPanel } from "./generation-panel";

export function GenerateWorkspace() {
  useBootstrap();

  return (
    <Container className="py-8">
      <div className="mb-6">
        <Eyebrow>Generator</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create a video</h1>
        <p className="mt-1 text-sm text-muted">
          Prompt or image in, MP4 out. Everything downstream of the button is streamed back live.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="panel h-fit p-5 lg:sticky lg:top-20">
          <GeneratorControls />
        </div>
        <GenerationPanel />
      </div>
    </Container>
  );
}
