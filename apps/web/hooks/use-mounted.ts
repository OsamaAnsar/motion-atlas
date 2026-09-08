"use client";

import { useEffect, useState } from "react";

/** True only after the first client render — guards time/random-dependent UI. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
