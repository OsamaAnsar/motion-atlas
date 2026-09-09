# ComfyUI + Wan 2.2 setup

> Motion Atlas **does not** install ComfyUI or download models. Do this once,
> then let the app drive it. This recipe was verified end-to-end on an **RTX 3070
> Laptop (8 GB)** — see the "Verified" note at the bottom.

## 1. Install ComfyUI

```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
python -m venv venv && . venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**PyTorch — use ≥ 2.8.** Current ComfyUI bundles native ops (`comfy_kitchen`)
that need `torch.library.infer_schema` support for `list[int]`; torch 2.6 crashes
on boot with `Parameter kernel_size has unsupported type list[int]`.

```bash
pip install --upgrade "torch>=2.8" torchvision torchaudio \
  --index-url https://download.pytorch.org/whl/cu128
```

(Match the CUDA build — `cu124` / `cu126` / `cu128` — to your driver. A recent
NVIDIA driver runs any of them.)

## 2. Download the Wan 2.2 TI2V 5B files

From [`Comfy-Org/Wan_2.2_ComfyUI_Repackaged`](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged):

| File | → folder | Size |
| ---- | -------- | ---- |
| `split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors` | `models/diffusion_models/` | ~10 GB |
| `split_files/vae/wan2.2_vae.safetensors` | `models/vae/` | ~1.4 GB |
| `split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` | `models/text_encoders/` | ~6.7 GB |

```bash
pip install "huggingface_hub[hf_xet]"
hf download Comfy-Org/Wan_2.2_ComfyUI_Repackaged \
  split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors \
  split_files/vae/wan2.2_vae.safetensors \
  split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors \
  --local-dir /tmp/wan && \
  mv /tmp/wan/split_files/diffusion_models/* models/diffusion_models/ && \
  mv /tmp/wan/split_files/vae/* models/vae/ && \
  mv /tmp/wan/split_files/text_encoders/* models/text_encoders/
```

The `wan22_*.json` workflows in [`comfy/workflows/`](../comfy/workflows/) already
reference these exact filenames.

## 3. Launch with low-VRAM flags (RTX 3070 8 GB)

```bash
python main.py --lowvram --use-split-cross-attention --preview-method none --port 8188
```

ComfyUI logs `Set vram state to: LOW_VRAM` and `Using async weight offloading`.
If you still OOM, drop to 384×640 / 33 frames / 12 steps, or add `--novram`.

## 4. Verify a manual generation

`GET http://127.0.0.1:8188/object_info/UNETLoader` should list
`wan2.2_ti2v_5B_fp16.safetensors`. Then POST
[`comfy/workflows/wan22_t2v.json`](../comfy/workflows/wan22_t2v.json) to
`/prompt` (or load the `video_wan2_2_5B_ti2v` template in the web UI) and confirm
an `.mp4` lands in `ComfyUI/output/`.

## 5. Point Motion Atlas at it

```env
# .env  (repo root)
DEMO_MODE=false
COMFYUI_URL=http://127.0.0.1:8188
COMFYUI_OUTPUT_DIR=/absolute/path/to/ComfyUI/output
```

Restart the API — `GET /api/health` reports `comfyui: "online"`,
`workflowsLoaded: true`. Generate from the web app; progress, GPU telemetry and
the MP4 come back over the real path.

---

### Verified (RTX 3070 Laptop, 8 GB)

| Config | Time | Peak VRAM |
| ------ | ---- | --------- |
| 384×640 · 33f · 12 steps | ~70–85 s | 7.4 GB |
| 640×384 · 49f · 30 steps | ~4m20s | 7.4 GB |

torch `2.11.0+cu128`, ComfyUI `0.35.0`, sampler `uni_pc` / `simple`,
`ModelSamplingSD3` shift 8. First run adds ~15 s of cold weight load.
