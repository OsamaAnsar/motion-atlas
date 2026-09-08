"use client";

import * as React from "react";

import { useBootstrap } from "@/hooks/use-bootstrap";
import { Container, Eyebrow } from "@/components/primitives";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/lib/store";
import { isTerminal } from "@/lib/types";
import { GenerationCard } from "./generation-card";

type Filter = "all" | "text-to-video" | "image-to-video";

export function GalleryView() {
  useBootstrap();
  const history = useStore((s) => s.history);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  const completed = history.filter((j) => j.status === "completed" || isTerminal(j.status));
  const shown = completed.filter((j) => filter === "all" || j.mode === filter);

  return (
    <Container className="py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Gallery</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Previous generations</h1>
          <p className="mt-1 text-sm text-muted">
            {completed.length} render{completed.length === 1 ? "" : "s"} · newest first
          </p>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "text-to-video", label: "T2V" },
            { value: "image-to-video", label: "I2V" },
          ]}
        />
      </div>

      {!ready ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="panel grid place-items-center p-16 text-center">
          <p className="text-sm text-muted">No generations yet.</p>
          <a href="/generate" className="mt-2 text-sm text-accent hover:underline">
            Create your first video →
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((job) => (
            <GenerationCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </Container>
  );
}
