#!/usr/bin/env bash
# scripts/comic/kaggle/run-comfyui.sh
# Launch ComfyUI + Qwen-Image-Edit on a FREE Kaggle GPU notebook and expose it via a
# cloudflared tunnel, so the local Vocaflow pipeline (gen-comfy.mjs) can drive it.
#
# Run inside a Kaggle notebook cell:  !bash run-comfyui.sh
# Requires the notebook Accelerator = GPU P100 and Internet = ON.
#
# Persist the downloaded models as a Kaggle *Dataset* and attach it under /kaggle/input to
# skip re-downloading each session (see README.md).
set -e
ROOT=/kaggle/working
COMFY=$ROOT/ComfyUI
MODELS_CACHE=/kaggle/input   # attach a dataset with the model files here to skip downloads

echo "== 1/5 clone ComfyUI =="
[ -d "$COMFY" ] || git clone --depth 1 https://github.com/comfyanonymous/ComfyUI "$COMFY"
cd "$COMFY"
pip -q install -r requirements.txt

echo "== 2/5 place Qwen-Image-Edit models =="
mkdir -p models/diffusion_models models/text_encoders models/vae models/loras
# If you attached a dataset of the models, symlink them in; otherwise download (needs Internet ON).
# Verified Comfy-Org repackaged Qwen-Image-Edit-2511 files (docs.comfy.org/.../qwen-image-edit-2511).
# fp8mixed ≈19GB fits P100 16GB VRAM; swap Q_DIFF_URL for a GGUF Q4 build for <=14GB.
Q_DIFF_URL="${Q_DIFF_URL:-https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors}"
Q_TENC_URL="${Q_TENC_URL:-https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors}"
Q_VAE_URL="${Q_VAE_URL:-https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors}"
Q_LORA_URL="${Q_LORA_URL:-https://huggingface.co/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Lightning-4steps-V1.0.safetensors}"  # 4-step speed LoRA (optional)
dl(){ [ -f "$2" ] && { echo "  ✓ have $2"; return; }; [ -n "$1" ] && { echo "  ↓ $2"; wget -qc "$1" -O "$2"; } || echo "  (skip $2)"; }
if ls "$MODELS_CACHE"/*/*.safetensors >/dev/null 2>&1; then
  echo "  linking models from attached dataset(s)…"
  find "$MODELS_CACHE" -name '*edit*fp8*.safetensors' -exec ln -sf {} models/diffusion_models/ \;
  find "$MODELS_CACHE" -name '*vl*.safetensors'       -exec ln -sf {} models/text_encoders/ \;
  find "$MODELS_CACHE" -name '*vae*.safetensors'      -exec ln -sf {} models/vae/ \;
  find "$MODELS_CACHE" \( -iname '*lora*.safetensors' -o -iname '*Lightning*.safetensors' \) -exec ln -sf {} models/loras/ \;
else
  dl "$Q_DIFF_URL" models/diffusion_models/qwen_image_edit_2511_fp8mixed.safetensors
  dl "$Q_TENC_URL" models/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors
  dl "$Q_VAE_URL"  models/vae/qwen_image_vae.safetensors
  dl "$Q_LORA_URL" models/loras/Qwen-Image-Lightning-4steps-V1.0.safetensors
fi

echo "== 3/5 get cloudflared =="
if ! command -v cloudflared >/dev/null 2>&1; then
  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi

echo "== 4/5 launch ComfyUI (:8188) =="
nohup python main.py --listen 0.0.0.0 --port 8188 > "$ROOT/comfy.log" 2>&1 &
for i in $(seq 1 60); do curl -s http://localhost:8188/ >/dev/null && break; sleep 2; done

echo "== 5/5 open tunnel =="
nohup cloudflared tunnel --url http://localhost:8188 --no-autoupdate > "$ROOT/tunnel.log" 2>&1 &
echo "  waiting for public URL…"
for i in $(seq 1 30); do
  URL=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$ROOT/tunnel.log" | head -1 || true)
  [ -n "$URL" ] && break; sleep 2
done
echo ""
echo "=================================================================="
echo "  ComfyUI is live. On your LOCAL machine, run:"
echo "    COMFY_URL=$URL node scripts/comic/gen-comfy.mjs --script <s.json> --out <dir> --wf-gen wf/qwen-t2i.api.json --wf-edit wf/qwen-edit.api.json"
echo "=================================================================="
echo "(keep this cell running; the tunnel closes when the session ends)"
tail -f "$ROOT/comfy.log"
