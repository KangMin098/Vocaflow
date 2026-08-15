# Free self-hosting: Qwen on Kaggle → drive from the local pipeline

> ✅ **VALIDATED (2026-08): free Kaggle T4 runs Qwen at API quality.** Not fp8 (T4 has no fp8)
> but **GGUF Q3 + a Lightning 4-step LoRA** → flat B&W Gonick, ~1.5 min/panel, **$0**. A 90-panel
> book ≈ 2.25 h; ~13 books/week within the 30 GPU-h quota. Setup = one cell:
> [`qwen-lightning-cell.py`](./qwen-lightning-cell.py) (paste into a fresh T4 notebook). Then drive
> with `gen-comfy.mjs --wf-gen ../wf/qwen-t2i-lightning.api.json`. RunPod 4090 (fp8, ~15 s/panel,
> paid) is the same workflow, just faster. The Qwen-Image-Edit fp8 flow below is the PAID-GPU
> variant; on a free T4 use the GGUF+Lightning cell instead.

---

## (paid-GPU variant) Qwen-Image-Edit fp8 on Kaggle → drive from the local pipeline

Run our exact production model (**Qwen-Image-Edit-2511**, open-weight Apache-2.0) on a **free
Kaggle GPU** (P100 16GB, 30 GPU-h/week) and drive it from the local Vocaflow pipeline via
[`gen-comfy.mjs`](../gen-comfy.mjs). Output matches `gen-qwen` (shared `comic-prompt.mjs`
house style + Vision-QC fixes) but costs **$0** and is **LoRA-tunable** (lock a character /
flat-ink style — impossible on the closed Nano Banana / gpt-image).

Our local machine has no NVIDIA GPU, so "self-host" = **remote GPU on Kaggle**, driven locally.

## Why Kaggle
- **P100 16GB** fits Qwen-Image-Edit **FP8 (16GB)** or **GGUF Q4 (~14GB)**.
- **30 GPU-hours/week**, 12h/session, Internet toggle — no SD/WebUI ban (unlike free Colab).
- ComfyUI exposes a REST API (`/prompt`, `/history`, `/view`); we tunnel it with cloudflared.

## One-time setup
1. Create a Kaggle account → **verify your phone** (Settings) — required to enable GPU + Internet.
2. (Recommended) Create a **private Dataset** holding the model files so you don't re-download
   each session: `qwen-image-edit-2511` FP8 diffusion model, the Qwen-VL text encoder, the VAE,
   and any LoRA (Lightning for speed; your flat-ink/character LoRA). Get the current filenames +
   links from the official ComfyUI Qwen doc: https://docs.comfy.org/tutorials/image/qwen/qwen-image-edit

## Each session
1. New Notebook → **Settings: Accelerator = GPU P100, Internet = ON**. Attach your model Dataset.
2. Upload [`run-comfyui.sh`](./run-comfyui.sh) (or paste it) and run a cell:
   ```
   !bash run-comfyui.sh
   ```
   (If not using a Dataset, set `Q_DIFF_URL`/`Q_TENC_URL`/`Q_VAE_URL`/`Q_LORA_URL` env first.)
3. The cell prints a public URL like `https://xxxx.trycloudflare.com`. **Keep the cell running.**

## Export the two workflow templates (once)
`gen-comfy.mjs` injects per-panel prompt/size/reference into YOUR workflow, so it stays
environment-agnostic. In the ComfyUI web UI (open the tunnel URL):
1. Build/open a **text-to-image** Qwen graph → title the positive-prompt node **`PROMPT`**, the
   negative **`NEG`**, the empty-latent/size node **`SIZE`** → menu **Save (API Format)** →
   save as `wf/qwen-t2i.api.json`.
2. Build/open an **image-edit** Qwen graph (with a `LoadImage`) → title prompt/neg/size the same,
   and title the reference `LoadImage` node **`REFIMAGE`** → **Save (API Format)** →
   `wf/qwen-edit.api.json`.
(Double-click a node's title bar to rename it. The official example graphs from the doc above are
a good starting point.)

## Drive it from the local machine
```
COMFY_URL=https://xxxx.trycloudflare.com \
node scripts/comic/gen-comfy.mjs \
  --script scripts/comic/examples/carol-stave1.json \
  --out out/carol-s1 \
  --wf-gen wf/qwen-t2i.api.json \
  --wf-edit wf/qwen-edit.api.json
```
Flags mirror `gen-qwen`: `--refs-only`, `--panels 2,12`, `--noref`, `--no-auto-noref`,
`--gap <ms>`. If your node titles differ, override with `--title-prompt/-neg/-size/-refimage`.
Then assemble as usual: `node scripts/comic/03-assemble.mjs --images out/carol-s1 --layout comic ...`.

## Throughput / limits
- ~25–40s/panel (faster with a Lightning LoRA) → ~60–120 panels/hour → a book in well under an
  hour; **30 GPU-h/week = many books**, free.
- Session ends → tunnel dies + `/kaggle/working` resets (persist models in the Dataset). The
  tunnel URL changes each session — pass the new `COMFY_URL` each run.

## Notes
- This is the "unlimited free" tier of the cascade: **free Qwen API (100 imgs) → Kaggle self-host
  ($0) → paid API only for stubborn residue.**
- The big win over the cloud API: **LoRA**. Train one character/style LoRA (Kohya, ~15–20 sheet
  images) and every panel locks to it — consistency beyond what the closed models offer.
