/**
 * "Recent prompts": the last few distinct prompts submitted from this browser.
 * Stored only in this browser's localStorage (never sent anywhere), through the
 * guarded helpers in `safe-storage.ts`, so unavailable storage just means an
 * empty list.
 */

import { LIMITS } from "@/lib/config";
import {
  getBrowserStorage,
  safeGetItem,
  safeSetItem,
  type KeyValueStorage,
} from "@/lib/safe-storage";

export const RECENT_PROMPTS_KEY = "motion-atlas:recent-prompts:v1";
export const MAX_RECENT_PROMPTS = 10;

function clean(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim();
}

/** `prompt` first, then the existing entries, de-duplicated and capped. */
export function addRecentPrompt(list: readonly string[], prompt: string): string[] {
  const entry = clean(prompt);
  if (!entry || Array.from(entry).length > LIMITS.maxPromptChars) return [...list];
  return [entry, ...list.filter((p) => p !== entry)].slice(0, MAX_RECENT_PROMPTS);
}

/** Parse the stored JSON defensively; anything unexpected yields an empty list. */
export function parseRecentPrompts(raw: string | null): string[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  let out: string[] = [];
  // Oldest to newest so `addRecentPrompt` keeps the stored order.
  for (const item of [...data].reverse()) {
    if (typeof item === "string") out = addRecentPrompt(out, item);
  }
  return out;
}

export function loadRecentPrompts(storage: KeyValueStorage | null = getBrowserStorage()): string[] {
  return parseRecentPrompts(safeGetItem(RECENT_PROMPTS_KEY, storage));
}

/** Record a submitted prompt. Returns the new list (even if it could not be saved). */
export function recordRecentPrompt(
  prompt: string,
  storage: KeyValueStorage | null = getBrowserStorage(),
): string[] {
  const next = addRecentPrompt(loadRecentPrompts(storage), prompt);
  safeSetItem(RECENT_PROMPTS_KEY, JSON.stringify(next), storage);
  return next;
}
