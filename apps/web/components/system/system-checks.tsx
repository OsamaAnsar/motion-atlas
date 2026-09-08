"use client";

import * as React from "react";
import { Check, Minus, X } from "lucide-react";

import { config } from "@/lib/config";
import { useBootstrap } from "@/hooks/use-bootstrap";
import { useGpuPolling } from "@/hooks/use-gpu-polling";
import { useStore } from "@/lib/store";
import { Container, Eyebrow } from "@/components/primitives";
import { cn } from "@/lib/utils";

type CheckState = "pass" | "warn" | "fail";
interface Diag {
  label: string;
  state: CheckState;
  detail: string;
}

export function SystemChecks() {
  useBootstrap();
  useGpuPolling(3000);
  const health = useStore((s) => s.health);
  const gpu = useStore((s) => s.gpu);
  const demo = config.demoMode;
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  const checks: Diag[] = [
    {
      label: `${config.gpuName.replace("NVIDIA GeForce ", "")} detected`,
      state: demo ? "pass" : gpu?.available ? "pass" : "fail",
      detail: demo ? "simulated device" : gpu?.available ? gpu.name : "nvidia-smi returned nothing",
    },
    {
      label: "CUDA available",
      state: demo ? "pass" : gpu?.available ? "pass" : "fail",
      detail: demo ? "simulated" : gpu?.available ? "driver responding" : "unavailable",
    },
    {
      label: "Backend API",
      state: health?.api === "online" ? "pass" : demo ? "pass" : "fail",
      detail: demo ? "demo provider (in-browser)" : (health?.api ?? "unknown"),
    },
    {
      label: "ComfyUI online",
      state: demo ? "warn" : health?.comfyui === "online" ? "pass" : "fail",
      detail: demo
        ? "not required in demo mode"
        : `${config.comfyuiUrl} → ${health?.comfyui ?? "unknown"}`,
    },
    {
      label: "Workflow loaded",
      state: demo ? "warn" : health?.workflowsLoaded ? "pass" : "fail",
      detail: demo
        ? "add comfy/workflows/wan22_t2v.json for real mode"
        : health?.workflowsLoaded
          ? "wan22_t2v.json parsed"
          : "missing",
    },
    {
      label: "Output directory writable",
      state: demo ? "pass" : health?.workflowsLoaded ? "pass" : "warn",
      detail: demo ? "in-memory (no files written)" : "storage/generations",
    },
  ];

  const blocking = checks.filter((c) => c.state === "fail").length;
  const status = demo ? "ready-demo" : blocking === 0 ? "ready" : "blocked";

  return (
    <Container className="py-8">
      <div className="mb-6">
        <Eyebrow>System</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Local diagnostics</h1>
        <p className="mt-1 text-sm text-muted">
          Terminal equivalent: <span className="metric">node scripts/check-system.mjs</span>
        </p>
      </div>

      <div className="panel overflow-hidden">
        <ul className="divide-y divide-border">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 px-4 py-3">
              <Glyph state={ready ? c.state : "warn"} />
              <div className="flex-1">
                <p className="text-sm text-foreground">{c.label}</p>
                <p className="metric text-xs text-muted">{ready ? c.detail : "checking…"}</p>
              </div>
            </li>
          ))}
        </ul>
        <div
          className={cn(
            "flex items-center gap-2 border-t px-4 py-3 text-sm font-medium",
            status === "blocked"
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-success/30 bg-success/10 text-success",
          )}
        >
          {status === "blocked" ? (
            <>
              <X className="size-4" /> NOT READY — resolve the failing checks
            </>
          ) : status === "ready-demo" ? (
            <>
              <Check className="size-4" /> READY TO GENERATE · Demo Mode
            </>
          ) : (
            <>
              <Check className="size-4" /> READY TO GENERATE
            </>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        {demo
          ? "Demo mode simulates the pipeline end-to-end. Set NEXT_PUBLIC_DEMO_MODE=false and DEMO_MODE=false, then follow docs/comfyui-setup.md for real generation."
          : "All checks read from GET /api/health and GET /api/gpu."}
      </p>
    </Container>
  );
}

function Glyph({ state }: { state: CheckState }) {
  if (state === "pass")
    return (
      <span className="grid size-5 place-items-center rounded-full border border-success/50 bg-success/15 text-success">
        <Check className="size-3" />
      </span>
    );
  if (state === "fail")
    return (
      <span className="grid size-5 place-items-center rounded-full border border-danger/50 bg-danger/15 text-danger">
        <X className="size-3" />
      </span>
    );
  return (
    <span className="grid size-5 place-items-center rounded-full border border-warning/50 bg-warning/15 text-warning">
      <Minus className="size-3" />
    </span>
  );
}
