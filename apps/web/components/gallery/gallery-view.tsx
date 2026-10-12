"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { useBootstrap } from "@/hooks/use-bootstrap";
import { Container, Eyebrow } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MAX_SEARCH_CHARS,
  filterGallery,
  isDefaultQuery,
  parseGalleryQuery,
  toGalleryParams,
  type GalleryQuery,
  type SortKey,
} from "@/lib/gallery-filters";
import { useStore } from "@/lib/store";
import { isTerminal } from "@/lib/types";
import { GenerationCard } from "./generation-card";

const SEARCH_DEBOUNCE_MS = 250;

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  duration: "Longest video",
};

export function GalleryView() {
  useBootstrap();
  const history = useStore((s) => s.history);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  // The URL is the single source of truth for every filter.
  const query = React.useMemo(() => parseGalleryQuery(params), [params]);

  const setQuery = React.useCallback(
    (patch: Partial<GalleryQuery>) => {
      const next = toGalleryParams({ ...query, ...patch }).toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [query, router, pathname],
  );

  // The search box keeps its own text while typing and writes to the URL after a pause.
  const [text, setText] = React.useState(query.q);
  const lastPushed = React.useRef(query.q);
  React.useEffect(() => {
    // Back/forward navigation changed the URL: follow it (but not our own writes).
    if (query.q !== lastPushed.current) {
      lastPushed.current = query.q;
      setText(query.q);
    }
  }, [query.q]);
  React.useEffect(() => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean === query.q) return;
    const timer = setTimeout(() => {
      lastPushed.current = clean;
      setQuery({ q: clean });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, query.q, setQuery]);

  const finished = React.useMemo(() => history.filter((j) => isTerminal(j.status)), [history]);
  const shown = React.useMemo(() => filterGallery(finished, query), [finished, query]);
  const filtering = !isDefaultQuery(query) || text.trim() !== "";
  const total = `${finished.length} render${finished.length === 1 ? "" : "s"}`;

  function clearFilters() {
    setText("");
    lastPushed.current = "";
    router.replace(pathname, { scroll: false });
  }

  return (
    <Container className="py-8">
      <div className="mb-5">
        <Eyebrow>Gallery</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Previous generations</h1>
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {ready && filtering ? `${shown.length} of ${total}` : total} ·{" "}
          {SORT_LABELS[query.sort].toLowerCase()}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={text}
            maxLength={MAX_SEARCH_CHARS}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search prompts"
            aria-label="Search prompts"
            className="pl-9 pr-8 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Segmented
          size="sm"
          value={query.status}
          onChange={(status) => setQuery({ status })}
          options={[
            { value: "all", label: "All" },
            { value: "completed", label: "Completed" },
            { value: "failed", label: "Failed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />

        <Segmented
          size="sm"
          value={query.mode}
          onChange={(mode) => setQuery({ mode })}
          options={[
            { value: "all", label: "Any mode" },
            { value: "text-to-video", label: "T2V" },
            { value: "image-to-video", label: "I2V" },
          ]}
        />

        <Select value={query.sort} onValueChange={(sort) => setQuery({ sort: sort as SortKey })}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!ready ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="panel grid place-items-center p-16 text-center">
          {finished.length === 0 ? (
            <>
              <p className="text-sm text-muted">No generations yet.</p>
              <Link href="/generate" className="mt-2 text-sm text-accent hover:underline">
                Create your first video →
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">No generations match these filters.</p>
              <Button variant="link" size="sm" className="mt-1" onClick={clearFilters}>
                Clear filters
              </Button>
            </>
          )}
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
