// scripts/comic/pd/compare-tracks.mjs
//
// PDCP 현대화 **트랙 비교** — 원작 대비 여러 트랙(CPU · 모델)을 나란히 놓고 지표로 채점한다.
//
//   node scripts/comic/pd/compare-tracks.mjs --workdir work/pdcp/<slug> \
//     --tracks "원작=panels,CPU=modern-cpu,RunPod-QIE=modern" [--out <dir>] [--panels 0001-c01,...]
//
// ── 왜 필요한가 ─────────────────────────────────────────────────────
// "원본보다 안 좋다"는 판단은 맞지만 **어디가 얼마나** 나쁜지를 말해주지 않는다. 그러면 다음
// 시도가 감으로 간다. 트랙을 바꿀 때마다 같은 잣대로 재야 개선인지 후퇴인지 알 수 있다.
//
// ── 지표 (전부 ffmpeg — 새 의존성 없음) ─────────────────────────────
//   해상도    모델에 넣고 받은 실제 픽셀 수. 재작화가 곧 다운스케일이면 총평은 반드시 뒤집힌다.
//   SSIM      원작 대비 구조 유사도 = **구도·인물 보존**. 모델 트랙의 주 실패는 "그럴듯한데 틀린 그림".
//   선예도    edgedetect 후 평균 밝기 = 선(線) 밀도. 뭉개짐/블러를 잡는다.
//   화이트포인트  YHIGH(상위 밝기) = 누런 종이가 순백으로 갔는가 (현대화 레버 ⓑ).
//   채도      SATAVG = 평면 컬러의 선명함 (현대화 레버 ⓐ의 부수 신호).
//
// ⚠️ 자동 점수로 **채택을 결정하지 않는다**(PD_MODERNIZE_MODEL.md §6). 구도 붕괴를 픽셀 지표로
// 가르려던 시도는 컷분할에서 이미 실패했다. 이 표는 사람이 그리드를 볼 때 **어디를 볼지**
// 알려주는 용도다 — 최종 채택은 눈으로 한다.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF =
  process.env.FFMPEG_BIN ||
  (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe'))
    ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')
    : 'ffmpeg')
const FFPROBE = FF.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace(/ffmpeg/i, 'ffprobe'))

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i === -1 ? d : process.argv[i + 1]
}

const run = (args) => spawnSync(FF, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

// drawtext 용 한글 지원 폰트. ffmpeg 필터 문법상 경로는 슬래시 + 콜론 이스케이프가 필요하다.
const FONT_FILE = (() => {
  const cands = ['C:/Windows/Fonts/malgun.ttf', 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
  const f = cands.find((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
  return f ? f.replace(/:/g, '\\:') : ''
})()

// ─── 측정 ────────────────────────────────────────────────────────────

export function dimensions(file) {
  const r = spawnSync(
    FFPROBE,
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  )
  const [w, h] = String(r.stdout || '').trim().split(',').map(Number)
  return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null
}

/** signalstats 한 벌 → { YAVG, YHIGH, SATAVG, ... } */
function signalStats(file, pre = '') {
  const r = run(['-v', 'error', '-i', file, '-vf', `${pre}signalstats,metadata=print:file=-`, '-f', 'null', '-'])
  const out = `${r.stdout || ''}${r.stderr || ''}`
  const stats = {}
  for (const m of out.matchAll(/lavfi\.signalstats\.([A-Z]+)=([-\d.]+)/g)) stats[m[1]] = Number(m[2])
  return stats
}

/**
 * 원작 대비 SSIM. 크기가 다르면 비교가 성립하지 않으므로 **둘 다 같은 크기로** 맞춘다.
 * 기준 크기는 원작 쪽(더 큰 정보량)에 맞추지 않고 둘 중 작은 쪽 — 업스케일이 만들어낸
 * 가짜 디테일이 점수에 섞이지 않게.
 */
function ssimVsRef(ref, cand) {
  const a = dimensions(ref)
  const b = dimensions(cand)
  if (!a || !b) return null
  const w = Math.min(a.w, b.w)
  const h = Math.round((w * a.h) / a.w / 2) * 2
  const r = run([
    '-hide_banner', '-i', ref, '-i', cand,
    '-lavfi',
    `[0:v]scale=${w}:${h},format=gray[a];[1:v]scale=${w}:${h},format=gray[b];[a][b]ssim`,
    '-f', 'null', '-',
  ])
  const m = `${r.stdout || ''}${r.stderr || ''}`.match(/All:([\d.]+)/)
  return m ? Number(m[1]) : null
}

/** 선(線) 밀도 — edgedetect 후 평균 밝기. 값이 낮으면 뭉갠 것. */
function edgeDensity(file) {
  return signalStats(file, 'format=gray,edgedetect=low=0.1:high=0.3,').YAVG ?? null
}

export function measure(file, ref) {
  const dim = dimensions(file)
  const st = signalStats(file)
  return {
    file: file.split(path.sep).join('/'),
    w: dim?.w ?? null,
    h: dim?.h ?? null,
    px: dim ? dim.w * dim.h : null,
    ssim: ref && path.resolve(ref) !== path.resolve(file) ? ssimVsRef(ref, file) : null,
    edge: edgeDensity(file),
    yavg: st.YAVG ?? null,
    yhigh: st.YHIGH ?? null,
    satavg: st.SATAVG ?? null,
  }
}

// ─── 트랙 해석 ───────────────────────────────────────────────────────
//
// 트랙마다 파일명이 다르다(원작 `0001-c01.jpg` · Kaggle 산출물 `ci027__0001-c01.jpg`).
// 컷 이름을 **접미사로** 맞춘다 — 접두사 규칙을 트랙마다 외우게 하면 곧 어긋난다.

/**
 * ⚠️ 접미사 일치만으로는 **틀린 컷을 조용히 비교한다.** 한 디렉터리에 여러 콘텐츠의 산출물이
 * 섞여 있으면(`work/_kaggle-restyle/out/` 은 5개 호가 한 폴더) `ci027__0001-c01.jpg` 와
 * `1954-07classicsi__0001-c01.jpg` 가 똑같이 `0001-c01` 로 끝난다. 실제로 The Spy 표지와
 * Ivanhoe 표지를 비교해 SSIM 0.087 을 뱉었다 — 숫자만 보면 "모델이 구도를 다 부쉈다"로 읽힌다.
 *
 * 그래서 후보가 둘 이상이면 **hint(호 슬러그)로 좁히고, 그래도 모호하면 고르지 않고 알린다.**
 * 잘못된 비교는 비교 안 하느니만 못하다.
 */
function findPanelFile(dir, panelName, hint) {
  if (!fs.existsSync(dir)) return { file: null }
  const exact = path.join(dir, panelName)
  if (fs.existsSync(exact)) return { file: exact }
  const base = panelName.replace(/\.[^.]+$/, '')
  // 경계(`__`/`-`/`_`) 뒤에 컷 이름이 오는 것만 후보로 — 임의의 부분일치를 막는다.
  let hits = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .filter((f) => {
      const stem = f.replace(/\.[^.]+$/, '')
      return stem === base || /[_-]$/.test(stem.slice(0, stem.length - base.length)) && stem.endsWith(base)
    })
  if (hits.length > 1 && hint) {
    const narrowed = hits.filter((f) => f.toLowerCase().includes(hint.toLowerCase()))
    if (narrowed.length) hits = narrowed
  }
  if (hits.length > 1) return { file: null, ambiguous: hits }
  return { file: hits[0] ? path.join(dir, hits[0]) : null }
}

function parseTracks(spec, WD) {
  return String(spec)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf('=')
      if (i === -1) throw new Error(`--tracks 형식은 "라벨=디렉터리" 입니다: ${s}`)
      const label = s.slice(0, i).trim()
      const rel = s.slice(i + 1).trim()
      // 절대/저장소 상대 경로도 받는다 — Kaggle 산출물은 workdir 밖(work/_kaggle-restyle)에 있다.
      const dir = fs.existsSync(rel) ? rel : path.join(WD, rel)
      return { label, dir }
    })
}

// ─── 그리드 ──────────────────────────────────────────────────────────

/**
 * 트랙 N개를 가로로 붙인 비교 이미지. 각 칸 위에 라벨을 굽는다 —
 * 라벨 없는 비교 그리드는 하루만 지나도 어느 칸이 무엇인지 알 수 없다.
 */
function buildGrid(files, labels, dest, cellH = 900) {
  const inputs = files.flatMap((f) => ['-i', f])
  // 한글 라벨은 기본 폰트로 □□ 로 굽힌다 — 어느 칸이 무엇인지 못 읽으면 라벨이 없는 것과 같다.
  const font = FONT_FILE ? `:fontfile='${FONT_FILE}'` : ''
  const chains = files
    .map((_, i) => {
      const safe = labels[i].replace(/[\\:']/g, '')
      return (
        `[${i}:v]scale=-2:${cellH},pad=iw:ih+44:0:44:color=white,` +
        `drawtext=text='${safe}'${font}:fontcolor=black:fontsize=28:x=10:y=8[v${i}]`
      )
    })
    .join(';')
  const stack = `${files.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${files.length}[out]`
  const r = run([
    '-y', '-v', 'error', ...inputs,
    '-filter_complex', `${chains};${stack}`,
    '-map', '[out]', '-q:v', '3', dest,
  ])
  if (r.status !== 0) {
    // drawtext 는 폰트가 없으면 실패한다 — 라벨 없이라도 그리드는 내준다.
    const r2 = run([
      '-y', '-v', 'error', ...inputs,
      '-filter_complex',
      `${files.map((_, i) => `[${i}:v]scale=-2:${cellH}[v${i}]`).join(';')};${stack}`,
      '-map', '[out]', '-q:v', '3', dest,
    ])
    if (r2.status !== 0) throw new Error(`그리드 생성 실패: ${(r2.stderr || '').slice(-300)}`)
    return { labeled: false }
  }
  return { labeled: true }
}

// ─── 보고 ────────────────────────────────────────────────────────────

const fmt = (v, d = 3) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(d) : String(v))
const mean = (xs) => {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function report(tracks, rows, refLabel) {
  const L = []
  L.push('# 현대화 트랙 비교\n')
  L.push(`기준(원작) = **${refLabel}** · 컷 ${rows.length}개\n`)
  L.push('## 트랙 평균\n')
  L.push('| 트랙 | 해상도(평균 px) | SSIM(구도보존) | 선예도 | 화이트포인트 | 채도 |')
  L.push('|---|---:|---:|---:|---:|---:|')
  for (const t of tracks) {
    const ms = rows.map((r) => r.by[t.label]).filter(Boolean)
    if (!ms.length) {
      L.push(`| ${t.label} | — | — | — | — | — | (산출물 없음)`)
      continue
    }
    const px = mean(ms.map((m) => m.px))
    L.push(
      `| ${t.label} | ${px ? `${(px / 1e6).toFixed(2)}M` : '—'} | ${fmt(mean(ms.map((m) => m.ssim)))} | ` +
        `${fmt(mean(ms.map((m) => m.edge)), 1)} | ${fmt(mean(ms.map((m) => m.yhigh)), 1)} | ${fmt(mean(ms.map((m) => m.satavg)), 1)} |`,
    )
  }
  L.push('')
  L.push('## 컷별 SSIM (원작 대비 · 1.0 = 동일)\n')
  L.push(`| 컷 | ${tracks.filter((t) => t.label !== refLabel).map((t) => t.label).join(' | ')} |`)
  L.push(`|---|${tracks.filter((t) => t.label !== refLabel).map(() => '---:').join('|')}|`)
  for (const r of rows) {
    const cells = tracks
      .filter((t) => t.label !== refLabel)
      .map((t) => fmt(r.by[t.label]?.ssim))
    L.push(`| ${r.panel} | ${cells.join(' | ')} |`)
  }
  L.push('')
  L.push('> 지표는 **어디를 볼지** 알려줄 뿐 채택을 결정하지 않는다. 그리드를 눈으로 볼 것.')
  L.push('> SSIM 이 높아도 화풍이 안 바뀌었을 수 있고, 낮아도 의도한 리스타일일 수 있다.')
  return L.join('\n')
}

// ─── 본체 ────────────────────────────────────────────────────────────

async function main() {
  const WD = arg('workdir')
  if (!WD || !fs.existsSync(WD)) {
    console.error(`--workdir <dir> 필요: ${WD}`)
    process.exit(2)
  }
  const tracks = parseTracks(arg('tracks', '원작=panels,모델=modern'), WD)
  if (tracks.length < 2) {
    console.error('--tracks 에 최소 2개 필요 (예: "원작=panels,RunPod=modern")')
    process.exit(2)
  }
  const refLabel = tracks[0].label
  const outDir = arg('out') || path.join(WD, '_compare')
  fs.mkdirSync(outDir, { recursive: true })

  const only = arg('panels') ? String(arg('panels')).split(',').map((s) => s.trim()) : null
  const refDir = tracks[0].dir
  if (!fs.existsSync(refDir)) {
    console.error(`기준 트랙 디렉터리가 없습니다: ${refDir}`)
    process.exit(2)
  }
  let panels = fs
    .readdirSync(refDir)
    .filter((f) => /^\d.*\.(jpe?g|png)$/i.test(f))
    .sort()
  if (only) panels = panels.filter((p) => only.some((o) => p.startsWith(o)))
  if (!panels.length) {
    console.error(`기준 트랙에 컷이 없습니다: ${refDir}`)
    process.exit(2)
  }

  console.log(`\n트랙 비교 — 기준 ${refLabel}`)
  for (const t of tracks) {
    const n = fs.existsSync(t.dir)
      ? fs.readdirSync(t.dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).length
      : 0
    console.log(`  ${t.label.padEnd(16)} ${t.dir}  (${n}장)`)
  }

  // 여러 호의 산출물이 한 폴더에 섞인 경우를 가르는 힌트 — 워크디렉터리 이름.
  const hint = arg('hint') || path.basename(path.resolve(WD))

  const rows = []
  for (const panel of panels) {
    const refFile = path.join(refDir, panel)
    const by = {}
    const present = []
    for (const t of tracks) {
      const { file: f, ambiguous } = findPanelFile(t.dir, panel, hint)
      if (ambiguous) {
        console.log(`  ⚠ ${panel}  ${t.label}: 후보 ${ambiguous.length}개로 모호 — 비교에서 제외 (${ambiguous.join(', ')})`)
        console.log(`     --hint <호 슬러그> 로 좁히세요.`)
        continue
      }
      if (!f) continue
      by[t.label] = measure(f, refFile)
      present.push({ label: t.label, file: f })
    }
    // 비교할 게 기준밖에 없으면 그리드를 만들 이유가 없다.
    if (present.length < 2) {
      console.log(`  ${panel}  (트랙 ${present.length}개 — 건너뜀)`)
      rows.push({ panel, by })
      continue
    }
    const dest = path.join(outDir, `cmp-${panel.replace(/\.[^.]+$/, '')}.jpg`)
    const { labeled } = buildGrid(present.map((p) => p.file), present.map((p) => p.label), dest)
    rows.push({ panel, by, grid: dest.split(path.sep).join('/') })
    const s = present
      .filter((p) => p.label !== refLabel)
      .map((p) => `${p.label} ssim ${fmt(by[p.label]?.ssim, 2)}`)
      .join(' · ')
    console.log(`  ${panel}  ${s}${labeled ? '' : ' (라벨 없음 — 폰트 미탑재)'}`)
  }

  const md = report(tracks, rows, refLabel)
  fs.writeFileSync(path.join(outDir, 'report.md'), md)
  fs.writeFileSync(
    path.join(outDir, 'report.json'),
    JSON.stringify({ ref: refLabel, tracks: tracks.map((t) => ({ ...t, dir: t.dir.split(path.sep).join('/') })), rows }, null, 2),
  )
  console.log(`\n${md}\n`)
  console.log(`→ ${path.relative(REPO, outDir).split(path.sep).join('/')}  (그리드 ${rows.filter((r) => r.grid).length}장 · report.md)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
}

export { findPanelFile, buildGrid, ssimVsRef, edgeDensity }
