"use client";

import { useEffect } from "react";

import { useStore } from "@/lib/store";

/** One-time hydrate of health + generation history for a page. */
export function useBootstrap(): void {
  const refreshHealth = useStore((s) => s.refreshHealth);
  const loadHistory = useStore((s) => s.loadHistory);

  useEffect(() => {
    void refreshHealth();
    void loadHistory();
  }, [refreshHealth, loadHistory]);
}
