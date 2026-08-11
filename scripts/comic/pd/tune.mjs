// scripts/comic/pd/tune.mjs
//
// 자기발전 — 파이프라인이 **자기 산출물을 채점하고 더 나은 파라미터를 찾아 래칫한다.**
// (CCP 의 gen-verified 폐루프에 대응하는 PDCP 쪽 장치)
//
//   node scripts/comic/pd/tune.mjs segment --sample work/pdcp/_tune
//   node scripts/comic/pd/tune.mjs ocr     --sample work/pdcp/_tune
//   node scripts/comic/pd/tune.mjs report
//
// 왜 이게 필요한가:
//   복원·컷분할·OCR 파라미터는 지금까지 **한 장을 눈으로 보고 손으로 고른 값**이다
//   (analysis 1100 · dilate 2 는 "480 에서 안 쪼개져서 올렸다"가 근거의 전부였다).
//   손으로 고른 값은 왜 그 값인지, 더 나은 값이 있는지, 나빠졌는지를 아무도 모른다.
//
// 채점 방식 — **정답을 사람이 박아둔다.**
//   프록시 지표(컷 개수·면적 커버리지)만으로 최적화하면 과분할이 이긴다.
//   컷을 잘게 쪼갤수록 "많이 찾았다"가 되기 때문이다. 그래서 표본 페이지의 실제 컷 수를
//   `truth.json` 에 사람이 적어두고, **정답과의 오차**를 1순위 지표로 쓴다.
//   프록시(커버리지·슬리버)는 동점을 가르는 보조 지표로만 쓴다.
//
// 결과는 `tune.ratchet.json` 에 누적된다 — 다음 회차가 이전 최고점을 넘지 못하면
// 파라미터를 바꾸지 않는다(래칫). 좋아졌다는 착각으로 되돌아가는 것을 막는 장치다.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { detectBalloons } from './balloons.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..', '..', '..')

function parseArgs(argv) {
  const a = { sample: path.join(REPO_ROOT, 'work', 'pdcp', '_tune'), keep: false }
  for (let i = 3; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--sample') a.sample = argv[++i]
    else if (k === '--keep') a.keep = true
    else if (k === '--limit') a.limit = Number(argv[++i])
  }
  return a
}

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  })
  return { ok: r.status === 0, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

// ─── 컷 분할 채점 ────────────────────────────────────────────────────
//
// 1순위: 정답 컷 수와의 절대 오차(MAE). 0 이면 완벽.
// 보조:  · coverage — 컷 면적 합 / 페이지 면적. 1.0 에 가까우면 "페이지 통째"라 실패다.
//        · sliver  — 면적 1.5% 미만 또는 종횡비 6:1 초과. 프레임선·여백 노이즈.
// 과분할 페널티가 필요한 이유: 컷을 잘게 쪼개면 프록시 점수는 오르지만 학습자 화면은 망가진다.

const SLIVER_AREA = 0.015
const SLIVER_ASPECT = 6

export function scorePanels(panels, truthByPage) {
  const byPage = new Map()
  for (const p of panels) {
    if (!byPage.has(p.page)) byPage.set(p.page, [])
    byPage.get(p.page).push(p)
  }

  let absErr = 0
  let pages = 0
  let sliverTotal = 0
  let panelTotal = 0
  let coverageSum = 0
  const perPage = []

  for (const [page, truth] of Object.entries(truthByPage)) {
    const ps = byPage.get(page) ?? []
    pages++
    panelTotal += ps.length
    absErr += Math.abs(ps.length - truth)

    // 페이지 크기는 컷 박스의 외접 사각형으로 추정한다.
    // 원본 크기를 따로 읽지 않아도 되고, 컷이 페이지를 덮는 정도만 알면 충분하다.
    const maxX = Math.max(1, ...ps.map((p) => p.srcBox.x + p.srcBox.w))
    const maxY = Math.max(1, ...ps.map((p) => p.srcBox.y + p.srcBox.h))
    const pageArea = maxX * maxY
    let area = 0
    let slivers = 0
    for (const p of ps) {
      const a = p.srcBox.w * p.srcBox.h
      area += a
      const aspect = Math.max(p.srcBox.w / p.srcBox.h, p.srcBox.h / p.srcBox.w)
      if (a / pageArea < SLIVER_AREA || aspect > SLIVER_ASPECT) slivers++
    }
    sliverTotal += slivers
    const coverage = ps.length ? area / pageArea : 0
    coverageSum += coverage
    perPage.push({ page, found: ps.length, truth, coverage: +coverage.toFixed(3), slivers })
  }

  const mae = pages ? absErr / pages : 99
  const sliverRate = panelTotal ? sliverTotal / panelTotal : 0
  const coverage = pages ? coverageSum / pages : 0
  // 정답 오차가 지배하고(가중 1.0/컷), 슬리버는 보조 페널티.
  // 커버리지는 0.55~0.95 를 정상으로 보고 벗어난 만큼만 감점한다
  // (1.0 = 페이지 통째로 반환 = 분할 실패).
  const covPenalty = coverage > 0.95 ? (coverage - 0.95) * 4 : coverage < 0.55 ? (0.55 - coverage) * 2 : 0
  const score = -(mae + sliverRate * 2 + covPenalty)
  return { score: +score.toFixed(4), mae: +mae.toFixed(3), coverage: +coverage.toFixed(3), sliverRate: +sliverRate.toFixed(3), perPage }
}

async function tuneSegment(args) {
  const sample = path.resolve(args.sample)
  // 정답은 작업 폴더 우선, 없으면 **저장소 사본**을 본다.
  // 작업 폴더(work/)는 gitignore 라 지우면 사람이 센 정답이 통째로 날아간다 —
  // 이 하네스에서 제일 비싼 산출물이라 저장소에도 남긴다(scripts/comic/pd/samples/).
  const localTruth = path.join(sample, 'truth.json')
  const repoTruth = path.join(HERE, 'samples', path.basename(sample), 'truth.json')
  const truthPath = fs.existsSync(localTruth) ? localTruth : repoTruth
  if (!fs.existsSync(truthPath)) {
    throw new Error(
      `정답 파일이 없습니다: ${localTruth}\n` +
        `  (저장소 사본도 없음: ${repoTruth})\n` +
        '  { "panelsByPage": { "0003": 7, "0005": 8 } } 형식으로 사람이 세어 넣으세요.\n' +
        '  프록시 지표만으로 최적화하면 과분할이 이깁니다 — scripts/comic/pd/samples/README.md 참조.',
    )
  }
  if (truthPath === repoTruth) console.log(`정답: 저장소 사본 사용 (${repoTruth})`)
  const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8')).panelsByPage
  const inDir = path.join(sample, 'restored')

  // 고정값 격자 + **적응형**(dilate 미지정)을 한 표에서 겨루게 한다.
  // 적응형이 어떤 고정값보다 나은지가 이 스윕의 진짜 질문이다 —
  // 표본마다 최적 고정값이 정반대로 나왔기 때문이다.
  const grid = [{ analysis: 1100, dilate: null }]
  for (const analysis of [800, 1100, 1500, 2000]) {
    for (const dilate of [0, 1, 2, 3]) {
      grid.push({ analysis, dilate })
    }
  }

  console.log(`\n컷 분할 자기발전 — 표본 ${Object.keys(truth).length}장 · 조합 ${grid.length}개\n`)
  const results = []
  for (const g of grid) {
    const out = path.join(sample, `_grid/a${g.analysis}-d${g.dilate ?? 'auto'}`)
    fs.rmSync(out, { recursive: true, force: true })
    const r = run('segment.mjs', [
      '--in', inDir, '--out', out,
      '--analysis', String(g.analysis),
      ...(g.dilate == null ? [] : ['--dilate', String(g.dilate)]),
    ])
    const mfPath = path.join(out, 'panels.manifest.json')
    if (!r.ok || !fs.existsSync(mfPath)) {
      console.log(`  a${g.analysis} d${g.dilate ?? '자동'}  실패`)
      results.push({ ...g, score: -99, error: r.out.slice(-160) })
      continue
    }
    const panels = JSON.parse(fs.readFileSync(mfPath, 'utf8')).panels
    const s = scorePanels(panels, truth)
    results.push({ ...g, ...s })
    console.log(
      `  a${String(g.analysis).padEnd(4)} d${String(g.dilate ?? '자동').padEnd(4)} 점수 ${String(s.score).padStart(8)}` +
        `  오차 ${s.mae}  커버 ${s.coverage}  슬리버 ${s.sliverRate}`,
    )
    if (!args.keep) fs.rmSync(out, { recursive: true, force: true })
  }

  results.sort((a, b) => b.score - a.score)
  return { kind: 'segment', sample, results }
}

// ─── OCR 채점 ────────────────────────────────────────────────────────
//
// 이전 채점은 **정밀도만** 봤다 — "찾은 대사 중 몇 개가 깨끗한가". 놓친 대사는 몰랐다.
// 그래서 스윕이 재현율을 깎으면서도 높은 점수를 줄 수 있었다(실측: 기준 미검출 풍선이
// 어떤 조합에서도 안 나오는데 점수는 최고였다).
//
// 이제 **정답을 분모로 재현율을 함께 잰다.** 정답 = 사람이 페이지를 보고 센 말풍선·캡션 수
// (samples/<표본>/truth.json 의 dialogueByPage). 자동 검출로 분모를 만들려던 시도는
// 폐기했다 — 검출기가 OCR 이 찾아낸 풍선조차 놓쳐 분모 자체가 틀렸다.
//
// 점수 = 그대로 쓸 수 있는 대사 수 × 재현율. 둘 다 필요하다:
//   재현율만 보면 아무거나 많이 뱉는 설정이 이기고(psm11 이 3~5배 뱉지만 95%가 검수 대상),
//   정밀도만 보면 조금만 찾고 깨끗한 설정이 이긴다(지금까지의 실패).

export function scoreOcr(stats, recall = null) {
  const bubbles = Number(stats?.bubbles) || 0
  const needsReview = Number(stats?.needsReview) || 0
  const clean = bubbles - needsReview
  const reviewRate = bubbles ? needsReview / bubbles : 1
  // 비라틴 오염은 치명적이다(키릴 오인식). 하나라도 있으면 크게 깎는다.
  const nonLatin = Number(stats?.nonLatinBubbles) || 0
  const base = clean - reviewRate * 2 - nonLatin * 3
  // 정답이 없으면 재현율을 빼고 예전 방식으로 잰다(표본에 truth 가 없을 수 있다).
  const score = recall == null ? base : base * recall
  return {
    score: +score.toFixed(3),
    clean,
    bubbles,
    reviewRate: +reviewRate.toFixed(3),
    nonLatin,
    recall: recall == null ? null : +recall.toFixed(3),
  }
}

/**
 * 재현율 = 찾은 대사 영역 / 정답 대사 수.
 *
 * OCR 은 말풍선 하나를 조각 여럿으로 쪼개므로 **조각 수를 세면 안 된다** — 과대평가된다.
 * detectBalloons 로 조각을 감싸는 영역으로 합친 뒤 센다(지우기가 쓰는 것과 같은 경로).
 * 1을 넘으면 1로 자른다 — 정답보다 많이 찾았다는 건 오탐이고, 그건 정밀도 쪽에서 이미 깎인다.
 */
export function measureRecall(bubbleManifest, panelManifest, dialogueByPage) {
  const pages = Object.keys(dialogueByPage ?? {})
  if (!pages.length) return null
  const byPanel = new Map()
  for (const p of bubbleManifest.panels ?? []) {
    byPanel.set(`${p.page}-${p.panelIndex}`, (p.bubbles ?? []).map((b) => b.box).filter(Boolean))
  }
  let found = 0
  let truth = 0
  for (const page of pages) {
    truth += dialogueByPage[page]
    for (const panel of panelManifest.panels ?? []) {
      if (panel.page !== page) continue
      const tb = byPanel.get(`${panel.page}-${panel.panelIndex}`) ?? []
      if (!tb.length) continue
      found += detectBalloons(path.resolve(REPO_ROOT, panel.file), tb).length
    }
  }
  return truth > 0 ? Math.min(1, found / truth) : null
}

async function tuneOcr(args) {
  const sample = path.resolve(args.sample)
  const panelMfPath = path.join(sample, 'panels', 'panels.manifest.json')
  if (!fs.existsSync(panelMfPath)) {
    throw new Error(
      `컷 매니페스트가 없습니다: ${sample}/panels\n먼저 segment 를 돌리거나 --sample 을 확인하세요.`,
    )
  }
  const panelMf = JSON.parse(fs.readFileSync(panelMfPath, 'utf8'))

  // 정답(대사 수)은 작업 폴더 우선, 없으면 저장소 사본 — segment 채점과 같은 규칙.
  const localT = path.join(sample, 'truth.json')
  const repoT = path.join(HERE, 'samples', path.basename(sample), 'truth.json')
  const tPath = fs.existsSync(localT) ? localT : repoT
  const dialogueByPage = fs.existsSync(tPath)
    ? JSON.parse(fs.readFileSync(tPath, 'utf8')).dialogueByPage
    : null
  if (!dialogueByPage) {
    console.log('⚠ 정답(dialogueByPage) 없음 — 재현율 없이 정밀도만 잽니다.')
    console.log('  놓친 대사를 못 보므로 결과를 그대로 믿지 마세요(samples/README 참조).')
  }

  const grid = []
  for (const psm of [3, 4, 6, 11]) {
    for (const minConf of [25, 40, 55]) {
      grid.push({ psm, minConf })
    }
  }

  console.log(`\n대사 추출 자기발전 — 조합 ${grid.length}개\n`)
  const results = []
  for (const g of grid) {
    const r = run('ocr-local.mjs', [
      '--intake', sample, '--psm', String(g.psm), '--min-conf', String(g.minConf),
    ])
    const mf = path.join(sample, 'bubbles.local.manifest.json')
    if (!r.ok || !fs.existsSync(mf)) {
      console.log(`  psm${g.psm} conf${g.minConf}  실패`)
      results.push({ ...g, score: -99, error: r.out.slice(-160) })
      continue
    }
    const bubbleMf = JSON.parse(fs.readFileSync(mf, 'utf8'))
    const recall = dialogueByPage ? measureRecall(bubbleMf, panelMf, dialogueByPage) : null
    const s = scoreOcr(bubbleMf.stats, recall)
    results.push({ ...g, ...s })
    console.log(
      `  psm${String(g.psm).padEnd(2)} conf${String(g.minConf).padEnd(2)}  점수 ${String(s.score).padStart(8)}` +
        `  그대로쓸수있음 ${s.clean}/${s.bubbles}  재현율 ${s.recall ?? '-'}  검수율 ${s.reviewRate}  비라틴 ${s.nonLatin}`,
    )
  }
  results.sort((a, b) => b.score - a.score)
  return { kind: 'ocr', sample, results }
}

// ─── 래칫 ────────────────────────────────────────────────────────────
//
// 이전 최고점을 넘은 경우에만 "채택"으로 기록한다.
// 넘지 못했으면 그 사실 자체를 남긴다 — 시도했고 나아지지 않았다는 것도 결과다.

const RATCHET = path.join(HERE, 'tune.ratchet.json')

/**
 * 채점식 버전. **채점식을 바꾸면 반드시 올린다.**
 *
 * 래칫은 "이전 최고점을 넘었나"로 채택을 결정하는데, 점수의 의미가 바뀌면 그 비교가
 * 무효다. 실측 사고: OCR 채점에 재현율을 곱하도록 바꾼 뒤 새 점수 27.18 을 옛 점수
 * 32.84(정밀도만 잰 값)와 비교해 "개선 없음"으로 기록했다 — 서로 다른 자를 댄 것이다.
 * (표본을 안 나눠 다른 페이지 점수를 비교했던 것과 같은 종류의 실수, 두 번째다.)
 */
const METRIC_VERSION = { segment: 1, ocr: 3 }

function loadRatchet() {
  try {
    return JSON.parse(fs.readFileSync(RATCHET, 'utf8'))
  } catch {
    return { entries: [] }
  }
}

function recordRatchet(kind, sample, best, results, stampedAt) {
  const r = loadRatchet()
  // **표본별로 계열을 나눈다.** 표본이 다르면 점수 스케일이 달라 비교 자체가 무의미하다
  // (실측 사고: All Top -0.333 과 Classics Illustrated -0.239 를 한 계열로 이어붙여
  //  "개선"이라고 기록했다. 두 수는 서로 다른 페이지를 채점한 값이라 비교 대상이 아니다).
  const key = `${kind}@v${METRIC_VERSION[kind] ?? 1}:${path.basename(sample)}`
  const prev = r.entries.filter((e) => e.key === key).at(-1)
  const improved = !prev || best.score > prev.best.score
  r.entries.push({
    key,
    kind,
    metricVersion: METRIC_VERSION[kind] ?? 1,
    sample: path.basename(sample),
    at: stampedAt,
    best,
    improved,
    previousBest: prev?.best ?? null,
    tried: results.length,
    // 상위 5개만 남긴다 — 전체를 남기면 파일이 읽히지 않는 크기로 자란다
    // 상위 5개 + 적응형(순위 밖이어도 반드시). 적응형이 빠지면 교차 평균을 낼 수 없다.
    top: [
      ...results.slice(0, 5),
      ...(results.slice(0, 5).some((x) => x.dilate == null)
        ? []
        : results.filter((x) => x.dilate == null)),
    ],
  })
  fs.writeFileSync(RATCHET, JSON.stringify(r, null, 2))
  return { improved, prev: prev?.best ?? null }
}

function report() {
  const r = loadRatchet()
  if (!r.entries.length) {
    console.log('아직 자기발전 기록이 없습니다. `tune.mjs segment` 부터 실행하세요.')
    return
  }
  // 표본별 최신 점수를 모아 **교차 평균**을 낸다 — 채택 여부는 한 표본이 아니라 이 값으로 판단한다.
  const latestBySample = new Map()
  for (const e of r.entries) latestBySample.set(e.key, e)
  const adaptiveScores = []
  for (const e of latestBySample.values()) {
    const a = (e.top ?? []).find((t) => t.dilate == null)
    if (a) adaptiveScores.push({ sample: e.sample, adaptive: a.score, best: e.best.score })
  }
  if (adaptiveScores.length > 1) {
    const avgA = adaptiveScores.reduce((s2, x) => s2 + x.adaptive, 0) / adaptiveScores.length
    const avgB = adaptiveScores.reduce((s2, x) => s2 + x.best, 0) / adaptiveScores.length
    console.log(
      `
교차 평균 (표본 ${adaptiveScores.length}개) — 적응형 ${avgA.toFixed(3)} · 표본별 1위 ${avgB.toFixed(3)}`,
    )
    console.log(
      '  표본별 1위는 그 표본에만 맞춘 값이라 다른 표본에서 무너진다. 적응형은 평균으로 판단한다.\n',
    )
  }

  console.table(
    r.entries.map((e) => ({
      표본: e.sample ?? '-',
      // 채점식 버전을 함께 보여준다 — 버전이 다르면 점수는 비교 대상이 아니다.
      단계: `${e.kind}@v${e.metricVersion ?? 1}`,
      시각: e.at,
      점수: e.best.score,
      개선: e.improved ? 'O' : '-',
      파라미터: JSON.stringify(
        Object.fromEntries(
          Object.entries(e.best).filter(([k]) =>
            ['analysis', 'dilate', 'psm', 'minConf'].includes(k),
          ),
        ),
      ),
    })),
  )
}

async function main() {
  const cmd = process.argv[2]
  if (cmd === 'report') return report()

  const args = parseArgs(process.argv)
  const started = Date.now()
  let out
  if (cmd === 'segment') out = await tuneSegment(args)
  else if (cmd === 'ocr') out = await tuneOcr(args)
  else {
    console.log('사용법: tune.mjs <segment|ocr|report> [--sample <dir>] [--keep]')
    process.exitCode = 1
    return
  }

  const best = out.results[0]
  const { improved, prev } = recordRatchet(out.kind, out.sample, best, out.results, new Date().toISOString())

  // 표본 하나의 1위는 그 표본에만 맞춘 값일 수 있다. 실제로 두 표본의 1위가 정반대였다.
  // 그래서 **여러 표본에 걸친 평균**을 함께 보여준다 — 채택 판단은 이 수로 한다.
  const adaptive = out.results.find((x) => x.dilate == null)
  if (adaptive) {
    console.log(
      `  (참고) 적응형 이 표본 점수 ${adaptive.score} · 1위와의 차 ${(best.score - adaptive.score).toFixed(4)}`,
    )
  }

  console.log(`\n최고: ${JSON.stringify(best)}`)
  if (improved) {
    console.log(prev ? `개선 — 이전 ${prev.score} → ${best.score}` : '첫 기준선 기록')
  } else {
    console.log(`개선 없음 — 이전 최고 ${prev.score} 유지. 파라미터를 바꾸지 않습니다(래칫).`)
  }
  console.log(`소요 ${Math.round((Date.now() - started) / 1000)}s · 기록 ${RATCHET}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
}
