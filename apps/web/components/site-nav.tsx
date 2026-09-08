"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github } from "lucide-react";

import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { GpuStatusIndicator } from "@/components/gpu-status-indicator";

const LINKS = [
  { href: "/generate", label: "Generate" },
  { href: "/gallery", label: "Gallery" },
  { href: "/gpu", label: "GPU" },
  { href: "/architecture", label: "Architecture" },
  { href: "/system", label: "System" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <AtlasMark />
          <span className="text-sm font-semibold tracking-tight">Motion Atlas</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <GpuStatusIndicator className="hidden sm:inline-flex" />
          <a
            href={config.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted transition-colors hover:text-foreground"
            aria-label="GitHub repository"
          >
            <Github className="size-4" />
          </a>
        </div>
      </div>

      {/* mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1 text-sm",
                active ? "bg-surface-2 text-foreground" : "text-muted",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function AtlasMark() {
  return (
    <span className="grid size-7 place-items-center rounded-md border border-accent/40 bg-accent/10">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M2 11L6 3l1.6 3.4M12 11L8.5 3.7M4 9h6"
          stroke="currentColor"
          className="text-accent-strong"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
