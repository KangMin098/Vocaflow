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
# pip 캐시를 네트워크볼륨에 둔다 → 새 pod(컨테이너 리셋)이 torch(2.5GB)·requirements 를
# 재다운로드하지 않고 볼륨 캐시에서 설치(재프로비저닝 ~3분→~1분). Secure Cloud stop→start
# 불가로 매번 새 pod 을 만들 때의 세팅 낭비 제거.
export PIP_CACHE_DIR="${WORKSPACE:-/workspace}/.pipcache"
mkdir -p "$PIP_CACHE_DIR"

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

# Edit 본체 (품질↔VRAM 자동: 22GB+ = Q5 ~15GB, 그 미만 = Q4). ENV EDIT_Q 로 강제 가능.
if [ -z "${EDIT_Q:-}" ]; then
  VRAM="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -dc 0-9)"
  if [ -n "$VRAM" ] && [ "$VRAM" -ge 22000 ]; then EDIT_Q="Q5_K_M"; else EDIT_Q="Q4_K_M"; fi
  echo "VRAM=${VRAM:-?}MB → EDIT_Q=$EDIT_Q"
fi
dl "$HF/unsloth/Qwen-Image-Edit-2511-GGUF/resolve/main/qwen-image-edit-2511-${EDIT_Q}.gguf" "$MODELS/unet" "qwen-image-edit-2511-${EDIT_Q}.gguf"
# 인코더 + 비전 프로젝터 (Edit 참조 경로 필수)
dl "$HF/chatpig/qwen2.5-vl-7b-it-gguf/resolve/main/qwen2.5-vl-7b-it-q4_k_m.gguf" "$MODELS/text_encoders" "qwen2.5-vl-7b-it-q4_k_m.gguf"
dl "$HF/chatpig/qwen2.5-vl-7b-it-gguf/resolve/main/mmproj-qwen2.5-vl-7b-it-bf16.gguf" "$MODELS/text_encoders" "mmproj-qwen2.5-vl-7b-it-bf16.gguf"
dl "$HF/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors" "$MODELS/vae" "qwen_image_vae.safetensors"
# Lightning 8-step (Edit) — 5x 가속
dl "$HF/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Edit-2509/Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors" "$MODELS/loras" "Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors"

# t2i 참조 시트: Edit-2511 모델을 그대로 t2i 로 쓰면(wf/qwen-t2i-from-edit.api.json) 별도 t2i
# 모델이 필요 없다 — 4090 실측(~7s/1024²) 검증됨. 그래서 기본 다운로드 OFF.
# 순수 Qwen-Image t2i(별도 8GB, city96 Q3) 를 원하면 WANT_T2I=1 로 켠다.
if [ "${WANT_T2I:-0}" = "1" ]; then
  dl "$HF/city96/Qwen-Image-gguf/resolve/main/qwen-image-Q3_K_S.gguf" "$MODELS/unet" "qwen-image-Q3_K_S.gguf"
  dl "$HF/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Lightning-4steps-V1.0-bf16.safetensors" "$MODELS/loras" "Qwen-Image-Lightning-4steps-V1.0-bf16.safetensors"
fi

echo "== 모델 =="; du -sh "$MODELS"/*/* 2>/dev/null | sort -h | tail -8

# ── 3.5) PyTorch 2.5+ 보장 ──
# 최신 ComfyUI 의 Qwen 인코더는 scaled_dot_product_attention(enable_gqa=)(torch 2.5+)를 쓴다.
# AI-Dock 기본 torch 2.4.1 이면 인코딩 단계에서 크래시 → 새 pod(컨테이너 리셋)마다 필수.
VENV_PY="/opt/environments/python/comfyui/bin/python"; [ -x "$VENV_PY" ] || VENV_PY="$(command -v python3)"
# 새 pod(컨테이너 리셋)는 볼륨의 최신 ComfyUI(0.30+) 의존성(sqlalchemy 등)이 venv 에 없어 기동 실패 →
# requirements 재설치 필수.
echo ">> ComfyUI requirements 설치"
"$VENV_PY" -m pip install -q -r "$CD/requirements.txt" 2>&1 | tail -3
"$VENV_PY" -m pip -q install sqlalchemy alembic 2>/dev/null || true
TORCH_V="$("$VENV_PY" -c 'import torch;print(torch.__version__)' 2>/dev/null | cut -d+ -f1)"
echo "torch=${TORCH_V:-none}"
case "$TORCH_V" in
  2.[0-4].*|1.*|"" ) echo ">> torch 업그레이드 → 2.6.0+cu124 (enable_gqa 지원)"
    "$VENV_PY" -m pip install -q torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124 ;;
  * ) echo "· torch OK (>=2.5)" ;;
esac

# ── 4) ComfyUI 재시작 (GGUF 노드 로드) ──
# ⚠️ pkill -f main.py 는 AI-Dock 서비스 포털(1111)까지 죽여 로그인이 502 가 된다 — 쓰지 말 것.
# AI-Dock 은 supervisord 로 관리하므로 sudo supervisorctl 로 comfyui 만 재시작한다.
echo ">> ComfyUI 재시작 (sudo supervisorctl)"
( sudo supervisorctl restart comfyui 2>/dev/null ) \
  || ( supervisorctl restart comfyui 2>/dev/null ) \
  || echo "  (supervisorctl 실패 — 터미널에서 'sudo supervisorctl restart comfyui' 수동 실행)"
echo "DONE — /object_info 에 UnetLoaderGGUF 뜨면 준비 완료. gen-comfy.mjs 로 구동하세요."
