import { describe, expect, it } from "vitest";

import { LIMITS } from "@/lib/config";
import type { KeyValueStorage } from "@/lib/safe-storage";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";
import {
  MAX_RECENT_PROMPTS,
  RECENT_PROMPTS_KEY,
  addRecentPrompt,
  loadRecentPrompts,
  parseRecentPrompts,
  recordRecentPrompt,
} from "./recent-prompts";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("addRecentPrompt", () => {
  it("puts the newest first", () => {
    expect(addRecentPrompt(["b", "c"], "a")).toEqual(["a", "b", "c"]);
  });

  it("moves a repeated prompt to the front instead of duplicating it", () => {
    expect(addRecentPrompt(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("treats whitespace differences as the same prompt", () => {
    expect(addRecentPrompt(["a b"], "  a   b \n")).toEqual(["a b"]);
  });

  it("keeps only the last 10 distinct prompts", () => {
    let list: string[] = [];
    for (let i = 1; i <= 15; i += 1) list = addRecentPrompt(list, `prompt ${i}`);
    expect(list).toHaveLength(MAX_RECENT_PROMPTS);
    expect(list[0]).toBe("prompt 15");
    expect(list.at(-1)).toBe("prompt 6");
  });

  it("ignores blank and over-long prompts", () => {
    expect(addRecentPrompt(["a"], "   ")).toEqual(["a"]);
    expect(addRecentPrompt(["a"], "x".repeat(LIMITS.maxPromptChars + 1))).toEqual(["a"]);
  });

  it("does not mutate its input", () => {
    const list = ["a"];
    addRecentPrompt(list, "b");
    expect(list).toEqual(["a"]);
  });
});

describe("parseRecentPrompts", () => {
  it.each([null, "", "not json", "{}", "42", '"str"', "null"])("returns [] for %j", (raw) => {
    expect(parseRecentPrompts(raw)).toEqual([]);
  });

  it("keeps order and drops non-strings, blanks and duplicates", () => {
    expect(parseRecentPrompts(JSON.stringify(["a", 1, null, "  ", "b", "a", { x: 1 }]))).toEqual([
      "a",
      "b",
    ]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 30 }, (_, i) => `p${i}`);
    expect(parseRecentPrompts(JSON.stringify(many))).toHaveLength(MAX_RECENT_PROMPTS);
    expect(parseRecentPrompts(JSON.stringify(many))[0]).toBe("p0");
  });
});

describe("storage round trip", () => {
  it("records and loads through storage", () => {
    const storage = memoryStorage();
    expect(recordRecentPrompt("first", storage)).toEqual(["first"]);
    expect(recordRecentPrompt("second", storage)).toEqual(["second", "first"]);
    expect(loadRecentPrompts(storage)).toEqual(["second", "first"]);
    expect(JSON.parse(storage.getItem(RECENT_PROMPTS_KEY) ?? "[]")).toEqual(["second", "first"]);
  });

  it("recovers from corrupted stored data", () => {
    const storage = memoryStorage({ [RECENT_PROMPTS_KEY]: "{{{" });
    expect(recordRecentPrompt("ok", storage)).toEqual(["ok"]);
  });
});

describe("unavailable storage", () => {
  it("safe helpers never throw", () => {
    expect(safeGetItem("k", throwing)).toBeNull();
    expect(safeSetItem("k", "v", throwing)).toBe(false);
    expect(safeGetItem("k", null)).toBeNull();
    expect(safeSetItem("k", "v", null)).toBe(false);
  });

  it("recent prompts degrade to an empty or in-memory list", () => {
    expect(loadRecentPrompts(throwing)).toEqual([]);
    expect(recordRecentPrompt("hello", throwing)).toEqual(["hello"]);
    expect(loadRecentPrompts(null)).toEqual([]);
    expect(recordRecentPrompt("hello", null)).toEqual(["hello"]);
  });

  it("works without a window (node), as during server rendering", () => {
    expect(loadRecentPrompts()).toEqual([]);
    expect(recordRecentPrompt("x")).toEqual(["x"]);
  });
});
