// scripts/comic/pd/modernize.mjs
//
// PDCP 현대화 — **모델 트랙**. 컷을 다시 그린다.
// 설계: scripts/comic/docs/PD_MODERNIZE_MODEL.md
//
//   node scripts/comic/pd/modernize.mjs --workdir work/pdcp/<slug> \
//     [--model qwen-image-edit-2511] [--env runpod-4090] [--limit 8] [--dry-run]
//
// ── 기존 CPU 트랙(page-modern/webtoon)을 대체하지 않는다 ─────────────
// 원작 작화를 그대로 두는 트랙과 다시 그리는 트랙은 산출물의 성격이 다르다.
// 기본값은 여전히 CPU 트랙이고, 이건 "스캔이 심하게 상해 CPU 로 안 되는 호"용이다.
//
// ── 글자는 모델에 맡기지 않는다 (핵심) ───────────────────────────────
// 흔한 접근은 "텍스트를 잘 보존하는 모델"을 고르는 것이다. 우리는 그럴 필요가 없다 —
// OCR 단계가 이미 말풍선 좌표를 갖고 있고, page-letter 가 비파괴 레이어로 문구를 다시 얹는다.
// 그래서 순서를 뒤집는다: **말풍선을 지우고 → 모델에 그림만 맡기고 → 문구를 다시 부착.**
// 어떤 모델도 1940년대 손레터링을 "읽기 좋게" 재현하지는 못한다. 벡터로 얹는 게 낫다.
//
// ── 모델 지식을 복제하지 않는다 ──────────────────────────────────────
// 어떤 모델이 어떤 워크플로·환경에서 도는지는 CCP 의 model-runners.mjs 가 SSoT 다.
// 여기서는 resolveRunner() 로 물어보기만 한다. 목록을 베끼면 즉시 어긋난다.
//
// gen-comfy.mjs 를 호출하지 않는 이유: 그쪽은 CCP 스크립트 계약(--script = 만화 대본 JSON)에
// 묶여 있고 t2i 워크플로가 필수다. PDCP 는 대본이 없고 **실제 원본 컷 이미지**가 입력이다.
// 워크플로 파일과 러너 메타는 공유하되, 입력 계약이 다르므로 클라이언트만 따로 둔다.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveRunner } from '../model-runners.mjs'
import { emitProgress } from './progress.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF =
  process.env.FFMPEG_BIN ||
  (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe'))
    ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')
    : 'ffmpeg')

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i === -1 ? d : process.argv[i + 1]
}
const has = (n) => process.argv.includes(`--${n}`)

/**
 * 현대화 프롬프트. 구도·인물은 그대로 두고 **표현만** 바꾸라고 명시한다.
 * 말풍선은 이미 지워서 넣으므로 "글자를 유지하라"는 지시를 넣지 않는다 —
 * 넣으면 모델이 없는 글자를 지어낸다(실측되는 전형적 실패).
 */
const PROMPT =
  'Redraw this comic panel in a clean modern digital comic style. ' +
  'Keep the exact same composition, camera angle, character poses, expressions and layout. ' +
  'Flat vibrant colors, crisp clean linework, no halftone dots, no paper texture, no yellowing. ' +
  'Leave blank speech balloon shapes empty — no text, no letters, no words anywhere.'

const NEG =
  'halftone, newsprint texture, yellowed paper, scan artifacts, moire, ' +
  'text, letters, words, watermark, signature, changed composition, extra characters'

// ─── ComfyUI 최소 클라이언트 ─────────────────────────────────────────
// 큐 → 폴링 → 산출물 회수. gen-comfy 가 하는 일과 같지만 입력 계약만 다르다.

function comfyBase() {
  const u = process.env.COMFY_URL || readIfExists(path.join(REPO, '.comfy-url'))
  if (!u) {
    throw new Error(
      'COMFY_URL 이 없습니다.\n' +
        '  RunPod/Kaggle ComfyUI 주소를 COMFY_URL 환경변수나 저장소 루트 .comfy-url 파일에 두세요.\n' +
        '  (모델 트랙은 외부 GPU 가 떠 있어야 동작합니다 — CPU 트랙은 page-modern.mjs)',
    )
  }
  return u.trim().replace(/\/+$/, '')
}

function readIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

async function uploadImage(base, file) {
  const buf = fs.readFileSync(file)
  const fd = new FormData()
  fd.append('image', new Blob([buf]), path.basename(file))
  fd.append('overwrite', 'true')
  const r = await fetch(`${base}/upload/image`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(`업로드 실패 ${r.status} ${path.basename(file)}`)
  return (await r.json()).name
}

/** 노드 타이틀로 찾아 값을 넣는다 — 워크플로 구조가 바뀌어도 타이틀만 맞으면 붙는다. */
function inject(wf, title, setter) {
  for (const node of Object.values(wf)) {
    if (node?._meta?.title === title) {
      setter(node)
      return true
    }
  }
  return false
}

async function runWorkflow(base, wf) {
  const q = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: wf }),
  })
  if (!q.ok) throw new Error(`큐 실패 ${q.status} ${(await q.text()).slice(0, 200)}`)
  const { prompt_id: id } = await q.json()

  // 폴링. 생성은 수십 초라 짧은 간격은 의미가 없다.
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const h = await fetch(`${base}/history/${id}`)
    if (!h.ok) continue
    const j = await h.json()
    const rec = j[id]
    if (!rec) continue
    if (rec.status?.status_str === 'error') {
      throw new Error(`ComfyUI 실행 오류: ${JSON.stringify(rec.status).slice(0, 300)}`)
    }
    const imgs = Object.values(rec.outputs ?? {}).flatMap((o) => o.images ?? [])
    if (imgs.length) return imgs[0]
  }
  throw new Error('ComfyUI 응답 시간 초과(20분)')
}

async function download(base, img, dest) {
  const u = new URL(`${base}/view`)
  u.searchParams.set('filename', img.filename)
  u.searchParams.set('subfolder', img.subfolder ?? '')
  u.searchParams.set('type', img.type ?? 'output')
  const r = await fetch(u)
  if (!r.ok) throw new Error(`산출물 회수 실패 ${r.status}`)
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
}

// ─── 말풍선 지우기 ───────────────────────────────────────────────────
//
// bubbles 매니페스트의 box 는 **컷 기준 0~1 정규화 좌표**다(ocr-local 이 그렇게 쓴다).
// 흰색으로 덮는다 — 모델이 "빈 말풍선"으로 인식해 형태를 유지하고, 지운 자리에
// page-letter 가 문구를 다시 얹는다. blur 가 아니라 fill 인 이유: blur 는 글자 흔적을
// 남겨 모델이 그것을 글자처럼 재현하려 든다.

function eraseBubbles(src, dest, boxes) {
  if (!boxes.length) {
    fs.copyFileSync(src, dest)
    return 0
  }
  const draw = boxes
    .map((b) => {
      const x = `iw*${b.x.toFixed(4)}`
      const y = `ih*${b.y.toFixed(4)}`
      const w = `iw*${b.w.toFixed(4)}`
      const h = `ih*${b.h.toFixed(4)}`
      return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=white@1.0:t=fill`
    })
    .join(',')
  const r = spawnSync(FF, ['-y', '-loglevel', 'error', '-i', src, '-vf', draw, dest], {
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(`말풍선 지우기 실패: ${(r.stderr || '').slice(-200)}`)
  return boxes.length
}

// ─── 본체 ────────────────────────────────────────────────────────────

async function main() {
  const WD = arg('workdir')
  if (!WD || !fs.existsSync(WD)) {
    console.error(`--workdir <dir> 필요: ${WD}`)
    process.exit(2)
  }
  const modelKey = arg('model', 'qwen-image-edit-2511')
  const env = arg('env', 'runpod-4090')
  const limit = arg('limit') ? Number(arg('limit')) : 8
  const dryRun = has('dry-run')

  const runner = resolveRunner(modelKey)
  if (!runner) throw new Error(`알 수 없는 모델: ${modelKey}`)
  if (!runner.wfEdit) {
    throw new Error(
      `${modelKey} 은 edit 워크플로가 없습니다 — t2i 로는 원본 컷을 입력할 수 없어\n` +
        '  "현대화"가 아니라 "새로 생성"이 됩니다. edit 지원 모델을 고르세요.',
    )
  }
  if (runner.wfEditEnvs && !runner.wfEditEnvs.includes(env)) {
    throw new Error(
      `${modelKey} edit 는 ${runner.wfEditEnvs.join('/')} 에만 프로비저닝돼 있습니다 (요청: ${env}).\n` +
        `  ${env} 에서 쓰려면 그 환경용 edit 워크플로를 만들어 model-runners 의 wfEditEnvs 에 추가해야 합니다.`,
    )
  }

  const panels = JSON.parse(
    fs.readFileSync(path.join(WD, 'panels', 'panels.manifest.json'), 'utf8'),
  ).panels
  const bubbleMf = ['bubbles.local.manifest.json', 'bubbles.manifest.json']
    .map((f) => path.join(WD, f))
    .find((f) => fs.existsSync(f))
  const bubblesByPanel = new Map()
  if (bubbleMf) {
    for (const p of JSON.parse(fs.readFileSync(bubbleMf, 'utf8')).panels ?? []) {
      bubblesByPanel.set(`${p.page}-${p.panelIndex}`, (p.bubbles ?? []).map((b) => b.box).filter(Boolean))
    }
  }

  const outDir = path.join(WD, 'modern')
  const srcDir = path.join(outDir, '_erased')
  fs.mkdirSync(srcDir, { recursive: true })

  // 멱등 — 이미 만든 컷은 건너뛴다. 중단·재개가 자유로워야 300컷을 돌릴 수 있다.
  const todo = panels.filter((p) => !fs.existsSync(path.join(outDir, path.basename(p.file))))
  const batch = todo.slice(0, limit)

  console.log(`\n현대화(모델) — ${modelKey} @ ${env}`)
  console.log(`  전체 ${panels.length}컷 · 남은 ${todo.length}컷 · 이번 회차 ${batch.length}컷`)
  console.log(`  워크플로 ${runner.wfEdit}`)
  if (!bubbleMf) console.log('  ⚠ 말풍선 매니페스트 없음 — 글자를 지우지 못한 채 모델에 들어갑니다')

  if (dryRun) {
    console.log('\n[dry-run] 실행하지 않습니다. 처리 예정:')
    for (const p of batch) console.log(`  ${p.file}`)
    return
  }
  if (batch.length === 0) {
    console.log('\n남은 컷이 없습니다.')
    return
  }

  const base = comfyBase()
  const wfTemplate = JSON.parse(fs.readFileSync(path.join(REPO, runner.wfEdit), 'utf8'))
  const results = []
  let erasedTotal = 0

  for (const [i, p] of batch.entries()) {
    emitProgress(WD, {
      stage: 'modernize',
      done: panels.length - todo.length + i,
      total: panels.length,
      current: path.basename(p.file),
    })
    const srcAbs = path.resolve(REPO, p.file)
    const name = path.basename(p.file)
    const erased = path.join(srcDir, name)
    const boxes = bubblesByPanel.get(`${p.page}-${p.panelIndex}`) ?? []
    erasedTotal += eraseBubbles(srcAbs, erased, boxes)

    const wf = JSON.parse(JSON.stringify(wfTemplate))
    const upName = await uploadImage(base, erased)
    const okRef = inject(wf, 'REFIMAGE', (n) => {
      n.inputs.image = upName
    })
    if (!okRef) throw new Error(`워크플로에 REFIMAGE 노드가 없습니다: ${runner.wfEdit}`)
    inject(wf, 'PROMPT', (n) => {
      if ('prompt' in n.inputs) n.inputs.prompt = PROMPT
      else if ('text' in n.inputs) n.inputs.text = PROMPT
    })
    inject(wf, 'NEG', (n) => {
      if ('prompt' in n.inputs) n.inputs.prompt = NEG
      else if ('text' in n.inputs) n.inputs.text = NEG
    })
    // 원본 컷 비율을 유지한다 — SIZE 를 그대로 두면 정사각으로 눌려 구도가 깨진다.
    inject(wf, 'SIZE', (n) => {
      const { w, h } = p.srcBox
      const long = 1024
      const scale = long / Math.max(w, h)
      n.inputs.width = Math.round((w * scale) / 16) * 16
      n.inputs.height = Math.round((h * scale) / 16) * 16
    })

    const img = await runWorkflow(base, wf)
    const dest = path.join(outDir, name)
    await download(base, img, dest)
    results.push({ panel: name, src: p.file, out: path.relative(REPO, dest).replace(/\\/g, '/'), bubblesErased: boxes.length })
    console.log(`  [${i + 1}/${batch.length}] ${name}  말풍선 ${boxes.length}개 지움`)
  }

  // 매니페스트는 누적 — 회차를 나눠 돌리므로 덮으면 이전 기록이 사라진다.
  const mfPath = path.join(outDir, 'modern.manifest.json')
  const prev = fs.existsSync(mfPath) ? JSON.parse(fs.readFileSync(mfPath, 'utf8')) : { panels: [] }
  const merged = [...prev.panels.filter((x) => !results.some((r) => r.panel === x.panel)), ...results]
  fs.writeFileSync(
    mfPath,
    JSON.stringify(
      { track: 'model', model: modelKey, env, workflow: runner.wfEdit, panels: merged },
      null,
      2,
    ),
  )

  const done = merged.length
  emitProgress(WD, { stage: 'modernize', done, total: panels.length, current: '' })
  console.log(`\n${done}/${panels.length}컷 완료 · 말풍선 ${erasedTotal}개 제거 → ${outDir}`)
  if (done < panels.length) console.log(`  남은 ${panels.length - done}컷 — 같은 명령을 다시 실행하세요(멱등).`)
  else console.log('  다음: page-letter.mjs 로 대사 레이어를 다시 얹으세요(비파괴).')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
}

export { eraseBubbles, PROMPT, NEG }
