"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { LIMITS } from "@/lib/config";
import { getProvider } from "@/lib/provider/factory";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = LIMITS.maxUploadMb * 1024 * 1024;

export function ImageUpload() {
  const form = useStore((s) => s.form);
  const setForm = useStore((s) => s.setForm);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function accept(file: File) {
    if (!ACCEPT.includes(file.type)) {
      toast.error("Unsupported image type", { description: "Use PNG, JPG or WEBP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", {
        description: `Max ${LIMITS.maxUploadMb} MB — this file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      });
      return;
    }
    setBusy(true);
    try {
      const { name, previewUrl } = await getProvider().uploadImage(file);
      // sanity-check it decodes as an image
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("not an image"));
        img.src = previewUrl;
      });
      setForm({ imageName: name, imageDataUrl: previewUrl, imageFileName: file.name });
      toast.success("Image ready", { description: file.name });
    } catch {
      toast.error("Could not read that image");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setForm({ imageName: null, imageDataUrl: null, imageFileName: null });
    if (inputRef.current) inputRef.current.value = "";
  }

  if (form.imageDataUrl) {
    return (
      <div className="panel-2 flex items-center gap-3 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={form.imageDataUrl}
          alt="Input frame preview"
          className="size-16 rounded-md border border-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{form.imageFileName}</p>
          <p className="text-xs text-muted">Used as the first frame for image-to-video</p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded-md p-1.5 text-muted hover:bg-surface-3 hover:text-foreground"
          aria-label="Remove image"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void accept(file);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-center transition-colors",
        dragging && "border-accent/60 bg-accent/5",
      )}
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin text-accent" />
      ) : (
        <ImagePlus className="size-5 text-muted" />
      )}
      <p className="text-sm text-muted-strong">
        Drop an image or{" "}
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => inputRef.current?.click()}
        >
          browse
        </button>
      </p>
      <p className="text-[11px] text-muted">PNG · JPG · WEBP — up to {LIMITS.maxUploadMb} MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void accept(file);
        }}
      />
    </div>
  );
}
