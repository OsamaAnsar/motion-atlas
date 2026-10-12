"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseRemixQuery } from "@/lib/remix";
import { useStore } from "@/lib/store";

/**
 * Applies `/generate?remix=...` to the form once, then removes the query so a
 * reload or a later visit does not overwrite the user's edits. Renders nothing.
 */
export function RemixApplier() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const applyRemix = useStore((s) => s.applyRemix);

  React.useEffect(() => {
    const remix = parseRemixQuery(params);
    if (!remix) return;
    applyRemix(remix);
    router.replace(pathname, { scroll: false });
  }, [params, router, pathname, applyRemix]);

  return null;
}
