// scripts/comic/pd/modernize.mjs
//
// PDCP 현대화 — **모델 트랙**. 컷을 다시 그린다.
// 설계: scripts/comic/docs/PD_MODERNIZE_MODEL.md
//
//   node scripts/comic/pd/modernize.mjs --workdir work/pdcp/<slug> \
//     [--model qwen-image-edit-2511] [--env runpod-4090] [--limit 8] [--dry-run] [--erase-only]
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
import { connectComfy, checkComfy } from '../comfy-auth.mjs'
import { detectBalloons } from './balloons.mjs'
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
/** 매니페스트 경로는 OS 무관하게 슬래시로 — Admin 이 그대로 URL 로 쓴다. */
const toPosix = (p) => p.split(path.sep).join('/')

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
//
// ⚠️ 접속·인증은 `comfy-auth.mjs`(SSoT)가 한다. 여기서 맨 fetch 를 쓰면 안 된다 —
// RunPod ai-dock 은 8188 앞에 폼 로그인을 두므로 인증 없이는 **로그인 HTML 이 200 으로**
// 돌아와 JSON 파싱에서 죽는다(GPU 는 이미 과금 중인 상태로).

async function uploadImage(comfy, file) {
  const buf = fs.readFileSync(file)
  const fd = new FormData()
  fd.append('image', new Blob([buf]), path.basename(file))
  fd.append('overwrite', 'true')
  const r = await fetch(`${comfy.base}/upload/image`, {
    method: 'POST',
    body: fd,
    headers: comfy.headers(),
  })
  if (!r.ok) throw new Error(`업로드 실패 ${r.status} ${path.basename(file)}`)
  const txt = await r.text()
  try {
    return JSON.parse(txt).name
  } catch {
    throw new Error(
      `업로드 응답이 JSON 이 아닙니다 (${path.basename(file)}) — 인증 실패로 로그인 페이지가 왔을 수 있습니다.`,
    )
  }
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

async function runWorkflow(comfy, wf) {
  const q = await fetch(`${comfy.base}/prompt`, {
    method: 'POST',
    headers: comfy.headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt: wf }),
  })
  if (!q.ok) throw new Error(`큐 실패 ${q.status} ${(await q.text()).slice(0, 200)}`)
  const { prompt_id: id } = await q.json()

  // 폴링. 생성은 수십 초라 짧은 간격은 의미가 없다.
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const h = await fetch(`${comfy.base}/history/${id}`, { headers: comfy.headers() })
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

async function download(comfy, img, dest) {
  const u = new URL(`${comfy.base}/view`)
  u.searchParams.set('filename', img.filename)
  u.searchParams.set('subfolder', img.subfolder ?? '')
  u.searchParams.set('type', img.type ?? 'output')
  const r = await fetch(u, { headers: comfy.headers() })
  if (!r.ok) throw new Error(`산출물 회수 실패 ${r.status}`)
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
}

// ─── 말풍선 지우기 ───────────────────────────────────────────────────
//
// ⚠️ OCR 텍스트 박스를 그대로 지우면 안 된다 — 말풍선 하나가 텍스트 조각 여럿으로 잡혀
// 조각 사이 여백과 테두리에 글자가 남는다(실측: 캡션 박스 1개가 6조각). 남은 흔적을
// 모델이 "글자 비슷한 것"으로 재현한다. balloons.mjs 가 조각을 감싸는 풍선 영역으로 확장한다.
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
  const longEdge = arg('long') ? Number(arg('long')) : 1024
  const seed = arg('seed') ? Number(arg('seed')) : null
  const outName = arg('out-name') // 같은 워크디렉터리에서 설정을 나란히 비교할 때(modern-1328 등)
  const dryRun = has('dry-run')
  const eraseOnly = has('erase-only')

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

  // 지운 컷(_erased)은 설정과 무관하므로 항상 modern/ 밑에 한 벌만 둔다 — 재계산·중복 방지.
  const outDir = path.join(WD, outName || 'modern')
  const srcDir = path.join(WD, 'modern', '_erased')
  fs.mkdirSync(srcDir, { recursive: true })
  fs.mkdirSync(outDir, { recursive: true })

  // 멱등 — 이미 만든 컷은 건너뛴다. 중단·재개가 자유로워야 300컷을 돌릴 수 있다.
  const todo = panels.filter((p) => !fs.existsSync(path.join(outDir, path.basename(p.file))))
  const batch = todo.slice(0, limit)

  console.log(`\n현대화(모델) — ${modelKey} @ ${env}`)
  console.log(`  전체 ${panels.length}컷 · 남은 ${todo.length}컷 · 이번 회차 ${batch.length}컷`)
  console.log(`  워크플로 ${runner.wfEdit} · 긴 변 ${longEdge}px${seed != null ? ` · seed ${seed}` : ''}`)
  console.log(`  출력 ${toPosix(path.relative(REPO, outDir))}`)
  if (!bubbleMf) console.log('  ⚠ 말풍선 매니페스트 없음 — 글자를 지우지 못한 채 모델에 들어갑니다')

  if (dryRun) {
    console.log('\n[dry-run] 실행하지 않습니다. 처리 예정:')
    for (const p of batch) console.log(`  ${p.file}`)
    return
  }

  // --erase-only: GPU 를 쓰지 않고 **말풍선 지우기까지만** 하고 멈춘다.
  // 모델 트랙의 유일한 비가역 비용은 GPU 시간이다. 그 전에 "글자가 정말 다 지워졌나"를
  // 사람이 눈으로 확인할 수 있어야 한다 — 남은 글자는 모델이 가짜 글자로 재현한다.
  if (eraseOnly) {
    let cov = 0
    let fb = 0
    for (const p of panels) {
      const name = path.basename(p.file)
      const tb = bubblesByPanel.get(`${p.page}-${p.panelIndex}`) ?? []
      const rs = tb.length ? detectBalloons(path.resolve(REPO, p.file), tb) : []
      eraseBubbles(path.resolve(REPO, p.file), path.join(srcDir, name), rs)
      cov += rs.reduce((a, b) => a + b.w * b.h, 0)
      fb += rs.filter((b) => b.via === 'text-fallback').length
      console.log(`  ${name}  조각 ${tb.length} → 영역 ${rs.length}`)
    }
    console.log(`\n지우기 미리보기 ${panels.length}컷 → ${srcDir}`)
    console.log(`  평균 지움 면적 ${((cov / panels.length) * 100).toFixed(1)}%/컷 · 풍선 미검출 후퇴 ${fb}건`)
    console.log('  ⚠ 글자가 남아 있으면 모델이 가짜 글자로 재현합니다 — 확인 후 진행하세요.')
    return
  }
  if (batch.length === 0) {
    console.log('\n남은 컷이 없습니다.')
    return
  }

  // 접속·인증을 **첫 컷을 보내기 전에** 확정한다. ai-dock 로그인 실패를 20번째 컷에서
  // 알게 되면 그 사이 GPU 는 계속 과금된다.
  const comfy = await connectComfy({ user: arg('user'), pass: arg('pass') })
  const stat = await checkComfy(comfy)
  if (!stat.ok) {
    throw new Error(
      `ComfyUI 접속 확인 실패: ${stat.reason}\n` +
        `  ${comfy.base}\n` +
        '  ai-dock(RunPod)이면 --user/--pass (기본 user/password) 또는 .comfy-user/.comfy-pass 가 필요합니다.',
    )
  }
  console.log(`  GPU ${stat.gpu}${stat.vramGb ? ` (${stat.vramGb}GB)` : ''} · ComfyUI ${stat.comfyui} · torch ${stat.torch} · 인증 ${comfy.mode}`)

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
    const textBoxes = bubblesByPanel.get(`${p.page}-${p.panelIndex}`) ?? []
    // 텍스트 조각 → 그것을 감싸는 말풍선 영역
    const boxes = textBoxes.length ? detectBalloons(srcAbs, textBoxes) : []
    const fellBack = boxes.filter((b) => b.via === 'text-fallback').length
    const coverage = boxes.reduce((a, b) => a + b.w * b.h, 0)
    erasedTotal += eraseBubbles(srcAbs, erased, boxes)

    const wf = JSON.parse(JSON.stringify(wfTemplate))
    const upName = await uploadImage(comfy, erased)
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
    // 긴 변은 `--long` 으로 조절한다. 컷 원본이 1200px 대인데 1024 로 굽으면 **재작화가
    // 곧 다운스케일**이 되어, 화풍이 나아져도 총평이 "원본보다 못하다"로 뒤집힌다.
    inject(wf, 'SIZE', (n) => {
      const { w, h } = p.srcBox
      const scale = longEdge / Math.max(w, h)
      n.inputs.width = Math.round((w * scale) / 16) * 16
      n.inputs.height = Math.round((h * scale) / 16) * 16
    })
    // 시드 고정 — 설정 비교(1024 vs 1328 등)에서 시드가 흔들리면 무엇이 달라진 건지 알 수 없다.
    if (seed != null) inject(wf, 'sampler', (n) => { n.inputs.seed = seed })

    const img = await runWorkflow(comfy, wf)
    const dest = path.join(outDir, name)
    await download(comfy, img, dest)
    results.push({
      panel: name,
      src: p.file,
      out: toPosix(path.relative(REPO, dest)),
      erasedPreview: toPosix(path.relative(REPO, erased)),
      textFragments: textBoxes.length,
      regionsErased: boxes.length,
      regionsFallback: fellBack,
      eraseCoverage: +coverage.toFixed(4),
    })
    console.log(
      `  [${i + 1}/${batch.length}] ${name}  조각 ${textBoxes.length} → 영역 ${boxes.length}` +
        (fellBack ? ` (풍선 못 찾음 ${fellBack})` : '') +
        `  지움 ${(coverage * 100).toFixed(1)}%`,
    )
  }

  // 매니페스트는 누적 — 회차를 나눠 돌리므로 덮으면 이전 기록이 사라진다.
  const mfPath = path.join(outDir, 'modern.manifest.json')
  const prev = fs.existsSync(mfPath) ? JSON.parse(fs.readFileSync(mfPath, 'utf8')) : { panels: [] }
  const merged = [...prev.panels.filter((x) => !results.some((r) => r.panel === x.panel)), ...results]
  fs.writeFileSync(
    mfPath,
    JSON.stringify(
      {
        track: 'model',
        model: modelKey,
        env,
        workflow: runner.wfEdit,
        // 설정을 산출물 옆에 남긴다 — 나중에 "이 그림은 어떤 설정으로 나왔나"를 되물을 수 없으면
        // 비교 자체가 재현되지 않는다.
        longEdge,
        seed,
        gpu: stat.gpu,
        panels: merged,
      },
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
