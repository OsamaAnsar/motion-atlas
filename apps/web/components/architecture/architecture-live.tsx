"use client";

import { useBootstrap } from "@/hooks/use-bootstrap";
import { stageLabel } from "@/lib/format";
import { activeJob, useStore } from "@/lib/store";
import { isTerminal } from "@/lib/types";
import { PipelineDiagram } from "./pipeline-diagram";

export function ArchitectureLive() {
  useBootstrap();
  const job = useStore(activeJob);
  const live = job ? !isTerminal(job.status) : false;

  return (
    <div className="flex flex-col gap-2">
      <PipelineDiagram activeStage={job?.status ?? null} live={live} />
      <p className="text-center text-xs text-muted">
        {live
          ? `Active generation — ${stageLabel(job!.status)}. Highlighted nodes are on the hot path.`
          : "Start a generation to watch the active path light up here."}
      </p>
    </div>
  );
}
