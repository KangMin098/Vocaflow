// scripts/comic/pd/ocr.mjs
//
// 대사 추출 — hOCR 단어 좌표를 **컷 단위 말풍선**으로 접는다.
//
//   node scripts/comic/pd/ocr.mjs --intake intake/<slug> [--min-conf 60] [--gazetteer names.json]
//
// PD 스캔이 AI 생성 만화와 결정적으로 다른 지점:
//   AI 만화는 우리가 대사를 저작하므로 텍스트가 이미 데이터다.
//   PD 스캔은 대사가 **이미지에 구워져** 있어서, 리더의 대사존·verbatim blur→reveal·
//   vocab 칩이 전부 죽는다. 텍스트를 데이터로 꺼내야 비로소 학습 콘텐츠가 된다.
//
// IA 는 Tesseract hOCR 을 함께 제공한다(실측: 52p 7,615단어, 단어별 bbox + x_wconf).
// 그래서 이 단계는 "OCR 을 돌린다"가 아니라 **"이미 있는 좌표를 컷에 배분한다"** 이다.
//
// 좌표 체인 (세 단계를 정확히 되짚어야 한다):
//   hOCR px(원본 스캔) ─(복원 크롭 빼기)→ ─(업스케일 곱하기)→ 복원본 px
//   ─(컷 박스 빼고 나누기)→ **컷 기준 0~1 정규화**
//   정규화로 끝내는 이유: 컷 이미지는 웹 배포용으로 한 번 더 축소되므로 px 로 두면 깨진다.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ─── hOCR 파싱 ────────────────────────────────────────────────────
// XML 파서를 붙이지 않는다. hOCR 은 Tesseract 가 기계 생성하는 규칙적인 마크업이라
// 정규식으로 충분하고, 1.4MB 를 DOM 으로 올리는 비용도 아낀다.

const bboxOf = (title) => {
  const m = /bbox (\d+) (\d+) (\d+) (\d+)/.exec(title ?? '')
  return m ? { x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4] } : null
}
const confOf = (title) => {
  const m = /x_wconf (\d+)/.exec(title ?? '')
  return m ? +m[1] : null
}
const unescapeHtml = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

/** hOCR → 페이지별 라인·단어. 페이지 순서는 문서 등장 순서 = 스캔 순서. */
export function parseHocr(html) {
  const pages = []
  // 페이지 경계로 자른다
  const pageRe = /<div class="ocr_page"[^>]*title="([^"]*)"[^>]*>/g
  const marks = []
  let m
  while ((m = pageRe.exec(html))) marks.push({ index: m.index, title: unescapeHtml(m[1]) })

  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length
    const chunk = html.slice(start, end)
    const pbox = bboxOf(marks[i].title)

    const lines = []
    // 라인 클래스 3종: ocr_line(1231) · ocr_caption(186) · ocr_textfloat(26)
    //
    // ★ 검증하고 기각한 가설 (다시 시도하지 말 것):
    //   "ocr_caption 이 인쇄체 내레이션 박스일 테니, 그것만 자동 채택하면 품질이 오른다"
    //   → **정반대였다.** ocr_caption 20건의 실제 내용은 `"<="` `"<"` `"2"` `"E"` `"+"` 같은
    //     **순수 노이즈**다. Tesseract 가 컷 테두리·말풍선 꼬리 같은 잡선을 caption 으로 라벨한다.
    //     포함시키자 통과율이 24% → 13% 로 떨어졌다(노이즈 20건 유입).
    //   → 결론: 내레이션 박스는 그냥 `ocr_line` 으로 들어온다. ocr_line 만 쓴다.
    //     조사용으로 파싱은 하되 기본 제외( --include-nonline 로 확인 가능 ).
    const lineRe =
      /<span class="(ocr_line|ocr_caption|ocr_textfloat)"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/span>\s*(?=<span class="(?:ocr_line|ocr_caption|ocr_textfloat)"|<\/p>|<\/div>)/g
    let lm
    while ((lm = lineRe.exec(chunk))) {
      const lineClass = lm[1]
      const lbox = bboxOf(unescapeHtml(lm[2]))
      const words = []
      const wordRe = /<span class="ocrx_word"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/span>/g
      let wm
      while ((wm = wordRe.exec(lm[3]))) {
        const t = unescapeHtml(wm[2]).trim()
        if (!t) continue
        const wt = unescapeHtml(wm[1])
        words.push({ text: t, box: bboxOf(wt), conf: confOf(wt) ?? 0 })
      }
      if (words.length) lines.push({ box: lbox, words, lineClass })
    }
    pages.push({ pageIndex: i, box: pbox, lines })
  }
  return pages
}

// ─── truecasing ───────────────────────────────────────────────────
// 골든에이지 레터링은 **전부 대문자**다. 그대로 두면 학습 자료로 못 쓴다
// (문장 경계도, 고유명사도 안 보이고, 어휘 매칭도 어긋난다).
//
// 완전 자동 복원은 불가능하다 — "BIRCH" 가 인명인지 자작나무인지는 문맥이 정한다.
// 그래서 여기서는 확실한 것만 복원하고, **애매한 후보는 사람에게 넘긴다**.

const FUNCTION_WORDS = new Set(
  ('a an the and or but if then than that this these those of in on at to for with from by as is are was were be been being ' +
    'am do does did have has had will would shall should can could may might must not no nor so such very too also just only ' +
    'i you he she it we they me him her us them my your his its our their mine yours hers ours theirs what which who whom whose ' +
    'when where why how all any both each few more most other some there here now well up down out off over under again once')
    .split(' '),
)

/** 문장 시작 여부 판정용 — 종결부호 뒤 첫 알파벳. */
function sentenceCase(lower) {
  let out = ''
  let capNext = true
  for (const ch of lower) {
    if (capNext && /[a-z]/.test(ch)) {
      out += ch.toUpperCase()
      capNext = false
    } else {
      out += ch
      if (/[.!?]/.test(ch)) capNext = true
    }
  }
  return out
}

/**
 * @param {string} raw       대문자 원문
 * @param {Set<string>} gaz  고유명사 사전(소문자) — 있으면 복원, 없으면 후보로 보고
 * @returns {{ text: string, properNounCandidates: string[] }}
 */
export function truecase(raw, gaz = new Set()) {
  const candidates = new Set()
  const lower = raw.toLowerCase()
  let text = sentenceCase(lower)

  text = text.replace(/\b([a-z]+)\b/g, (w, word, offset) => {
    // 1인칭 I 와 축약형은 규칙으로 확실히 복원된다
    if (word === 'i') return 'I'
    if (gaz.has(word)) return word[0].toUpperCase() + word.slice(1)
    // 문장 중간 + 기능어 아님 → 고유명사 후보(사람이 확인)
    const before = text.slice(0, offset)
    const midSentence = /[a-z][^.!?]*\s$/.test(before)
    if (midSentence && !FUNCTION_WORDS.has(word) && word.length > 2) candidates.add(word)
    return word
  })
  // I'll / I'm 같은 축약형
  text = text.replace(/\bi'/g, "I'")
  return { text, properNounCandidates: [...candidates] }
}

// ─── 좌표 매핑 ────────────────────────────────────────────────────

/** hOCR 원본 px → 복원본 px */
function toRestored(box, rec) {
  const c = rec.crop ?? { x: 0, y: 0 }
  const s = rec.params?.scale ?? 1
  return {
    x0: (box.x0 - c.x) * s,
    y0: (box.y0 - c.y) * s,
    x1: (box.x1 - c.x) * s,
    y1: (box.y1 - c.y) * s,
  }
}

const center = (b) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 })

/** 두 사각형의 겹침 면적. 컷 박스가 서로 겹칠 때 라인 소유권을 정하는 기준. */
function overlapArea(line, box) {
  const w = Math.min(line.x1, box.x + box.w) - Math.max(line.x0, box.x)
  const h = Math.min(line.y1, box.y + box.h) - Math.max(line.y0, box.y)
  return w > 0 && h > 0 ? w * h : 0
}

/** 복원본 px → 컷 기준 0~1. 컷 밖으로 삐져나온 부분은 잘라낸다(음수 좌표 방지). */
function normalize(box, panelBox) {
  const x0 = Math.max(box.x0, panelBox.x)
  const y0 = Math.max(box.y0, panelBox.y)
  const x1 = Math.min(box.x1, panelBox.x + panelBox.w)
  const y1 = Math.min(box.y1, panelBox.y + panelBox.h)
  const cl = (v) => +Math.max(0, Math.min(1, v)).toFixed(4)
  return {
    x: cl((x0 - panelBox.x) / panelBox.w),
    y: cl((y0 - panelBox.y) / panelBox.h),
    w: cl((x1 - x0) / panelBox.w),
    h: cl((y1 - y0) / panelBox.h),
  }
}

// ─── OCR 품질 판정 ────────────────────────────────────────────────
//
// 실측에서 드러난 뚜렷한 패턴: **캡션 박스(인쇄체)는 거의 완벽하고, 손레터링 말풍선은 깨진다.**
// 게다가 Tesseract 가 단어별로 스크립트를 자동 판별하다 보니 손글씨에서 키릴 문자로
// 오인하는 일이 잦다(`іп`, `сай`, `гіз`, `му`). 이건 노이즈지 텍스트가 아니다.
//
// 학습 콘텐츠에 깨진 문장이 실리면 안 되므로, 버리지는 않되 **needsReview 로 표시**해
// 검수 단계가 무엇을 먼저 볼지 알게 한다.

const NON_LATIN = /[^ -ɏ‘-”\s]/ // 라틴 확장 + 일반 문장부호 밖

/** 라틴 문자가 아닌 글자가 섞인 단어는 오인식이다. */
export function isGarbledWord(t) {
  return NON_LATIN.test(t) || /[а-яА-ЯёЁ]/.test(t)
}

/**
 * 대사 하나의 신뢰 판정. 규칙 하나로는 못 잡아서 세 신호를 합친다.
 * 반환된 reasons 가 검수 화면에서 "왜 의심스러운가"를 그대로 설명해준다.
 */
export function judgeBubble(text, avgConf) {
  const reasons = []
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { needsReview: true, reasons: ['빈 텍스트'] }

  const garbled = tokens.filter(isGarbledWord).length
  if (garbled > 0) reasons.push(`비라틴 문자 ${garbled}개`)

  // 손레터링 오인식은 1~2글자 파편으로 흩어진다
  const frag = tokens.filter((t) => /^[a-zA-Z]{1,2}$/.test(t)).length
  if (frag / tokens.length > 0.3) reasons.push(`짧은 파편 ${frag}/${tokens.length}`)

  // 표지 장식·잘린 로고("Featuring", "Stor", "%")가 고신뢰로 통과하던 구멍.
  // 대사는 최소한 문장 꼴을 갖춘다 — 3토큰 미만이면서 종결부호도 없으면 대사가 아니다.
  if (tokens.length < 3 && !/[.!?…]$/.test(text.trim())) reasons.push(`문장 미만(${tokens.length}토큰)`)

  // 문장부호도 알파벳도 아닌 것만 남은 경우
  if (!/[a-zA-Z]{3,}/.test(text)) reasons.push('알파벳 단어 없음')

  if (avgConf < 80) reasons.push(`평균 신뢰도 ${avgConf}%`)

  return { needsReview: reasons.length > 0, reasons }
}

/**
 * 같은 컷 안의 라인들을 말풍선으로 묶는다.
 * 말풍선 하나는 여러 줄이지만 **세로로 가깝고 가로로 겹친다**. 그 두 조건으로 잇는다.
 */
function groupLines(lines, panelBox) {
  const sorted = [...lines].sort((a, b) => a.rb.y0 - b.rb.y0)
  const groups = []
  for (const ln of sorted) {
    const lineH = ln.rb.y1 - ln.rb.y0
    const g = groups.find((gr) => {
      // 캡션 줄과 말풍선 줄은 섞지 않는다 — 서로 다른 발화 주체이고 품질도 다르다.
      if (gr.lineClass !== ln.lineClass) return false
      const gap = ln.rb.y0 - gr.y1
      const overlap =
        Math.min(gr.x1, ln.rb.x1) - Math.max(gr.x0, ln.rb.x0) > Math.min(gr.x1 - gr.x0, ln.rb.x1 - ln.rb.x0) * 0.25
      return gap >= -lineH * 0.5 && gap < lineH * 1.4 && overlap
    })
    if (g) {
      g.lines.push(ln)
      g.x0 = Math.min(g.x0, ln.rb.x0); g.y0 = Math.min(g.y0, ln.rb.y0)
      g.x1 = Math.max(g.x1, ln.rb.x1); g.y1 = Math.max(g.y1, ln.rb.y1)
    } else {
      groups.push({ lines: [ln], lineClass: ln.lineClass, x0: ln.rb.x0, y0: ln.rb.y0, x1: ln.rb.x1, y1: ln.rb.y1 })
    }
  }
  return groups.map((g) => ({ box: normalize(g, panelBox), lines: g.lines, lineClass: g.lineClass }))
}

function parseArgs(argv) {
  const a = { minConf: 60, includeNonLine: false }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--intake') a.intake = argv[++i]
    else if (k === '--min-conf') a.minConf = Number(argv[++i])
    else if (k === '--gazetteer') a.gazetteer = argv[++i]
    else if (k === '--include-nonline') a.includeNonLine = true
  }
  if (!a.intake) {
    console.error('사용법: node scripts/comic/pd/ocr.mjs --intake intake/<slug> [--min-conf 60] [--gazetteer names.json]')
    process.exit(1)
  }
  return a
}

async function main() {
  const args = parseArgs(process.argv)
  const root = path.resolve(args.intake)
  const hocrPath = path.join(root, 'ocr', 'source.hocr')
  if (!fs.existsSync(hocrPath)) {
    console.error(`hOCR 이 없습니다: ${hocrPath}\n소스가 OCR 을 주지 않는 어댑터면 자체 OCR(own-ocr)이 필요합니다.`)
    process.exit(1)
  }
  const restoreMf = JSON.parse(fs.readFileSync(path.join(root, 'restored', 'restore.manifest.json'), 'utf8'))
  const panelMf = JSON.parse(fs.readFileSync(path.join(root, 'panels', 'panels.manifest.json'), 'utf8'))

  const gaz = new Set(
    args.gazetteer ? JSON.parse(fs.readFileSync(args.gazetteer, 'utf8')).map((s) => String(s).toLowerCase()) : [],
  )

  const pages = parseHocr(fs.readFileSync(hocrPath, 'utf8'))
  console.log(`hOCR ${pages.length}페이지 · 복원 ${restoreMf.pages.length}장 · 컷 ${panelMf.panels.length}개\n`)

  // 복원 manifest 는 취득 순서(0001..)이고 hOCR 도 스캔 순서다 → 인덱스로 맞춘다.
  const out = []
  const allCandidates = new Set()
  let dropped = 0
  let needReview = 0
  const byKind = {}

  for (const [i, rec] of restoreMf.pages.entries()) {
    const hp = pages[i]
    if (!hp) continue
    const pageName = path.basename(rec.out).replace(/\.jpg$/i, '')
    const panels = panelMf.panels.filter((p) => p.page === pageName)
    if (panels.length === 0) continue

    // 라인을 복원본 좌표로 옮기고, 신뢰도 낮은 단어는 버린다
    const lines = []
    for (const ln of hp.lines) {
      if (!args.includeNonLine && ln.lineClass !== 'ocr_line') continue
      const words = ln.words.filter((w) => w.box && w.conf >= args.minConf)
      dropped += ln.words.length - words.length
      if (words.length === 0) continue
      const b = {
        x0: Math.min(...words.map((w) => w.box.x0)),
        y0: Math.min(...words.map((w) => w.box.y0)),
        x1: Math.max(...words.map((w) => w.box.x1)),
        y1: Math.max(...words.map((w) => w.box.y1)),
      }
      lines.push({ rb: toRestored(b, rec), text: words.map((w) => w.text).join(' '), words, lineClass: ln.lineClass })
    }

    // 라인 → 컷 배타 배정.
    //   컷 분할이 겹치는 박스를 내놓을 수 있어(실측: 같은 대사가 두 컷에 중복 출현)
    //   "중심이 들어가는 컷 전부"가 아니라 **겹침 면적이 가장 큰 컷 하나**에만 준다.
    const owned = new Map(panels.map((p) => [p.pageOrder, []]))
    for (const ln of lines) {
      let best = null
      let bestArea = 0
      for (const p of panels) {
        const a = overlapArea(ln.rb, p.srcBox)
        if (a > bestArea) { bestArea = a; best = p }
      }
      // 컷과 절반 이상 겹쳐야 그 컷의 대사로 인정 (거터에 걸친 장식은 버린다)
      const lineArea = (ln.rb.x1 - ln.rb.x0) * (ln.rb.y1 - ln.rb.y0)
      if (best && lineArea > 0 && bestArea / lineArea >= 0.5) owned.get(best.pageOrder).push(ln)
    }

    for (const panel of panels) {
      const mine = owned.get(panel.pageOrder) ?? []
      const bubbles = groupLines(mine, panel.srcBox).map((g) => {
        const words = g.lines.flatMap((l) => l.words)
        const raw = g.lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim()
        const { text, properNounCandidates } = truecase(raw, gaz)
        properNounCandidates.filter((c) => !isGarbledWord(c)).forEach((c) => allCandidates.add(c))
        const conf = Math.round(words.reduce((s, w) => s + w.conf, 0) / Math.max(1, words.length))
        // Tesseract 레이아웃 분류가 곧 발화 형태다: ocr_caption = 인쇄체 캡션 박스,
        // 나머지 = 손레터링 말풍선. 실측상 품질이 완전히 다르므로 분리해 다룬다.
        const kind = g.lineClass === 'ocr_caption' ? 'caption' : 'balloon'
        const { needsReview, reasons } = judgeBubble(text, conf)
        if (needsReview) needReview += 1
        byKind[kind] = byKind[kind] || { total: 0, clean: 0 }
        byKind[kind].total += 1
        if (!needsReview) byKind[kind].clean += 1
        return { text, raw, kind, box: g.box, confidence: conf, needsReview, reasons }
      })
      out.push({ pageOrder: panel.pageOrder, page: panel.page, panelIndex: panel.panelIndex, bubbles })
    }
  }

  const withText = out.filter((p) => p.bubbles.length > 0).length
  const totalBubbles = out.reduce((s, p) => s + p.bubbles.length, 0)
  const mf = path.join(root, 'bubbles.manifest.json')
  fs.writeFileSync(
    mf,
    JSON.stringify(
      {
        minConf: args.minConf,
        stats: { panels: out.length, panelsWithText: withText, bubbles: totalBubbles, droppedWords: dropped, needsReview: needReview, byKind },
        // 사람이 확인해 gazetteer 로 되먹임 → 다음 실행에서 고유명사가 복원된다
        properNounCandidates: [...allCandidates].sort(),
        panels: out,
      },
      null,
      2,
    ),
  )

  const clean = totalBubbles - needReview
  const pct = Math.round((clean / Math.max(1, totalBubbles)) * 100)
  console.log(`컷 ${out.length}개 중 ${withText}개에서 대사 ${totalBubbles}개 추출 (저신뢰 단어 ${dropped}개 제외)`)
  console.log(`  그대로 쓸 수 있음 ${clean}개(${pct}%) · 검수 필요 ${needReview}개`)
  for (const [k, v] of Object.entries(byKind)) {
    console.log(`    ${k.padEnd(8)} ${v.clean}/${v.total} 통과 (${Math.round((v.clean / Math.max(1, v.total)) * 100)}%)`)
  }
  console.log(`고유명사 후보 ${allCandidates.size}개 — 확인 후 --gazetteer 로 되먹이면 대문자 복원됩니다`)
  console.log(`→ ${path.relative(process.cwd(), mf)}`)

  const sample = out.find((p) => p.bubbles.length >= 2)
  if (sample) {
    console.log(`\n샘플 (컷 ${sample.pageOrder}):`)
    for (const b of sample.bubbles.slice(0, 3)) {
      console.log(`  [${b.confidence}%] ${b.text.slice(0, 78)}`)
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
