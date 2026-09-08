"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-surface-2 !border !border-border !text-foreground !rounded-md !text-sm !font-sans",
          description: "!text-muted",
          actionButton: "!bg-accent !text-accent-foreground",
          cancelButton: "!bg-surface-3 !text-muted",
        },
      }}
    />
  );
}
