// scripts/comic/pd/kaggle-restyle.mjs
//
// PDCP AI 리스타일 — Kaggle 무료 T4 headless 테스트. 여러 콘텐츠의 패널을 다운스케일·base64 임베드한
// 자가완결 커널(SDXL + ControlNet Canny, diffusers)을 Bearer push → poll → pull 한다. 터널/ComfyUI 불필요
// (kaggle-auto-test 패턴). 결과는 work/_kaggle-restyle/out/ 로 회수해 원작 대비 평가.
//
//   node scripts/comic/pd/kaggle-restyle.mjs [--contents whiz,ci027,...] [--per 2] [--slug pd-restyle] [--dry|--poll|--status|--pull]
//
// GPU 큐+셋업+모델다운로드로 10~40분 소요 가능. --poll 없으면 push 후 --status/--pull 로 확인.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) }
const has = (n) => process.argv.includes(`--${n}`)
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

// ── Kaggle Bearer ──
const kj = (() => { try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.kaggle', 'kaggle.json'), 'utf8')) } catch { return {} } })()
const KUSER = (process.env.KAGGLE_USERNAME || kj.username || '').trim()
const KKEY = (process.env.KAGGLE_KEY || kj.key || '').trim()
if (!KUSER || !KKEY) { console.error('✗ Kaggle 자격증명 없음 (~/.kaggle/kaggle.json)'); process.exit(2) }
const KH = { Authorization: `Bearer ${KKEY}`, 'Content-Type': 'application/json' }
const KAPI = 'https://www.kaggle.com/api/v1'
const SLUG_NAME = String(arg('slug', 'pd-restyle-test'))
const SLUG = `${KUSER.toLowerCase()}/${SLUG_NAME}`

async function kernelStatus() { const r = await fetch(`${KAPI}/kernels/status?userName=${encodeURIComponent(KUSER)}&kernelSlug=${SLUG_NAME}`, { headers: KH, signal: AbortSignal.timeout(30000) }); return r.json() }
async function pullOutput(outDir) {
  const r = await fetch(`${KAPI}/kernels/output?userName=${encodeURIComponent(KUSER)}&kernelSlug=${SLUG_NAME}`, { headers: KH, signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error(`output ${r.status}`)
  const j = await r.json(); fs.mkdirSync(outDir, { recursive: true }); let got = 0
  for (const f of j.files || []) {
    const name = f.fileName || f.name || ''
    if (!/\.(jpe?g|png|json|log)$/i.test(name)) continue
    const url = f.url || f.downloadUrl; if (!url) continue
    const d = await fetch(url, { headers: KH, signal: AbortSignal.timeout(120000) }); if (!d.ok) continue
    fs.writeFileSync(path.join(outDir, path.basename(name)), Buffer.from(await d.arrayBuffer()))
    if (/\.(jpe?g|png)$/i.test(name)) got++
  }
  if (j.log) fs.writeFileSync(path.join(outDir, '_kernel.log'), typeof j.log === 'string' ? j.log : JSON.stringify(j.log, null, 2))
  return { got }
}

const OUT = path.resolve('work/_kaggle-restyle/out')

// ── status/pull 전용 ──
if (has('status')) { const s = await kernelStatus(); console.log('status:', s.status, s.failureMessage || ''); process.exit(0) }
if (has('pull')) { const { got } = await pullOutput(OUT); console.log(`✓ pull ${got}장 → ${path.relative(REPO, OUT)}`); process.exit(0) }

// ── 패널 수집(다양한 콘텐츠) + 다운스케일 임베드 ──
const CONTENTS = String(arg('contents', 'whiz,ci027,1954-07classicsillustratedno.2ivanhoe_708,the-odyssey-classics-illustrated,illustratedclassicsmacbeth')).split(',')
const PER = Number(arg('per', 2))
const PX = Number(arg('px', 1024)) // 모델에 넣는 긴 변(px). 커널 base64 총량과 맞바꾼다.
const tmp = path.join(os.tmpdir(), 'pd-restyle-embed'); fs.mkdirSync(tmp, { recursive: true })
const FROM = arg('from', 'panels') // panels(컷) | restored(페이지, 로컬 vs Kaggle 페이지 비교용)
const items = []
for (const slug of CONTENTS) {
  const pdir = path.join(REPO, 'work', slug, FROM)
  if (!fs.existsSync(pdir)) { console.error(`  (skip ${slug}: ${FROM} 없음)`); continue }
  const all = fs.readdirSync(pdir).filter((f) => /^\d.*\.jpe?g$/i.test(f)).sort()
  // 표지 말고 본문 페이지를 뽑아 화풍 차이가 드러나게(중간에서 PER개)
  const mid = Math.max(0, Math.floor(all.length / 3))
  const files = all.slice(mid, mid + PER)
  for (const f of files) {
    const small = path.join(tmp, `${slug.slice(0, 12)}_${f}`)
    // ⚠️ 여기서 줄인 크기가 **모델이 보는 전부**다. 512 로 줄이면 1200px 컷의 정보 82% 를 버린 뒤
    // 다시 그리게 되므로, 화풍이 나아져도 총평은 "원본보다 못하다"가 된다(2026-08-12 실측).
    // 커널 소스에 base64 로 싣는 구조라 무한정 키울 수는 없다 — 총량을 아래에서 경고한다.
    spawnSync(FF, ['-y', '-i', path.join(pdir, f), '-vf', `scale='min(${PX},iw)':-2:flags=lanczos`, '-q:v', '5', small], { encoding: 'utf8' })
    if (!fs.existsSync(small)) continue
    items.push({ name: `${slug.slice(0, 16)}__${f}`, content: slug, b64: fs.readFileSync(small).toString('base64') })
  }
}
if (!items.length) { console.error('임베드할 패널 없음'); process.exit(1) }
const embedKB = items.reduce((s, it) => s + it.b64.length, 0) / 1024
console.error(`패널 ${items.length}개(콘텐츠 ${CONTENTS.length}) · 입력 ${PX}px · 임베드 ${embedKB.toFixed(0)}KB`)
// 커널 소스가 커지면 push 가 조용히 거부되거나 편집기가 못 연다. 넘기 전에 말해준다.
if (embedKB > 4096) console.error(`  ⚠ 임베드 ${(embedKB / 1024).toFixed(1)}MB — 큽니다. --per 를 줄이거나 --px 를 낮추세요(또는 Dataset 첨부 방식으로).`)

const manifestB64 = Buffer.from(JSON.stringify(items.map((it) => ({ name: it.name, b64: it.b64 })))).toString('base64')

// ── 자가완결 커널(SDXL + ControlNet Canny) ──
const KERNEL = `import os, json, base64, io, time
import subprocess
# 완전 정합 torch-2.4 스택(2024-08 동시대) — torch 2.4.1 은 sm_60(P100)+sm_75(T4) 둘 다 지원.
# 트리오(torch/vision/audio) 일괄 + 그 시대 diffusers/transformers/hub 로 import 충돌 차단(v5 실패 교훈).
subprocess.run("pip -q install torch==2.4.1 torchvision==0.19.1 torchaudio==2.4.1 --index-url https://download.pytorch.org/whl/cu121", shell=True)
subprocess.run("pip -q install 'diffusers==0.30.0' 'transformers==4.44.2' 'huggingface_hub==0.25.1' 'accelerate==0.33.0' safetensors opencv-python-headless", shell=True)
import torch, cv2, numpy as np
print("torch", torch.__version__, torch.version.cuda, torch.cuda.get_device_name(0) if torch.cuda.is_available() else "no-cuda")
from PIL import Image
from diffusers import StableDiffusionXLControlNetImg2ImgPipeline, ControlNetModel, AutoencoderKL
OUT="/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
ITEMS=json.loads(base64.b64decode("${manifestB64}").decode())
print("panels", len(ITEMS), "cuda", torch.cuda.is_available())
cn=ControlNetModel.from_pretrained("diffusers/controlnet-canny-sdxl-1.0", torch_dtype=torch.float16)
vae=AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix", torch_dtype=torch.float16)
# img2img + ControlNet — 원작을 init 이미지로 넣어 팔레트 앵커링(색 오해석·보라 캐스트 차단).
pipe=StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0", controlnet=cn, vae=vae, torch_dtype=torch.float16, variant="fp16", use_safetensors=True)
pipe.enable_model_cpu_offload()
try: pipe.enable_vae_slicing()
except Exception: pass
# "vibrant" 제거(보라 캐스트 유발) + 원색 유지 지시. NEG 에 색 왜곡 억제.
PROMPT="clean modern digital comic illustration, crisp linework, smooth cel shading, faithful to the original colors, high detail"
NEG="halftone dots, paper texture, yellowed, faded, grain, blurry, jpeg artifacts, watermark, deformed hands, purple tint, magenta cast, oversaturated, color shift, washed out"
g=torch.Generator(device="cuda").manual_seed(7)
def fit(img,t=1024):
    w,h=img.size; s=t/max(w,h); return img.resize((max(8,int(w*s)//8*8), max(8,int(h*s)//8*8)), Image.LANCZOS)
res={}
for it in ITEMS:
    try:
        src=Image.open(io.BytesIO(base64.b64decode(it["b64"]))).convert("RGB"); base=fit(src)
        a=np.array(base); e=cv2.Canny(cv2.cvtColor(a,cv2.COLOR_RGB2GRAY),90,200); ctrl=Image.fromarray(np.stack([e]*3,-1))
        out=pipe(prompt=PROMPT, negative_prompt=NEG, image=base, control_image=ctrl, strength=0.5, controlnet_conditioning_scale=0.7, num_inference_steps=30, guidance_scale=5.5, generator=g).images[0]
        out=out.resize(base.size, Image.LANCZOS); out.save(os.path.join(OUT,it["name"]), quality=92); res[it["name"]]="ok"; print("ok", it["name"])
    except Exception as ex:
        res[it["name"]]=str(ex); print("ERR", it["name"], ex)
json.dump(res, open(os.path.join(OUT,"_manifest.json"),"w"))
print("done", sum(1 for v in res.values() if v=="ok"), "/", len(ITEMS))
`
console.error(`커널 ${(KERNEL.length / 1024).toFixed(0)}KB`)
if (has('dry')) { console.error('(dry) push 생략'); process.exit(0) }

// ── push ──
// ⚠️ machineShape 필수 — 없으면 Kaggle 이 **P100(sm_60)** 을 배정할 수 있고, 그러면 최신 torch 휠에
// sm_60 커널이 없어 전 컷이 `CUDA error: no kernel image is available for execution on the device` 로
// 죽는다(2026-08-14 실측: 0/4). 커널이 정상 기동해 로그도 깨끗해 보이므로 원인이 잘 안 보인다.
const ACCEL = String(arg('accel', 'NvidiaTeslaT4'))
const body = { id: null, slug: SLUG, newTitle: SLUG_NAME, text: KERNEL, language: 'python', kernelType: 'script', isPrivate: true, enableGpu: true, enableTpu: false, enableInternet: true, machineShape: ACCEL, datasetDataSources: [], competitionDataSources: [], kernelDataSources: [], modelDataSources: [], categoryIds: [] }
const pr = await fetch(`${KAPI}/kernels/push`, { method: 'POST', headers: KH, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
const pj = await pr.json().catch(() => ({}))
if (!pr.ok || pj.hasError) { console.error(`✗ push ${pr.status}: ${pj.error || JSON.stringify(pj).slice(0, 200)}`); process.exit(1) }
console.error(`✓ push OK · ${pj.url} (v${pj.versionNumber})`)
console.error(`  콘텐츠: ${CONTENTS.join(', ')} · 패널 ${items.length}`)

if (!has('poll')) {
  console.error(`\n  진행: node scripts/comic/pd/kaggle-restyle.mjs --status --slug ${SLUG_NAME}`)
  console.error(`  회수: node scripts/comic/pd/kaggle-restyle.mjs --pull   --slug ${SLUG_NAME}`)
  process.exit(0)
}
console.error('  폴링(10~40분)…')
const t0 = Date.now()
for (let i = 0; i < 90; i++) {
  await new Promise((z) => setTimeout(z, 30000))
  let s; try { s = await kernelStatus() } catch { continue }
  process.stderr.write(`\r  [${Math.round((Date.now() - t0) / 60000)}m] ${s.status}      `)
  if (['complete', 'error', 'cancelAcknowledged'].includes(String(s.status))) {
    console.error('')
    if (s.status !== 'complete') { console.error(`✗ ${s.status}: ${s.failureMessage || ''}`); process.exit(1) }
    const { got } = await pullOutput(OUT); console.error(`✓ 완료 · pull ${got}장 → ${path.relative(REPO, OUT)}`); process.exit(0)
  }
}
console.error('\n타임아웃 — 나중에 --status/--pull')
