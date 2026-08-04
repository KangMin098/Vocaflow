#!/usr/bin/env bash
# scripts/comic/runpod/provision.sh
# RunPod "ComfyUI - AI-Dock" (ghcr.io/ai-dock/comfyui) 프로비저닝 — Qwen-Image-Edit-2511 만화 파이프라인.
# Pod 실행(Running) 후 그 Pod의 웹 터미널(JupyterLab Terminal 또는 Connect→Web Terminal)에서 1회:
#   bash <(curl -sL <this-raw-url>)   또는 내용 붙여넣기.
# ComfyUI-GGUF 노드 설치 + 검증된 GGUF 모델셋 다운로드(Kaggle Dataset 동일) + ComfyUI 재시작.
# 이후 로컬에서: COMFY_URL=<runpod-8188-url> node scripts/comic/gen-comfy.mjs \
#   --script scripts/comic/examples/carol-stave1.json --out out/carol \
#   --wf-gen scripts/comic/wf/qwen-t2i-lightning.api.json \
#   --wf-edit scripts/comic/wf/qwen-edit-lightning.api.json
set -u
export HF_HUB_ENABLE_HXFER_TRANSFER=0

# ── 1) ComfyUI 위치 탐지 (AI-Dock 은 보통 /opt/ComfyUI, 모델은 /workspace 볼륨) ──
CD=""
for c in /opt/ComfyUI "${WORKSPACE:-/workspace}/ComfyUI" /ComfyUI "$HOME/ComfyUI"; do
  [ -f "$c/main.py" ] && { CD="$c"; break; }
done
[ -z "$CD" ] && CD="$(dirname "$(find / -maxdepth 6 -name comfyui_version.py 2>/dev/null | head -1)")"
[ -z "$CD" ] || [ ! -f "$CD/main.py" ] && { echo "!! ComfyUI 디렉토리를 못 찾음 — CD 변수를 직접 지정하세요"; exit 1; }
echo "ComfyUI: $CD"
MODELS="$CD/models"
mkdir -p "$MODELS/unet" "$MODELS/text_encoders" "$MODELS/vae" "$MODELS/loras"
echo "disk:"; df -h "$MODELS" | tail -1

# ── 2) ComfyUI-GGUF 커스텀 노드 ──
if [ ! -d "$CD/custom_nodes/ComfyUI-GGUF" ]; then
  git clone --depth 1 https://github.com/city96/ComfyUI-GGUF "$CD/custom_nodes/ComfyUI-GGUF"
fi
python3 -m pip -q install gguf huggingface_hub 2>/dev/null || pip -q install gguf huggingface_hub

# ── 3) 모델 다운로드 (검증된 GGUF 세트). 이미 있으면 스킵. ──
dl() { # <url> <destdir> <name>
  local url="$1" dir="$2" name="$3"
  if [ -s "$dir/$name" ]; then echo "· skip $name"; return; fi
  echo ">> $name"
  ( command -v aria2c >/dev/null && aria2c -x8 -s8 -o "$name" -d "$dir" "$url" ) \
    || wget -c -q --show-progress -O "$dir/$name" "$url"
}
HF="https://huggingface.co"

# Edit 본체 (품질↔디스크: Q5 권장 ~15GB, 디스크 타이트하면 Q4 로 교체)
EDIT_Q="Q5_K_M"   # 또는 Q4_K_M
dl "$HF/unsloth/Qwen-Image-Edit-2511-GGUF/resolve/main/qwen-image-edit-2511-${EDIT_Q}.gguf" "$MODELS/unet" "qwen-image-edit-2511-${EDIT_Q}.gguf"
# 인코더 + 비전 프로젝터 (Edit 참조 경로 필수)
dl "$HF/chatpig/qwen2.5-vl-7b-it-gguf/resolve/main/qwen2.5-vl-7b-it-q4_k_m.gguf" "$MODELS/text_encoders" "qwen2.5-vl-7b-it-q4_k_m.gguf"
dl "$HF/chatpig/qwen2.5-vl-7b-it-gguf/resolve/main/mmproj-qwen2.5-vl-7b-it-bf16.gguf" "$MODELS/text_encoders" "mmproj-qwen2.5-vl-7b-it-bf16.gguf"
dl "$HF/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" "$MODELS/vae" "qwen_image_vae.safetensors"
# Lightning 8-step (Edit) — 5x 가속
dl "$HF/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Edit-2509/Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors" "$MODELS/loras" "Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors"

# (선택) 다중 캐릭터 참조 시트를 pod에서 t2i로 생성하려면 아래 주석 해제 — t2i 모델(+~10GB).
#   Scrooge 시트를 로컬에서 미리 올리면(gen-comfy refs/) t2i 모델 없이도 됨.
# dl "$HF/city96/Qwen-Image-gguf/resolve/main/qwen-image-Q3_K_S.gguf" "$MODELS/unet" "qwen-image-Q3_K_S.gguf"
# dl "$HF/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Lightning-4steps-V1.0-bf16.safetensors" "$MODELS/loras" "Qwen-Image-Lightning-4steps-V1.0-bf16.safetensors"

echo "== 모델 =="; du -sh "$MODELS"/*/* 2>/dev/null | sort -h | tail -8

# ── 4) ComfyUI 재시작 (GGUF 노드 로드) ──
echo ">> ComfyUI 재시작"
( supervisorctl restart comfyui 2>/dev/null ) \
  || ( pkill -f "main.py" 2>/dev/null; echo "  (supervisor 없음 — 수동 재시작 또는 AI-Dock 서비스 재시작 필요)" )
echo "DONE — /object_info 에 UnetLoaderGGUF 뜨면 준비 완료. gen-comfy.mjs 로 구동하세요."
