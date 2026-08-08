# scripts/comic/kaggle/setup-comfyui-comic.py
# CCP 자가호스트(Kaggle T4) — ComfyUI + cloudflared 터널 → 공개 URL.
#   Kaggle 노트북 셀에 붙여 실행. 출력된 URL 을 로컬 scripts/comic/.comfy-url 에 저장하면
#   RunPod 과 동일하게 gen-flux2.mjs(--comfy URL) 로 생성 가능.
#   Kaggle T4 = 16GB → min_vram<=15GB 모델 권장(Qwen-Edit Q4 / SD3.5 Med / Z-Image / HiDream NF4).
#   FLUX.2 dev(Q4 19GB)는 RunPod 4090 전용.
#
# 사용:
#   1) Kaggle 노트북 GPU=T4 로 새로 생성 (Settings → Accelerator → GPU T4 x2 중 1개 사용)
#   2) 이 파일 내용을 셀에 붙이고 MODEL 을 골라 Run
#   3) 출력 마지막의 https://xxxx.trycloudflare.com 복사 → 로컬에서:
#        echo <URL> > scripts/comic/.comfy-url
#   4) node scripts/comic/gen-flux2.mjs --script <adapted.json> --out <dir> --style gonick

import os, subprocess, sys, time, threading, urllib.request, re

MODEL = os.environ.get("COMIC_MODEL", "qwen-edit-q4")  # kaggle-fit 기본
HOME = "/kaggle/working"
COMFY = f"{HOME}/ComfyUI"

def sh(cmd, **kw):
    print(f"$ {cmd}")
    return subprocess.run(cmd, shell=True, check=kw.get("check", True))

# 1. ComfyUI + GGUF/ControlNet 커스텀 노드
if not os.path.isdir(COMFY):
    sh(f"git clone --depth 1 https://github.com/comfyanonymous/ComfyUI {COMFY}")
sh(f"pip -q install -r {COMFY}/requirements.txt")
sh(f"pip -q install gguf sentencepiece")
nodes = {
    "ComfyUI-GGUF": "https://github.com/city96/ComfyUI-GGUF",
    "comfyui_controlnet_aux": "https://github.com/Fannovel16/comfyui_controlnet_aux",
}
for name, url in nodes.items():
    d = f"{COMFY}/custom_nodes/{name}"
    if not os.path.isdir(d):
        sh(f"git clone --depth 1 {url} {d}", check=False)

# 2. 모델 파일 (환경변수 MODEL 로 선택 — Kaggle-fit 기본 Qwen-Edit Q4)
os.makedirs(f"{COMFY}/models/unet", exist_ok=True)
os.makedirs(f"{COMFY}/models/vae", exist_ok=True)
os.makedirs(f"{COMFY}/models/clip", exist_ok=True)
os.makedirs(f"{COMFY}/models/loras", exist_ok=True)

def hf(dst, repo, path):
    if os.path.exists(dst):
        print(f"· {os.path.basename(dst)} 있음"); return
    sh(f'wget -q -O "{dst}" "https://huggingface.co/{repo}/resolve/main/{path}"', check=False)

MODELS = {
    # kaggle-fit (<=16GB)
    "qwen-edit-q4": lambda: (
        hf(f"{COMFY}/models/unet/qwen-image-edit-2511-Q4_K_M.gguf", "QuantStack/Qwen-Image-Edit-2511-GGUF", "Qwen-Image-Edit-2511-Q4_K_M.gguf"),
    ),
    "sd35-medium": lambda: (
        hf(f"{COMFY}/models/checkpoints/sd3.5_medium.safetensors", "stabilityai/stable-diffusion-3.5-medium", "sd3.5_medium.safetensors"),
    ),
    "z-image-turbo": lambda: (
        hf(f"{COMFY}/models/checkpoints/z-image-turbo.safetensors", "Tongyi-MAI/Z-Image-Turbo", "z-image-turbo.safetensors"),
    ),
    # runpod 전용(참고 — Kaggle 16GB엔 빠듯)
    "flux2-dev-q4": lambda: (
        hf(f"{COMFY}/models/unet/flux2-dev-Q4_K_M.gguf", "bullerwins/FLUX.2-dev-GGUF", "flux2-dev-Q4_K_M.gguf"),
        hf(f"{COMFY}/models/vae/flux2-vae.safetensors", "black-forest-labs/FLUX.2-dev", "vae/diffusion_pytorch_model.safetensors"),
    ),
}
os.makedirs(f"{COMFY}/models/checkpoints", exist_ok=True)
(MODELS.get(MODEL) or MODELS["qwen-edit-q4"])()
print(f"모델 준비: {MODEL}")

# 3. cloudflared
if not os.path.exists(f"{HOME}/cloudflared"):
    sh(f'wget -q -O {HOME}/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64')
    sh(f"chmod +x {HOME}/cloudflared")

# 4. ComfyUI 서버 (백그라운드)
def run_comfy():
    subprocess.run(f"cd {COMFY} && python main.py --listen 0.0.0.0 --port 8188", shell=True)
threading.Thread(target=run_comfy, daemon=True).start()
print("ComfyUI 기동 대기...")
for _ in range(60):
    try:
        urllib.request.urlopen("http://127.0.0.1:8188/", timeout=2); break
    except Exception:
        time.sleep(3)

# 5. 터널 → 공개 URL
proc = subprocess.Popen(f"{HOME}/cloudflared tunnel --url http://127.0.0.1:8188",
                        shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
url = None
for line in proc.stdout:
    print(line, end="")
    m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line)
    if m and not url:
        url = m.group(0)
        print("\n" + "=" * 60)
        print(f"  ✅ COMFY_URL = {url}")
        print(f"  로컬에서:  echo {url} > scripts/comic/.comfy-url")
        print("=" * 60 + "\n")
