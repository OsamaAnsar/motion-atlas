# scripts/

| Script                 | What it does                                                              |
| ---------------------- | ---------------------------------------------------------------------- |
| `make-demo-video.mjs`  | (optional) Renders a short bundled demo MP4 with ffmpeg into `apps/web/public/demo/`. If you don't run it, the demo UI falls back to an in-browser synthetic clip. |
| `check-system.mjs`     | Local preflight: Node version, pnpm, ffmpeg, `nvidia-smi`, ComfyUI reachability. Mirrors the `/system` page from the terminal. |

Run with plain Node:

```bash
node scripts/check-system.mjs
node scripts/make-demo-video.mjs
```
