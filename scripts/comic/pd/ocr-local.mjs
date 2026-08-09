// scripts/comic/pd/ocr-local.mjs
//
// 컷 직접 OCR — 소스가 준 hOCR 대신 **복원된 컷 이미지에 직접** Tesseract 를 돌린다.
//
//   TESSERACTJS_DIR=/path/with/node_modules node scripts/comic/pd/ocr-local.mjs \
//     --intake intake/<slug> [--psm 3] [--min-conf 55] [--gazetteer names.json]
//
// ── 왜 만들었나 (hOCR 재활용의 천장) ─────────────────────────────
// IA hOCR 재활용(ocr.mjs)은 통과율 **24%** 에서 막혔다. 검수 필요 1위 사유가
// **비라틴 문자 12건** 이었는데, Tesseract 가 단어별로 스크립트를 자동 판별하다
// 손레터링을 키릴로 오인해서 생긴 문제였다(`іп` `сай` `гіз` `му`).
//
// 실측으로 확인한 개선 조건 (동일 컷 0004-c04 기준):
//   PSM 6  (단일 블록)          conf 42 · 비라틴 3   ← 나쁨
//   PSM 11 (sparse) + eng 고정  conf 63 · 비라틴 0  · 블록 31 (레이아웃 분석 없음 → 파편화)
//   PSM 3  (자동 레이아웃) + eng  conf 73 · 비라틴 0  · 블록 3  ← **채택**
//   PSM 11 + 대문자 화이트리스트 conf 25             ← 파괴적
//
// PSM 3 은 Tesseract 자체 레이아웃 분석을 돌려 **캡션 박스를 별도 블록으로 정확히 분리**한다
// (실측 블록0 conf 82 = 캡션만). 나란한 두 말풍선은 한 블록으로 묶이므로 가로 간격으로 한 번 더 가른다.
//
// 마지막 줄이 중요하다. 골든에이지 만화는 **캡션 박스만 전대문자**이고
// 말풍선은 혼합 대소문자다("My name is Wharton!"). 전대문자 가정은 틀렸다.
//
// ── 부수 효과: 좌표 체인이 사라진다 ──────────────────────────────
// hOCR 경로는 원본 스캔 px → 복원 크롭·업스케일 → 컷 → 정규화까지 되짚어야 했다.
// 컷 이미지를 직접 OCR 하면 좌표가 처음부터 컷 기준이라 나눗셈 한 번이면 끝난다.
//
// 의존성: tesseract.js (저장소에 넣지 않는다 — 파이프라인 도구는 스크래치패드에 격리).
//   npm i tesseract.js  후 TESSERACTJS_DIR 로 그 폴더를 지정한다.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { emitProgress } from './progress.mjs'

import { probeSize } from './lib-img.mjs'
import { groupLines, isGarbledWord, judgeBubble, normalize, truecase } from './ocr.mjs'

function loadTesseract() {
  const dir = process.env.TESSERACTJS_DIR
  try {
    const req = createRequire(dir ? path.join(path.resolve(dir), 'package.json') : import.meta.url)
    return req('tesseract.js')
  } catch {
    throw new Error(
      'tesseract.js 를 찾을 수 없습니다.\n' +
        '  npm i tesseract.js  후 TESSERACTJS_DIR=<그 폴더> 를 지정하세요.\n' +
        '  (파이프라인 도구는 앱 저장소 의존성에 넣지 않습니다)',
    )
  }
}

function parseArgs(argv) {
  // psm 4 = "가변 크기 텍스트 한 열" — 말풍선은 세로로 쌓인 짧은 줄이라 여기에 맞는다.
  // 자기발전 스윕(tune.mjs, 12조합 × 표본 2종) 실측 2026-08-09:
  //   psm3/55(직전 기본)  All Top 30.97 · Classics Illustrated 6.84
  //   psm4/55(채택)       All Top 32.84 · Classics Illustrated 7.95   ← 두 표본 모두 1위
  //   psm6·psm11 은 대사를 3~5배 많이 뱉지만 95%가 검수 대상이고 비라틴 오염까지 낳는다.
  const a = { psm: 4, minConf: 55 }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--intake') a.intake = argv[++i]
    else if (k === '--psm') a.psm = Number(argv[++i])
    else if (k === '--min-conf') a.minConf = Number(argv[++i])
    else if (k === '--gazetteer') a.gazetteer = argv[++i]
    else if (k === '--limit') a.limit = Number(argv[++i])
  }
  if (!a.intake) {
    console.error('사용법: node scripts/comic/pd/ocr-local.mjs --intake intake/<slug> [--psm 11] [--min-conf 55]')
    process.exit(1)
  }
  return a
}

/**
 * tesseract.js 단어 목록 → 라인 묶음.
 *
 * ★ 세로 근접만으로 묶으면 안 된다(실측 실패):
 *   컷 안에 말풍선이 **좌우로 나란히** 있으면 두 풍선의 같은 높이 줄이 한 줄로 병합돼
 *   "my name is wharton! My 1, than k I in house such is weat open h strangers" 처럼
 *   두 대사가 지퍼처럼 뒤섞인다. PSM 11(sparse)은 읽기 순서를 보장하지 않으므로 더 심하다.
 *
 *   그래서 **가로 인접성**을 함께 요구한다 — 줄의 오른쪽 끝에서 글자 높이의 일정 배수 안에
 *   있어야 같은 줄이다. 이 조건 하나로 나란한 풍선이 분리된다.
 */
function wordsToLines(words, gapFactor = 1.6) {
  // 위→아래, 같은 높이면 왼→오른 (읽기 순서)
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
  const lines = []
  for (const w of sorted) {
    const h = w.bbox.y1 - w.bbox.y0
    const cy = (w.bbox.y0 + w.bbox.y1) / 2
    const ln = lines.find((l) => {
      const sameRow = Math.abs((l.y0 + l.y1) / 2 - cy) < h * 0.6
      if (!sameRow) return false
      // 줄의 오른쪽 끝(또는 왼쪽 끝)과 가까워야 같은 줄. 멀면 다른 말풍선이다.
      const gapRight = w.bbox.x0 - l.x1
      const gapLeft = l.x0 - w.bbox.x1
      return gapRight < h * gapFactor && gapLeft < h * gapFactor
    })
    if (ln) {
      ln.words.push(w)
      ln.x0 = Math.min(ln.x0, w.bbox.x0); ln.y0 = Math.min(ln.y0, w.bbox.y0)
      ln.x1 = Math.max(ln.x1, w.bbox.x1); ln.y1 = Math.max(ln.y1, w.bbox.y1)
    } else {
      lines.push({ words: [w], x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })
    }
  }
  for (const l of lines) l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0)
  return lines
}

/** 한 글자짜리 기호(`>` `\` `|`)는 말풍선 꼬리·프레임선 오인식이다. 텍스트가 아니다. */
function isNoiseToken(t) {
  return t.length <= 1 && !/[a-zA-Z0-9]/.test(t)
}

async function main() {
  const args = parseArgs(process.argv)
  const { createWorker } = loadTesseract()
  const root = path.resolve(args.intake)
  const panelMf = JSON.parse(fs.readFileSync(path.join(root, 'panels', 'panels.manifest.json'), 'utf8'))
  const gaz = new Set(
    args.gazetteer ? JSON.parse(fs.readFileSync(args.gazetteer, 'utf8')).map((s) => String(s).toLowerCase()) : [],
  )

  const panels = args.limit ? panelMf.panels.slice(0, args.limit) : panelMf.panels
  console.log(`컷 ${panels.length}개 · PSM ${args.psm} · eng 고정 · 최소신뢰 ${args.minConf}\n`)

  // cachePath 를 고정하지 않으면 tesseract.js 가 **현재 작업 디렉터리**에 eng.traineddata(5MB)를
  // 떨어뜨린다. Admin 드레인은 저장소 루트를 cwd 로 spawn 하므로 그대로 두면 루트가 오염된다.
  const cachePath = process.env.TESSERACTJS_DIR
    ? path.resolve(process.env.TESSERACTJS_DIR)
    : path.join(root, '.tesseract-cache')
  fs.mkdirSync(cachePath, { recursive: true })
  const worker = await createWorker('eng', 1, { logger: () => {}, cachePath })
  // ★ eng 고정이 핵심. 자동 스크립트 판별을 끄면 손레터링의 키릴 오인이 사라진다(실측 12→0).
  await worker.setParameters({ tessedit_pageseg_mode: String(args.psm) })

  const out = []
  const allCandidates = new Set()
  let needReview = 0
  let dropped = 0

  for (const [i, p] of panels.entries()) {
    emitProgress(root, { stage: 'ocr', done: i, total: panels.length, current: `컷 ${i + 1}` })
    const file = path.resolve(process.cwd(), p.file)
    const { data } = await worker.recognize(file)
    // ⚠️ srcBox 로 폴백하면 안 된다 — **좌표계가 다르다.**
    //   컷 파일은 segment 가 --web(기본 1200px)으로 줄여 쓴 것이고 srcBox 는 원본 스캔 좌표다.
    //   실측: 파일 1200×1780 vs srcBox 3606×5348 → 모든 말풍선 박스가 정확히 3배 어긋났다
    //   (캡션이 y=0.82 인데 0.28 로 기록). 이 좌표는 비파괴 대사 오버레이(page-letter)와
    //   현대화 말풍선 마스킹이 그대로 쓰므로, 조용히 틀리면 글자가 엉뚱한 자리에 얹힌다.
    //   tesseract 가 치수를 안 줄 때는 **파일을 직접 재어** 같은 좌표계를 유지한다.
    const probed = data.width && data.height ? null : probeSize(file)
    const W = data.width ?? probed.w
    const H = data.height ?? probed.h

    const words = (data.words ?? [])
      .filter((w) => w.text?.trim() && !isNoiseToken(w.text.trim()))
      .filter((w) => {
        const ok = w.confidence >= args.minConf
        if (!ok) dropped += 1
        return ok
      })
      .map((w) => ({ text: w.text.trim(), conf: Math.round(w.confidence), bbox: w.bbox }))

    // 컷 이미지를 직접 읽었으므로 좌표가 이미 컷 기준이다 — 좌표 체인 불필요.
    const panelBox = { x: 0, y: 0, w: W, h: H }
    const lines = wordsToLines(words).map((l) => ({
      rb: { x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 },
      text: l.words.map((w) => w.text).join(' '),
      words: l.words.map((w) => ({ text: w.text, conf: w.conf })),
      lineClass: 'ocr_line',
    }))

    const bubbles = groupLines(lines, panelBox).map((g) => {
      const ws = g.lines.flatMap((l) => l.words)
      const raw = g.lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim()
      const { text, properNounCandidates } = truecase(raw, gaz)
      properNounCandidates.filter((c) => !isGarbledWord(c)).forEach((c) => allCandidates.add(c))
      const conf = Math.round(ws.reduce((s, w) => s + w.conf, 0) / Math.max(1, ws.length))
      const { needsReview, reasons } = judgeBubble(text, conf)
      if (needsReview) needReview += 1
      return { text, raw, kind: 'balloon', box: g.box, confidence: conf, needsReview, reasons }
    })

    out.push({ pageOrder: p.pageOrder, page: p.page, panelIndex: p.panelIndex, bubbles })
    process.stdout.write(`\r  ${i + 1}/${panels.length}`)
  }
  await worker.terminate()
  console.log('')

  const totalBubbles = out.reduce((s, p) => s + p.bubbles.length, 0)
  const withText = out.filter((p) => p.bubbles.length > 0).length
  const clean = totalBubbles - needReview
  const nonLatin = out
    .flatMap((p) => p.bubbles)
    .filter((b) => b.reasons.some((r) => r.startsWith('비라틴'))).length

  const mf = path.join(root, 'bubbles.local.manifest.json')
  fs.writeFileSync(
    mf,
    JSON.stringify(
      {
        engine: 'tesseract.js',
        params: { psm: args.psm, lang: 'eng', minConf: args.minConf },
        stats: {
          panels: out.length, panelsWithText: withText, bubbles: totalBubbles,
          droppedWords: dropped, needsReview: needReview, nonLatinBubbles: nonLatin,
        },
        properNounCandidates: [...allCandidates].sort(),
        panels: out,
      },
      null,
      2,
    ),
  )

  console.log(`컷 ${out.length}개 중 ${withText}개에서 대사 ${totalBubbles}개 (저신뢰 단어 ${dropped}개 제외)`)
  console.log(`  그대로 쓸 수 있음 ${clean}개(${Math.round((clean / Math.max(1, totalBubbles)) * 100)}%) · 검수 필요 ${needReview}개`)
  console.log(`  비라틴 오염 대사 ${nonLatin}개`)
  console.log(`→ ${path.relative(process.cwd(), mf)}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${e.message}`)
    process.exit(1)
  })
}
