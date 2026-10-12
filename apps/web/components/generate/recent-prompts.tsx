"use client";

import * as React from "react";
import { History } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { truncate } from "@/lib/format";
import { useStore } from "@/lib/store";

/** Dropdown of the last prompts submitted from this browser. Hidden when empty. */
export function RecentPrompts() {
  const recent = useStore((s) => s.recentPrompts);
  const load = useStore((s) => s.loadRecentPrompts);
  const setForm = useStore((s) => s.setForm);

  // localStorage is only readable in the browser, after hydration.
  React.useEffect(() => {
    load();
  }, [load]);

  if (recent.length === 0) return null;

  return (
    <Select
      // Controlled to "" so the trigger always shows the placeholder, like a menu.
      value=""
      onValueChange={(index) => {
        const prompt = recent[Number(index)];
        if (prompt !== undefined) setForm({ prompt });
      }}
    >
      <SelectTrigger
        className="h-8 w-[150px] gap-1.5 text-xs"
        aria-label="Recent prompts"
        title="Prompts you submitted recently in this browser"
      >
        <History className="size-3.5 shrink-0 text-muted" />
        <SelectValue placeholder="Recent prompts" />
      </SelectTrigger>
      <SelectContent
        align="end"
        // The default viewport is only as wide as the trigger; prompts need more room.
        className="max-w-[min(28rem,90vw)] [&>[data-radix-select-viewport]]:w-auto [&>[data-radix-select-viewport]]:min-w-[20rem]"
      >
        {recent.map((prompt, i) => (
          <SelectItem key={prompt} value={String(i)}>
            {truncate(prompt, 90)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
