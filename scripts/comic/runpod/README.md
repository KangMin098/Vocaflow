# RunPod 4090 → 만화 패널 고속 생성 (fp8/GGUF · ~15초/장급)

RunPod **ComfyUI - AI-Dock**(`ghcr.io/ai-dock/comfyui`) Pod에서 Qwen-Image-Edit-2511을 돌리고,
로컬 `gen-comfy.mjs`로 REST 구동한다. Kaggle에서 실증한 GGUF Edit 워크플로를 그대로 재사용 —
4090이라 훨씬 빠르다. AI-Dock 기본 이미지엔 모델이 없으므로 1회 프로비저닝이 필요.

## 0) Pod 준비
- Pod **Start** → 상태 **Running** → **Connect → HTTP Services → 8188** 링크의 URL 확보
  (`https://<podid>-8188.proxy.runpod.net`). ComfyUI가 뜰 때까지 1-2분.
- ⚠️ **디스크**: Edit Q5 + t2i 세트 ~25GB. VRAM 22GB+ 면 Q5 자동, 그 미만은 Q4 자동
  (`provision.sh` 가 nvidia-smi 로 감지). 강제하려면 `EDIT_Q=Q4_K_M`.
- **인증(AI-Dock)**: AI-Dock 이미지는 모든 서비스 앞에 **폼 로그인**(포트 1111 `/login`)을 둔다.
  기본 계정 `user` / `password` (또는 Pod 환경변수 `WEB_USER`/`WEB_PASSWORD`). HTTP Basic 이 아니라
  쿠키 세션 — `gen-comfy.mjs` 가 `--user/--pass` 로 1111 에 자동 로그인해 `ai_dock_*_token` 쿠키를
  받아 8188 요청에 실어 보낸다(포트 간 서명키 공유). Cloudflare Quick Tunnel 링크는 로그인 우회.

## 0.5) ComfyUI 업데이트 (필수 — AI-Dock 기본 이미지는 구버전)
Qwen-Image-Edit-2511 의 `TextEncodeQwenImageEditPlus` 는 최신 ComfyUI 에만 있다. Pod 터미널에서:
```bash
CD=""; for c in /opt/ComfyUI "${WORKSPACE:-/workspace}/ComfyUI" /ComfyUI "$HOME/ComfyUI"; do [ -f "$c/main.py" ] && { CD="$c"; break; }; done
cd "$CD" && git pull --ff-only 2>/dev/null || (git fetch --depth 1 origin master && git reset --hard origin/master)
python3 -m pip -q install -r requirements.txt
```
(provision.sh 가 끝에 ComfyUI 를 재시작하므로 업데이트 → provision 순서로.)

⚠️ **PyTorch 2.5+ 필수** — 최신 ComfyUI 의 Qwen 텍스트 인코더는 `scaled_dot_product_attention(enable_gqa=…)`
(torch 2.5+) 를 쓴다. AI-Dock 기본 torch 2.4.1 이면 인코딩 단계에서 `unexpected keyword argument 'enable_gqa'`
로 죽는다. venv 에서 업그레이드:
```bash
/opt/environments/python/comfyui/bin/python -m pip install torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
sudo supervisorctl restart comfyui
```
(xformers 버전 경고는 무시 — ComfyUI 는 pytorch attention 사용.)

## 1) 프로비저닝 (Pod 웹 터미널에서 1회)
Pod의 **JupyterLab Terminal** 또는 **Connect → Web Terminal**에서:
```bash
bash provision.sh     # 이 파일 내용을 붙여넣어 실행
```
→ ComfyUI-GGUF 노드 설치 + 모델 다운로드(Edit-2511 Q5 · Qwen2.5-VL Q4 · mmproj · VAE ·
Lightning 8-step) + ComfyUI 재시작. 완료 후 `/object_info`에 `UnetLoaderGGUF`가 보이면 OK.

## 2) 로컬에서 구동 (REST)
참조 시트를 미리 두면 t2i 모델 없이도 Edit 패널 생성 가능(Scrooge 시트는 이미 검증됨):
```bash
# 검증된 Scrooge 시트를 refs 로 배치(선택 — 없으면 gen-comfy가 t2i로 생성, t2i 모델 필요)
mkdir -p out/carol-runpod/refs
cp <scrooge-sheet>.png out/carol-runpod/refs/scrooge.jpg

COMFY_URL="https://<podid>-8188.proxy.runpod.net" \
node scripts/comic/gen-comfy.mjs \
  --user user --pass password \   # AI-Dock 폼 로그인 → 쿠키 자동 획득
  --script scripts/comic/examples/carol-stave1.json \
  --out out/carol-runpod \
  --wf-gen scripts/comic/wf/qwen-t2i-from-edit.api.json \  # Edit 모델을 t2i 로 재사용(별도 t2i 모델 불필요)
  --wf-edit scripts/comic/wf/qwen-edit-lightning.api.json \
  --panels 1,4,9,13          # 먼저 Edit 패널만으로 파이프라인 검증
```
- `gen-comfy.mjs`: 참조 업로드(`/upload/image`) → 워크플로 타이틀(PROMPT/NEG/SIZE/REFIMAGE)에
  패널별 프롬프트·사이즈·참조 주입 → `/prompt`→`/history`→`/view` 회수 → `out/NN.jpg`.
- `--panels` 생략 시 전 패널. 클로즈업/`--noref` 패널은 t2i(`--wf-gen`) 사용 → t2i 모델 필요
  (provision.sh의 t2i 섹션 주석 해제).
- 이어서 조립: `node scripts/comic/03-assemble.mjs --script examples/carol-stave1.json
  --images out/carol-runpod --out out/carol.html --layout comic`.

## 3) 비용
- 초당 과금. 생성 안 할 땐 **Pod Stop**(Terminate 아님 — Stop은 볼륨 유지). 4090 Secure ~$0.69/h.

## 워크플로 규약 (gen-comfy 주입점)
`wf/qwen-edit-lightning.api.json` 노드 `_meta.title`:
- `PROMPT`/`NEG` = TextEncodeQwenImageEditPlus (프롬프트는 `.prompt` 필드 — gen-comfy가 자동 감지)
- `SIZE` = EmptySD3LatentImage · `REFIMAGE` = LoadImage(참조 시트)
- Edit-2511 Q5 GGUF + Lightning 8-step + ModelSamplingAuraFlow shift 3.0 + KSampler(steps 8, cfg 1.0, euler/simple).

fp8 최대속도로 가려면 UnetLoaderGGUF 대신 fp8 safetensors + `UNETLoader(weight_dtype=fp8_e4m3fn)`로
교체 가능(4090 네이티브). 우선은 검증된 GGUF로 확실히 돌린 뒤 필요 시 전환.
