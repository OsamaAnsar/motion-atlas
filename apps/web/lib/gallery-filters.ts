/**
 * Gallery search, filter and sort. Pure functions over `GenerationJob[]`, so the
 * same code serves the in-browser MockProvider and the API.
 *
 * Filtering is done client-side: the list endpoint returns at most the 60 most
 * recent generations, which is cheap to filter in memory, and it keeps both
 * providers on one code path with no new API surface. The state lives in the URL
 * query string (`?q=fox&status=failed&mode=image-to-video&sort=duration`);
 * defaults are omitted so the plain gallery URL stays clean.
 */

import type { GenerationJob } from "@/lib/types";

export const STATUS_FILTERS = ["all", "completed", "failed", "cancelled"] as const;
export const MODE_FILTERS = ["all", "text-to-video", "image-to-video"] as const;
export const SORT_KEYS = ["newest", "oldest", "duration"] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type ModeFilter = (typeof MODE_FILTERS)[number];
export type SortKey = (typeof SORT_KEYS)[number];

export interface GalleryQuery {
  /** Free text; every whitespace-separated term must appear in the prompt. */
  q: string;
  status: StatusFilter;
  mode: ModeFilter;
  /** `duration` = video length (frames / fps), longest first. */
  sort: SortKey;
}

export const MAX_SEARCH_CHARS = 200;

export const DEFAULT_QUERY: GalleryQuery = {
  q: "",
  status: "all",
  mode: "all",
  sort: "newest",
};

function oneOf<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function cleanSearch(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_CHARS);
}

/** Parse a query string. Unknown or invalid values fall back to the defaults. */
export function parseGalleryQuery(params: Pick<URLSearchParams, "get">): GalleryQuery {
  return {
    q: cleanSearch(params.get("q") ?? ""),
    status: oneOf(STATUS_FILTERS, params.get("status"), DEFAULT_QUERY.status),
    mode: oneOf(MODE_FILTERS, params.get("mode"), DEFAULT_QUERY.mode),
    sort: oneOf(SORT_KEYS, params.get("sort"), DEFAULT_QUERY.sort),
  };
}

/** Serialise a query, leaving defaults out. */
export function toGalleryParams(query: GalleryQuery): URLSearchParams {
  const params = new URLSearchParams();
  const q = cleanSearch(query.q);
  if (q) params.set("q", q);
  if (query.status !== DEFAULT_QUERY.status) params.set("status", query.status);
  if (query.mode !== DEFAULT_QUERY.mode) params.set("mode", query.mode);
  if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort);
  return params;
}

export function isDefaultQuery(query: GalleryQuery): boolean {
  return toGalleryParams(query).toString() === "";
}

const when = (job: GenerationJob) => job.completedAt ?? job.createdAt;
const videoSeconds = (job: GenerationJob) => job.settings.frames / job.settings.fps;

/** Search, filter and sort. Does not mutate `jobs`. */
export function filterGallery(
  jobs: readonly GenerationJob[],
  query: GalleryQuery,
): GenerationJob[] {
  const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean);

  const kept = jobs.filter((job) => {
    if (query.status !== "all" && job.status !== query.status) return false;
    if (query.mode !== "all" && job.mode !== query.mode) return false;
    if (terms.length > 0) {
      const haystack = job.prompt.toLowerCase();
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });

  const byNewest = (a: GenerationJob, b: GenerationJob) =>
    when(b) - when(a) || a.id.localeCompare(b.id);

  switch (query.sort) {
    case "oldest":
      return kept.sort((a, b) => when(a) - when(b) || a.id.localeCompare(b.id));
    case "duration":
      return kept.sort((a, b) => videoSeconds(b) - videoSeconds(a) || byNewest(a, b));
    case "newest":
      return kept.sort(byNewest);
  }
}
