# comfy/

ComfyUI assets that Motion Atlas depends on. **Nothing here is auto-downloaded.**
The app treats ComfyUI as an external service you install and run yourself.

```
comfy/
  workflows/
    wan22_t2v.json   # API-format workflow for text-to-video  (add in Phase 2)
    wan22_i2v.json   # API-format workflow for image-to-video (add in Phase 3)
  README.md
```

## Why the workflows are not committed yet

Per the build plan, we do **not** wire the real ComfyUI integration until:

1. ComfyUI is installed and running,
2. the Wan 2.2 TI2V 5B model files are placed in ComfyUI,
3. a generation has been verified **manually inside ComfyUI**, and
4. the graph is exported in **API format** (`Save (API Format)` in the ComfyUI menu).

Only then do the exported graphs land in `comfy/workflows/` and the FastAPI
`ComfyUIProvider` starts submitting them.

## Model setup (do this yourself, once)

| File                              | ComfyUI location                    |
| --------------------------------- | ----------------------------------- |
| `wan2.2_ti2v_5B_*.safetensors`    | `ComfyUI/models/diffusion_models/`  |
| `wan_2.1_vae.safetensors`         | `ComfyUI/models/vae/`               |
| `umt5_xxl_*.safetensors` (T5 enc) | `ComfyUI/models/text_encoders/`     |

Recommended launch flags for an 8 GB card:

```bash
python main.py --lowvram --use-split-cross-attention --preview-method none
```

See [`docs/architecture.md`](../docs/architecture.md) and
[`docs/comfyui-setup.md`](../docs/comfyui-setup.md) for the full walkthrough.

## Workflow templating contract

The API never builds graphs dynamically. It loads a known-good JSON template and
substitutes a fixed set of fields by node id:

- positive prompt text
- negative prompt text
- `seed`
- `width`, `height`
- `length` (frame count)
- `steps`, `cfg` (guidance)
- input image name (i2v only)

Node ids are pinned in `apps/api/app/comfy/workflow_map.py`.
