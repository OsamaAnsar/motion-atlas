/**
 * Record a live <canvas> to a WebM blob via MediaRecorder. Used so the demo's
 * "Download" action produces a real video file of the synthetic clip rather
 * than a dead link. Returns null if the browser can't record.
 */
export async function recordCanvasToWebm(
  canvas: HTMLCanvasElement,
  durationMs = 3000,
): Promise<Blob | null> {
  if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
    return null;
  }
  const stream = canvas.captureStream(30);
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) return null;

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: BlobPart[] = [];

  return new Promise<Blob | null>((resolve) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    recorder.onerror = () => resolve(null);
    recorder.start();
    setTimeout(() => recorder.state !== "inactive" && recorder.stop(), durationMs);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
