// scripts/csat/pdf-columns3.mjs
//
// **2단 조판 복원 3판 — 문자 격자가 아니라 PDF 실좌표로 가른다.**
//
// ── 왜 3판이 필요한가 (실측 2026-09-16) ───────────────────────────────
// 1·2판은 `pdftotext -layout` 출력의 **문자 열 위치**로 단을 갈랐다. 그 출력은 글자를 격자에
// 밀어 넣은 근사라, 한글·영문·기호가 섞인 줄에서 열이 어긋난다. 그 어긋남이 본문에 부스러기로
// 남는다 — 지도 없는 210문항을 신호별로 갈랐더니 상위 둘이 이것이었다:
//
//   · 낱글자 42 (단이 낱말 가운데를 지남 — `the e personality`)
//   · 홀로 마침표 41 (옆 단 조각이 문장 사이로 끼어듦)
//
// 합쳐 **83문항**. 그 문항들은 `body_suspect` 가 붙어 골격이 안 구워지고, 학습자는 지문 지도
// 대신 산문을 본다. 가장 큰 유형(R-BLANK 115)에서 **90개가 지도 없이** 떨어진다.
//
// 좌표로 가르면 그 부스러기가 **원리상** 안 생긴다 — 왼 단 조각과 오른 단 조각은 x 가 다르고,
// 우리는 x 로 고른다. 같은 좌표계로 이미 증명한 것이 있다: 앵커 추출이 문제지 30개에서
// 문항 번호 45/45 · 선지 기호 840/840 · 고아 0 이었다(`pdf-anchors.mjs`).
//
// ── 무엇을 내놓는가 ───────────────────────────────────────────────────
// `columns2` 와 **같은 모양**의 텍스트다(쪽마다 왼 단 줄들 → 오른 단 줄들). 그래야
// `lib-passage.mjs` 가 그대로 읽는다 — 그 자는 `CSAT_COLUMNS` 를 존중하므로
// **기존 산출물을 건드리지 않고** 나란히 놓고 견줄 수 있다:
//
//   CSAT_COLUMNS=<대조폴더> node scripts/csat/build-corpus.mjs   (--out 으로 따로 뽑아 견준다)
//
// ⚠️ **빈칸을 넓은 공백으로 남긴다.** 평가원 PDF 의 빈칸은 밑줄이 아니라 **x 간격**이다.
//    `passageOf` 가 「4칸 이상 공백 → ______」로 되살리므로, 좌표를 글자 칸으로 환산할 때
//    그 간격이 살아 있어야 한다. 이 환산이 이 스크립트의 요점이다.
//
// 실행:
//   node scripts/csat/pdf-columns3.mjs                  (전 회차 → data/columns2 · 승계)
//   node scripts/csat/pdf-columns3.mjs --exam 2025      (한 회차만)
//   node scripts/csat/pdf-columns3.mjs --out <폴더>

import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}

// 산출 자리는 **`columns2` 를 그대로 승계한다.** 평가원 원문을 저장소에 두 벌로 늘리지
// 않으려는 것이다(그 폴더는 git 에 추적된다 · 31파일). 옛 판의 산출물은 커밋 이력에 남는다.
const OUT = path.resolve(arg('out') ?? 'scripts/csat/data/columns2')
const ONLY = arg('exam')

// 원본 위치는 옮겨진 적이 있다 — 후보를 훑는다(`ingest-listening.mjs` 와 같은 방식).
const DIRS = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출',
  'C:/Users/Administrator/Documents/영어/모의평가',
].filter((d) => fs.existsSync(d))

/** 파일 이름 → 회차 id. `build-anchor-data.mjs` 와 같은 규칙이다. */
function examIdOf(file) {
  const mock = file.match(/^(\d{4})(\d{2})_/)
  if (mock) return `M${mock[1].slice(2)}${mock[2]}`
  const sn = file.match(/^(\d{4})/)
  if (!sn) return null
  if (/영어\s*A/.test(file)) return `${sn[1]}A`
  if (/영어\s*B/.test(file)) return `${sn[1]}B`
  return sn[1]
}

/**
 * 한 쪽의 글자 조각 — 좌표와 함께.
 *
 * `transform` 의 e·f 가 기준선 왼쪽 끝이다. 폭은 `width`(조각 전체) 를 쓴다.
 */
async function fragmentsOf(page) {
  const content = await page.getTextContent()
  const out = []
  for (const it of content.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue
    if (!it.str.trim()) continue
    out.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width })
  }
  return out
}

/**
 * **한 글자의 평균 폭.** 좌표(포인트)를 글자 칸으로 환산하는 자다.
 *
 * 조각마다 `폭 / 글자 수` 를 내고 **중앙값**을 쓴다 — 평균을 쓰면 제목 한 줄(큰 글꼴)이
 * 전체를 끌어올려 본문 간격이 좁아지고, 그러면 **빈칸이 4칸을 못 채워 사라진다.**
 * 한글은 폭이 두 배라 섞이면 중앙값이 올라가므로 **라틴 문자 조각만** 센다.
 */
function charWidthOf(frags) {
  const per = []
  for (const f of frags) {
    if (!/^[\x20-\x7E]+$/.test(f.str)) continue
    if (f.str.length < 2 || !(f.w > 0)) continue
    per.push(f.w / f.str.length)
  }
  if (!per.length) return 5
  per.sort((a, b) => a - b)
  return per[Math.floor(per.length / 2)] || 5
}

/**
 * **단 경계.** 문항 번호는 단마다 같은 x 에서 시작하므로, 줄머리 조각 x 의 최빈값 둘이
 * 두 단의 왼쪽 여백이다.
 *
 * ⚠️ 경계는 **두 여백의 중간이 아니다** — 왼 단 본문은 오른 단 여백 가까이까지 뻗는다.
 *    중간값으로 가르면 왼 단 본문의 절반이 오른 단으로 넘어간다(`pdf-anchors.mjs` 가
 *    같은 실수를 하고 전 회차 66.3% 로 떨어뜨린 적이 있다). **오른 단 여백 바로 왼쪽**이다.
 */
function gutterOf(pages) {
  const count = new Map()
  for (const frags of pages) {
    for (const f of frags) {
      if (!/^\s*\d{1,2}\s*[.．]/.test(f.str)) continue
      const k = Math.round(f.x)
      count.set(k, (count.get(k) ?? 0) + 1)
    }
  }
  const top = [...count]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([x]) => x)
    .sort((a, b) => a - b)
  return top.length < 2 ? { margins: top, gutter: Infinity } : { margins: top, gutter: top[1] - 10 }
}

/**
 * 조각을 **줄**로 묶는다.
 *
 * ⚠️ 허용오차가 크면 빈칸을 사이에 둔 조각이 **위아래 줄로 갈려** 순서가 뒤집힌다
 *    (실측: `process it fosters in readers.because of the` — 「because of the」가 뒤로 갔다).
 *    기준선 y 는 같은 줄이면 거의 정확히 같으므로 좁게 잡는다.
 */
function toLines(frags, tol = 1.2) {
  const sorted = [...frags].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  for (const f of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - f.y) <= tol) last.parts.push(f)
    else lines.push({ y: f.y, parts: [f] })
  }
  for (const l of lines) l.parts.sort((a, b) => a.x - b.x)

  // ── 각주 별표를 제 줄로 돌려보낸다 ────────────────────────────────
  //
  // 평가원 각주(`* be entitled to: (～할) 권한이 있다`)의 별표는 **올려 친 활자**라 기준선 y 가
  // 본문과 다르다. 그래서 위 묶기가 별표만 따로 떼어 내고, 그러면 각주 줄이 `*` 로 시작하지
  // 않게 되어 **`passageOf` 의 각주 필터(`^\*+\s`)를 빠져나간다.**
  //
  // 실측 2026-09-16: 그 한 가지로 「지문에 한글이 남았다」가 46 → 217 로 터졌다(198문항).
  // 각주는 대개 한글 비율이 0.3 미만이라(`be entitled to: (～할) 권한이 있다` ≈ 0.24)
  // 한글 비율 필터로도 안 걸린다 — 별표가 제자리에 있어야만 걸린다.
  const merged = []
  for (const l of lines) {
    const only = l.parts.every((p) => /^\*+$/.test(p.str.trim()))
    if (!only) {
      merged.push(l)
      continue
    }
    // 가장 가까운 본문 줄에 끼워 넣는다 — 올려 친 것이므로 대개 바로 아래 줄이다.
    let best = null
    for (const t of lines) {
      if (t === l || t.parts.every((p) => /^\*+$/.test(p.str.trim()))) continue
      const d = Math.abs(t.y - l.y)
      if (d <= 10 && (!best || d < Math.abs(best.y - l.y))) best = t
    }
    if (best) {
      best.parts.push(...l.parts)
      best.parts.sort((a, b) => a.x - b.x)
    } else merged.push(l)
  }
  return merged
}

/** 한 단의 줄들을 글자 격자로 펴낸다 — x 간격이 공백 수가 된다(빈칸이 여기서 산다). */
function renderColumn(lines, left, cw) {
  const out = []
  for (const l of lines) {
    let s = ''
    for (const p of l.parts) {
      const col = Math.max(0, Math.round((p.x - left) / cw))
      // ⚠️ **구두점 앞에는 칸을 벌리지 않는다.** 마침표·쉼표는 제 조각으로 오는 일이 잦은데,
      //    좌표를 반올림하면 앞 낱말과 한 칸 벌어져 `… ℃ . Warming` 이 된다. 그 꼴은
      //    `suspectBody` 의 「홀로 선 마침표」(옆 단 조각이 끼어든 신호)에 걸려 **멀쩡한 지문이
      //    의심을 받는다**(실측 2026-09-16: 그 한 가지로 34 → 46). 붙여 쓰는 것이 원문이다.
      //    ⚠️ 단, **바로 옆일 때만** 붙인다. 간격을 무조건 삼키면 **빈칸이 사라진다** —
      //       문장 끝 빈칸 뒤에 마침표가 오는 꼴(`… reduces the ______.`)이 흔해서,
      //       그냥 붙였더니 「빈칸 없음」이 39 → 79 로 뛰었다(실측 2026-09-16).
      const glue = /^[.,;:?!)\]}’”'"%]/.test(p.str) && col - s.length <= 2
      if (glue) s += p.str
      else {
        if (col > s.length) s += ' '.repeat(col - s.length)
        // 겹치면 한 칸 띄운다 — 붙여 쓰면 낱말이 뭉개진다(`readers.because`).
        else if (s.length && !s.endsWith(' ') && !p.str.startsWith(' ')) s += ' '
        s += p.str
      }
    }
    out.push(s.replace(/\s+$/, ''))
  }
  return out
}

async function extract(pdfPath) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await getDocument({
    data: new Uint8Array(fs.readFileSync(pdfPath)),
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise

  const n = doc.numPages
  const pages = []
  for (let p = 1; p <= n; p += 1) pages.push(await fragmentsOf(await doc.getPage(p)))
  if (typeof doc.cleanup === 'function') await doc.cleanup()
  if (typeof doc.destroy === 'function') await doc.destroy()

  const cols = gutterOf(pages)
  const cw = charWidthOf(pages.flat())
  const out = []
  for (const frags of pages) {
    if (!frags.length) continue
    const left = frags.filter((f) => f.x < cols.gutter)
    const right = frags.filter((f) => f.x >= cols.gutter)
    // 1단 쪽(듣기 안내·도표)은 오른쪽이 비어 그대로 이어진다 — 특별히 다루지 않는다.
    const leftMargin = cols.margins[0] ?? 0
    const rightMargin = cols.margins[1] ?? cols.gutter
    out.push(...renderColumn(toLines(left), leftMargin, cw))
    if (right.length) out.push(...renderColumn(toLines(right), rightMargin, cw))
    out.push('')
  }
  return { text: out.join('\n'), pages: n, charWidth: cw, gutter: cols.gutter, margins: cols.margins }
}

fs.mkdirSync(OUT, { recursive: true })
let done = 0
const rows = []
for (const dir of DIRS) {
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.toLowerCase().endsWith('.pdf') || file.includes('정답표')) continue
    const examId = examIdOf(file)
    if (!examId || (ONLY && examId !== ONLY)) continue
    try {
      const r = await extract(path.join(dir, file))
      fs.writeFileSync(path.join(OUT, `${examId}.txt`), r.text)
      rows.push({ examId, ...r, chars: r.text.length })
      done += 1
    } catch (e) {
      rows.push({ examId, error: e.message })
    }
  }
}

console.log(`회차 ${done} → ${OUT}\n`)
for (const r of rows) {
  if (r.error) {
    console.log(`  ${String(r.examId).padEnd(6)} 실패: ${r.error.slice(0, 60)}`)
    continue
  }
  console.log(
    `  ${r.examId.padEnd(6)} ${String(r.pages).padStart(2)}쪽 · 글자폭 ${r.charWidth.toFixed(2)}pt · ` +
      `여백 ${r.margins.join('/')} · 경계 ${r.gutter} · ${r.chars.toLocaleString()}자`,
  )
}
if (!DIRS.length) console.log('  ⏭ 원본 폴더가 없다 — 아무것도 만들지 않았다')
