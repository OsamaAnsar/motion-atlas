import Link from "next/link";

import { config } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between md:px-8">
        <p>
          Motion Atlas — self-hosted AI video generation ·{" "}
          <span className="metric">{config.modelName}</span> on{" "}
          <span className="metric">{config.gpuName.replace("NVIDIA GeForce ", "")}</span>
        </p>
        <nav className="flex items-center gap-4">
          <Link href="/architecture" className="hover:text-foreground">
            Architecture
          </Link>
          <Link href="/system" className="hover:text-foreground">
            System
          </Link>
          <a href={config.githubUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
