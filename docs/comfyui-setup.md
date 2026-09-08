# ComfyUI + Wan 2.2 setup (Phase 2 prerequisite)

> Motion Atlas **does not** install ComfyUI or download models. Do this once,
> verify a manual generation, then let the app drive it.

## 1. Install ComfyUI

```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
python -m venv venv && . venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
# PyTorch with CUDA — match your driver / CUDA version
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

## 2. Place Wan 2.2 TI2V 5B files

| File                                   | Folder                              |
| -------------------------------------- | ----------------------------------- |
| `wan2.2_ti2v_5B_*.safetensors`         | `models/diffusion_models/`          |
| `wan_2.1_vae.safetensors`              | `models/vae/`                       |
| `umt5_xxl_fp8_*` / `umt5_xxl_fp16_*`   | `models/text_encoders/`             |

(Exact filenames depend on the release you download. The workflow template pins
whatever you actually installed.)

## 3. Launch with low-VRAM flags (RTX 3070 8 GB)

```bash
python main.py --lowvram --use-split-cross-attention --preview-method none --port 8188
```

If you still hit OOM: drop resolution to 384×640, frames to 49, and try
`--novram` (slower, maximal offload).

## 4. Verify a manual generation

In the ComfyUI web UI, load a Wan 2.2 TI2V template, run **text-to-video** at
`640×384`, `49` frames, `16` fps. Confirm an `.mp4` lands in `ComfyUI/output/`.

**Do not proceed to API integration until this works by hand.**

## 5. Export the workflow

`Workflow ▸ Save (API Format)` → save as:

- `comfy/workflows/wan22_t2v.json`
- `comfy/workflows/wan22_i2v.json` (image-to-video variant)

Then set in `.env`:

```env
DEMO_MODE=false
COMFYUI_URL=http://127.0.0.1:8188
COMFYUI_OUTPUT_DIR=/absolute/path/to/ComfyUI/output
```

Restart the API. `GET /api/health` should report `comfyui: "online"` and
`workflowsLoaded: true`.
