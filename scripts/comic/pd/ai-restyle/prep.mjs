// scripts/comic/pd/ai-restyle/prep.mjs
//
// AI 리스타일 트랙 — Kaggle/RunPod 입력 준비 (PDCP **선택** 현대화 트랙, GPU 모델).
// 원작을 다시 그리는(화풍 변경·구도 유지) GPU 리스타일용 입력을 내보낸다. 작화 보존 트랙(page-modern)과 별개.
//
// 처리 단위 = **패널 크롭**(연구 근거: 텍스트 뭉개짐 차단 + GPU 메모리 적합). segment 산출 panels/ 사용.
// 출력: work/<slug>/ai-restyle/inputs/*.jpg + job.json (모델·프롬프트·패널목록·레터링 오버레이 데이터).
// 이 폴더를 zip 해 Kaggle Dataset 으로 올리거나 RunPod 볼륨에 넣는다. Kaggle 노트북이 job.json 을 읽고 돈다.
//
//   node scripts/comic/pd/ai-restyle/prep.mjs --workdir work/<slug> [--engine kaggle-sdxl|runpod-qie] [--limit N]

import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..', '..')

const WD = arg('workdir')
const ENGINE = arg('engine', 'kaggle-sdxl') // kaggle-sdxl(파일럿) | runpod-qie(양산)
const LIMIT = arg('limit') ? Number(arg('limit')) : null
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }

const panelsDir = path.join(WD, 'panels')
const pm = fs.existsSync(path.join(panelsDir, 'panels.manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(panelsDir, 'panels.manifest.json'), 'utf8')).panels
  : null
if (!pm) { console.error(`panels.manifest.json 없음 — 먼저 segment 실행: ${panelsDir}`); process.exit(2) }

// 레터링 오버레이 데이터(리스타일이 텍스트를 뭉개므로 대사는 원작 좌표 기준 폴백 오버레이) — refined 우선.
let bubbles = {}
const rp = path.join(WD, 'bubbles.refined.manifest.json')
if (fs.existsSync(rp)) { try { for (const p of JSON.parse(fs.readFileSync(rp, 'utf8')).panels || []) bubbles[`${p.pageOrder}-${p.panelIndex}`] = (p.bubbles || []).map((b) => b.text).filter(Boolean) } catch { /* noop */ } }

let panels = [...pm].sort((a, b) => (a.pageOrder - b.pageOrder) || (a.panelIndex - b.panelIndex))
if (LIMIT) panels = panels.slice(0, LIMIT)

const outDir = path.join(WD, 'ai-restyle')
const inDir = path.join(outDir, 'inputs')
fs.mkdirSync(inDir, { recursive: true })

// 엔진별 기본 프리셋(콘솔에서 덮어쓸 수 있음). 프롬프트는 "현대 디지털 코믹/웹툰" 방향.
const PRESETS = {
  'kaggle-sdxl': {
    model: 'stabilityai/stable-diffusion-xl-base-1.0',
    controlnet: 'diffusers/controlnet-canny-sdxl-1.0',
    control: 'canny', controlScale: 0.9, strength: 0.72, steps: 26, guidance: 6.0,
    prompt: 'modern digital comic art, clean flat vibrant colors, crisp bold linework, webtoon style, smooth shading, high detail',
    negative: 'halftone dots, paper texture, yellowed, faded, grain, blurry, jpeg artifacts, watermark, deformed hands',
  },
  'runpod-qie': {
    model: 'Qwen/Qwen-Image-Edit-2511', quant: 'fp8',
    instruction: 'Redraw this comic panel in a modern digital webtoon style with clean flat vibrant colors and crisp linework. Keep the exact same composition, characters, poses, and layout. Do not change the scene.',
    steps: 28, guidance: 4.0,
  },
}
const preset = PRESETS[ENGINE] || PRESETS['kaggle-sdxl']

const jobPanels = []
for (const [i, p] of panels.entries()) {
  const src = path.isAbsolute(p.file) ? p.file : path.join(REPO, p.file)
  const inFile = fs.existsSync(src) ? src : path.join(panelsDir, path.basename(p.file))
  if (!fs.existsSync(inFile)) continue
  const name = `${String(i).padStart(3, '0')}.jpg`
  fs.copyFileSync(inFile, path.join(inDir, name))
  jobPanels.push({
    id: i, file: name, page: p.page, pageOrder: p.pageOrder, panelIndex: p.panelIndex,
    lettering: bubbles[`${p.pageOrder}-${p.panelIndex}`] || [], // 오버레이 폴백용 대사(리스타일 후 위에 얹음)
  })
}

const job = {
  slug: path.basename(WD), engine: ENGINE, generatedBy: 'pd/ai-restyle/prep', track: 'ai-restyle (GPU 모델, 선택 트랙)',
  note: '원작 재작화(화풍 변경, 구도 유지). 작화 보존 트랙(page-modern)과 별개. 리스타일 후 레터링은 오버레이 폴백.',
  preset, panels: jobPanels, count: jobPanels.length,
}
fs.writeFileSync(path.join(outDir, 'job.json'), JSON.stringify(job, null, 2))

console.log(`✓ AI 리스타일 입력 준비 — 패널 ${jobPanels.length} · 엔진 ${ENGINE}`)
console.log(`  inputs: ${path.relative(REPO, inDir)}  ·  job.json`)
console.log(`  다음: 이 폴더를 zip → Kaggle Dataset 업로드(또는 RunPod 볼륨) → 노트북 Run All`)
console.log(`  Kaggle 노트북: scripts/comic/pd/ai-restyle/kaggle_pilot.ipynb`)
