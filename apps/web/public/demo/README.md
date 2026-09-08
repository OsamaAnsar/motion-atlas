# apps/web/public/demo

- `poster-0x.svg` — always-present placeholder posters for demo gallery cards.
- `atlas-demo.mp4` — **not committed.** Run `node scripts/make-demo-video.mjs` (needs
  ffmpeg) to generate one, then set `NEXT_PUBLIC_HAS_DEMO_VIDEO=true`. Without it, the
  demo output is rendered live in-browser by `SyntheticClip`.
