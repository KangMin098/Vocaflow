#!/usr/bin/env node
// scripts/design/illo-colab.mjs
//
// **Google Colab 무료 T4 노트북 생성기** — Kaggle 주간 GPU 한도(30h)를 다 쓴 주의 대체 경로(2026-10-07).
// 레시피는 illo-kaggle.mjs --quality 와 같다: Qwen-Image GGUF Q3_K_S + Qwen2.5-VL Q4 + VAE, Lightning 없이 20스텝 · cfg 4.
// 장면 · 화풍은 lib/illo-tines-scenes.mjs 단일 출처를 읽어 노트북에 굽는다(Colab 에서 저장소를 받지 않는다).
//
//   node scripts/design/illo-colab.mjs --only spot-reading,spot-quiz      # → tmp/illo-colab.ipynb
//   (Colab: 파일 업로드 → 런타임 유형 T4 GPU → 모두 실행 → 결과는 내 드라이브/vocaflow-illo-out 에 한 장씩)
//   node scripts/design/illo-colab.mjs --import <PNG 폴더> --out tmp/colab-out   # 바탕 빼기 + WebP
//
// 함정(2026-10-07 실측 넷): ① requirements 의 torch 를 따라 깔면 CUDA 가 깨진다 — 이름이 정확히 torch* 인 셋만 뺀다
//   (앞글자 비교는 torchsde 까지 빼 서버가 안 뜬다) ② 일반 VAEDecode 에서 서버가 죽었다 → VAEDecodeTiled
//   ③ 모델을 올리는 동안 연결 거절 — 서버가 살아 있으면 기다린다 ④ 셀 2 재실행이 둘째 서버를 띄워 「서버 종료」로 오판 —
//   떠 있으면 다시 띄우지 않는다. 결과는 Drive 에 바로 써서 세션이 끊겨도 남고, 다시 실행하면 이어서 만든다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'
import { NEG, SCENES, keyAndEncode } from './lib/illo-tines-scenes.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const ONLY = arg('--only', null)?.split(',') ?? null
const IMPORT = arg('--import', null)
const OUT = path.join(ROOT, arg('--out', 'tmp/colab-out'))
const NB = path.join(ROOT, arg('--nb', 'tmp/illo-colab.ipynb'))
const VARIANTS = Number(arg('--variants', '1'))

const sizeOf = (s) => (s.size === '1664*928' ? [1344, 768] : s.size === '1472*1140' ? [1152, 896] : [1024, 1024])

if (IMPORT) {
  // 받은 PNG(<id>.png 또는 <id>__v<n>.png) → 바탕 빼기 + WebP. 시안 고르기는 사람이 한다(같은 id 의 시안은 모두 변환).
  const byId = Object.fromEntries(SCENES.map((s) => [s.id, s]))
  fs.mkdirSync(OUT, { recursive: true })
  const b = await chromium.launch(); const pg = await b.newPage()
  let n = 0
  for (const f of fs.readdirSync(IMPORT).filter((x) => x.endsWith('.png'))) {
    const id = f.replace(/(__v\d+)?\.png$/, '')
    const s = byId[id]
    if (!s) { console.log('  ? 장면 없음', f); continue }
    const src = 'data:image/png;base64,' + fs.readFileSync(path.join(IMPORT, f)).toString('base64')
    const b64 = await pg.evaluate(keyAndEncode, [src, s.key !== false])
    fs.writeFileSync(path.join(OUT, f.replace(/\.png$/, '.webp')), Buffer.from(b64, 'base64'))
    n++
  }
  await b.close()
  console.log(`변환 ${n}장 → ${path.relative(ROOT, OUT)}`)
  process.exit(0)
}

const scenes = SCENES.filter((s) => !ONLY || ONLY.includes(s.id))
if (!scenes.length) { console.error('장면이 없다 — --only 확인'); process.exit(2) }
const jobs = scenes.flatMap((s) => Array.from({ length: VARIANTS }, (_, v) => {
  const [w, h] = sizeOf(s)
  return { id: VARIANTS > 1 ? `${s.id}__v${v}` : s.id, prompt: `${s.scene} ${s.style}`, neg: NEG, w, h, seed: 1000 + v * 7919 + s.id.length * 31 }
}))

const code = (src) => ({ cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: src.trim().split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l)) })
const md = (src) => ({ cell_type: 'markdown', metadata: {}, source: [src] })

const cells = [
  md(`# Vocaflow 삽화 생성 (Colab T4)\n\n1. **런타임 → 런타임 유형 변경 → T4 GPU**\n2. **런타임 → 모두 실행** — 처음에 Google Drive 연결 허용 창이 한 번 뜹니다\n3. 결과는 **내 드라이브/vocaflow-illo-out** 에 한 장씩 바로 저장됩니다(세션이 끊겨도 남음)\n4. 끊기면 **모두 실행**을 다시 누르면 이미 만든 장은 건너뛰고 이어서 만듭니다\n\n작업 ${jobs.length}장 · 장당 약 18분.`),
  code(`
# 0) Google Drive 연결 — 결과를 세션 밖에 남긴다
from google.colab import drive
drive.mount('/content/drive')
import os
OUTDIR = '/content/drive/MyDrive/vocaflow-illo-out'
os.makedirs(OUTDIR, exist_ok=True)
print('저장 위치', OUTDIR, '· 이미 있는 장', len([f for f in os.listdir(OUTDIR) if f.endswith('.png')]))
`),
  code(`
# 1) ComfyUI + GGUF 노드 + 모델(약 14GB) — 처음 한 번 10~15분
import os, subprocess, sys
COMFY = '/content/ComfyUI'
def sh(*a): subprocess.run(list(a), check=False)
if not os.path.exists(COMFY):
    sh('git', 'clone', 'https://github.com/comfyanonymous/ComfyUI', COMFY)
    sha = subprocess.run(['git', '-C', COMFY, 'rev-list', '-1', '--before=2025-11-01', 'HEAD'], capture_output=True, text=True).stdout.strip()
    if sha: sh('git', '-C', COMFY, 'checkout', sha)
    sh('git', 'clone', '--depth', '1', 'https://github.com/city96/ComfyUI-GGUF', COMFY + '/custom_nodes/ComfyUI-GGUF')
    # Colab 에 깔린 torch 를 건드리지 않는다(requirements 의 torch 를 따라 깔면 CUDA 가 깨진다 — Kaggle 커널과 같은 처리)
    import re
    def pkg(l): return re.split(r'[=<>~!;\\[ ]', l.strip(), 1)[0].lower()
    keep = [l for l in open(COMFY + '/requirements.txt').read().splitlines()
            if l.strip() and not l.strip().startswith('#') and pkg(l) not in ('torch', 'torchvision', 'torchaudio')]
    open('/content/req.txt', 'w').write('\\n'.join(keep))
    sh(sys.executable, '-m', 'pip', '-q', 'install', '-r', '/content/req.txt', 'gguf')
import torch; print('GPU:', torch.cuda.is_available() and torch.cuda.get_device_name(0), torch.__version__)
HF = 'https://huggingface.co'
FILES = [
  (HF + '/city96/Qwen-Image-gguf/resolve/main/qwen-image-Q3_K_S.gguf', 'unet'),
  (HF + '/chatpig/qwen2.5-vl-7b-it-gguf/resolve/main/qwen2.5-vl-7b-it-q4_k_m.gguf', 'text_encoders'),
  (HF + '/chatpig/qwen2.5-vl-7b-it-gguf/resolve/main/mmproj-qwen2.5-vl-7b-it-bf16.gguf', 'text_encoders'),
  (HF + '/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors', 'vae'),
]
for url, sub in FILES:
    d = f'{COMFY}/models/{sub}'; os.makedirs(d, exist_ok=True)
    dst = d + '/' + url.rsplit('/', 1)[1]
    if not os.path.exists(dst): sh('wget', '-q', '-c', '-O', dst, url)
    print(sub, os.path.basename(dst), round(os.path.getsize(dst) / 1e9, 2), 'GB')
`),
  code(`
# 2) ComfyUI 서버 띄우기(백그라운드)
import time, urllib.request
def up():
    try: urllib.request.urlopen('http://127.0.0.1:8188/system_stats', timeout=3); return True
    except Exception: return False
# 이미 떠 있으면 새로 띄우지 않는다(같은 포트에 둘째 서버를 띄우면 그쪽이 바로 죽어 「서버 종료」로 오판했다)
if not (globals().get('proc') and proc.poll() is None and up()):
    proc = subprocess.Popen([sys.executable, '-u', 'main.py', '--listen', '127.0.0.1', '--port', '8188', '--lowvram', '--output-directory', '/content/comfy-out'],
                            cwd=COMFY, stdout=open('/content/comfy.log', 'w'), stderr=subprocess.STDOUT)
for _ in range(120):
    if up(): break
    time.sleep(5)
print('comfy up', up())
if not up():
    print(open('/content/comfy.log').read()[-3000:])
    raise SystemExit('ComfyUI 가 뜨지 않았다 — 위 로그를 알려 주세요')
`),
  code(`
# 3) 생성 — 이미 만든 파일은 건너뛴다(다시 실행하면 이어서)
import json, base64
JOBS = json.loads(base64.b64decode("${Buffer.from(JSON.stringify(jobs)).toString('base64')}").decode())
def call(p, data=None):
    req = urllib.request.Request('http://127.0.0.1:8188' + p, data=(json.dumps(data).encode() if data is not None else None), headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=300).read())
for j in JOBS:
    dst = OUTDIR + '/' + j['id'] + '.png'
    if os.path.exists(dst): print('skip', j['id']); continue
    t = time.time()
    wf = {
     "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "qwen-image-Q3_K_S.gguf"}},
     "2": {"class_type": "CLIPLoaderGGUF", "inputs": {"clip_name": "qwen2.5-vl-7b-it-q4_k_m.gguf", "type": "qwen_image"}},
     "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
     "4": {"class_type": "CLIPTextEncode", "inputs": {"text": j["prompt"], "clip": ["2", 0]}},
     "5": {"class_type": "CLIPTextEncode", "inputs": {"text": j["neg"], "clip": ["2", 0]}},
     "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": j["w"], "height": j["h"], "batch_size": 1}},
     "7": {"class_type": "ModelSamplingAuraFlow", "inputs": {"shift": 3.1, "model": ["1", 0]}},
     "8": {"class_type": "KSampler", "inputs": {"seed": j["seed"], "steps": 20, "cfg": 4, "sampler_name": "euler", "scheduler": "simple", "denoise": 1, "model": ["7", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0]}},
     # 조각 디코드 — 일반 VAEDecode 는 본 모델(8.5GB)을 RAM 으로 내리다 무료 Colab RAM(12GB)을 넘겨 서버가 죽었다(2026-10-07)
     "9": {"class_type": "VAEDecodeTiled", "inputs": {"samples": ["8", 0], "vae": ["3", 0], "tile_size": 512, "overlap": 64, "temporal_size": 64, "temporal_overlap": 8}},
     "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": j["id"]}}}
    try:
        pid = None
        for _ in range(60):
            try:
                pid = call('/prompt', {'prompt': wf, 'client_id': 'illo'})['prompt_id']; break
            except Exception as ce:
                if proc.poll() is not None: raise Exception(f'서버 종료(코드 {proc.poll()}): {ce}')
                time.sleep(10)
        if not pid: raise Exception('작업을 넣지 못했다(10분)')
        done, refused, deadline = None, 0, time.time() + 45 * 60
        while time.time() < deadline:
            # 모델을 올리는 동안 서버가 잠깐 연결을 받지 못한다(Connection refused, 2026-10-07 실측) — 살아 있으면 기다리되 5분 연속이면 멈춘다
            try:
                h = call('/history/' + pid); refused = 0
            except Exception as ce:
                if proc.poll() is not None: raise Exception(f'서버 종료(코드 {proc.poll()}): {ce}')
                refused += 1
                if refused >= 30: raise Exception(f'5분 연속 연결 거절: {ce}')
                time.sleep(10); continue
            if pid in h and h[pid].get('outputs'): done = h[pid]; break
            st = h.get(pid, {}).get('status', {})
            if st.get('status_str') == 'error':
                raise Exception('ComfyUI 오류: ' + json.dumps(st.get('messages', []), ensure_ascii=False)[-1500:])
            time.sleep(3)
        if not done: raise Exception('45분 안에 끝나지 않았다')
        im = done['outputs']['10']['images'][0]
        src = os.path.join('/content/comfy-out', im.get('subfolder', ''), im['filename'])
        with open(src, 'rb') as a, open(dst, 'wb') as b: b.write(a.read())
        print('ok', j['id'], round(time.time() - t), 's', flush=True)
    except Exception as e:
        print('fail', j['id'], e, '· 서버 종료 코드', proc.poll(), '(None = 살아 있음, -9 = 메모리 부족으로 강제 종료)', flush=True)
        print(open('/content/comfy.log').read()[-2000:])
        break
`),
  code(`
# 4) 결과 확인 — 파일은 이미 내 드라이브/vocaflow-illo-out 에 있다(내려받기 불필요)
done_ids = sorted(f for f in os.listdir(OUTDIR) if f.endswith('.png'))
print(len(done_ids), '/', len(JOBS), '장 완료'); print('\\n'.join(done_ids))
`),
]

const nb = { cells, metadata: { accelerator: 'GPU', colab: { gpuType: 'T4', provenance: [] }, kernelspec: { name: 'python3', display_name: 'Python 3' }, language_info: { name: 'python' } }, nbformat: 4, nbformat_minor: 0 }
fs.mkdirSync(path.dirname(NB), { recursive: true })
fs.writeFileSync(NB, JSON.stringify(nb, null, 1))
console.log(`노트북 → ${path.relative(ROOT, NB)} · 장면 ${scenes.length} · 작업 ${jobs.length}`)
