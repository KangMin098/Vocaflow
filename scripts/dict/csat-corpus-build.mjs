// scripts/dict/csat-corpus-build.mjs
//
// **수능 영어 기출 13개년 원문을 실제로 세어 lemma 빈도를 만든다.**
//
// ── 왜 필요한가 (실측 2026-08-21) ────────────────────────────────────
// DB 에는 이미 `lexicon_frequencies` source_id=1 (`kice_csat`, 3,369 lemma) 이 있고
// 컬럼 이름은 빈도 데이터를 자처한다 — `raw_count` · `normalized_freq` ·
// `rank_in_source` · `appears_every_year`. **그런데 그 값들은 빈도가 아니다.**
//
//   raw_count 최댓값 9         — 13개년인데 9가 최대. 실제로는 "등장 연도 수"였다.
//   normalized_freq 6923.08    — 9/13*10000. 토큰이 아니라 연도 비율.
//   appears_every_year         — 3,369행 전부 false.
//   social                     — 2014 한 해만 등장으로 기록. people·time·make·world 는 아예 없음.
//
// 즉 문항별로 골라 적은 **핵심어 목록**을 빈도 테이블에 넣어 둔 것이다. 원문을 센 적이 없다.
// 이 스크립트가 원문(.txt 13개년)을 WLP(winkNLP)로 토큰화해 **진짜 빈도**를 만든다.
//
// ── 원본의 함정 두 가지 ──────────────────────────────────────────────
// 1. 2023·2024·2026 .txt 는 **홀수형 + 짝수형이 한 파일에** 들어 있다(각 8쪽 × 2).
//    지문은 두 형이 같으므로 그대로 세면 그 세 해만 빈도가 2배로 부풀고,
//    "몇 개년에 나왔나" 는 안 변해서 **눈에 안 띈다.** 앞 블록(홀수형)만 쓴다.
// 2. 2014_B.txt 는 2014_A.txt 와 **바이트 단위로 동일**하다(B형 PDF 는 따로 있는데도).
//    추출 때 덮어쓴 것 — B형 지문은 확보돼 있지 않다. 세면 2014만 2배가 된다. 제외한다.
//
// 한국어 지시문·선택지는 WLP 뒤 `^[a-z'-]+$` 검사에서 자동으로 걸러진다(별도 제거 불필요).
//
// 실행:
//   pnpm dlx tsx scripts/dict/csat-corpus-build.mjs
//   pnpm dlx tsx scripts/dict/csat-corpus-build.mjs --dir "<기출 폴더>" --out scripts/dict/csat-corpus

import fs from 'node:fs'
import path from 'node:path'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SRC_DIR = arg('dir') ?? 'C:/Users/Administrator/Documents/수능영어기출/최종'
const OUT_DIR = path.resolve(arg('out') ?? 'scripts/dict/csat-corpus')

const { processText } = await import('@vocaflow/wlp')

// ── 학습 낱말 판정 — library-pipeline `isValidLearningWord` 와 같은 규칙 ─────
// (그 함수는 export 되지 않아 여기서 같은 규칙을 다시 쓴다. 규칙이 갈리면
//  기출 코퍼스와 도서 코퍼스의 표제어 집합이 서로 안 맞는다.)
const TOKEN_BLOCKLIST = new Set([
  'mr', 'mrs', 'ms', 'dr', 'sir', 'madam', 'lord', 'lady',
  "'s", "'t", "'ll", "'re", "'ve", "'d", "'m", 'll', 're', 've',
])
function isValidLearningWord(raw) {
  const lemma = String(raw ?? '').toLowerCase().trim()
  if (!lemma) return false
  if (lemma.length < 2 || lemma.length > 30) return false
  if (/\d/.test(lemma)) return false
  if (/[.:]/.test(lemma)) return false
  if (!/^[a-z'-]+$/.test(lemma)) return false
  if (/^['-]|['-]$/.test(lemma)) return false
  if (lemma.length >= 3 && /^[ivxlcdm]+$/.test(lemma) && !/^(mix|dim|did|mid|lid|civil)$/.test(lemma)) return false
  if (TOKEN_BLOCKLIST.has(lemma)) return false
  return true
}

const HEADER_RE = /저작권은 한국교육과정평가원/

/**
 * 홀수형/짝수형이 한 파일에 든 경우 앞 블록만 남긴다.
 * 경계 = 마지막 '홀수형' 표시 뒤에 처음 나오는 쪽 머리글 줄.
 * 두 형이 모두 있지 않으면 원문 그대로 돌려준다.
 */
function keepSingleForm(lines, file) {
  const holIdx = []
  const jjakIdx = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === '홀수형') holIdx.push(i)
    if (t === '짝수형') jjakIdx.push(i)
  })
  if (!holIdx.length || !jjakIdx.length) return { lines, split: false, form: holIdx.length ? '홀수형' : '짝수형' }

  const lastHol = holIdx[holIdx.length - 1]
  const firstJjak = jjakIdx[0]
  if (firstJjak < lastHol) throw new Error(`${file}: 홀/짝 블록 순서가 예상과 다르다`)
  const boundary = lines.findIndex((l, i) => i > lastHol && i < firstJjak && HEADER_RE.test(l))
  if (boundary < 0) throw new Error(`${file}: 홀/짝 경계 머리글을 못 찾았다`)
  return { lines: lines.slice(0, boundary), split: true, form: '홀수형', boundary }
}

/** 블록이 한 회분 시험인지 확인 — 18번·45번이 각각 한 번씩만 있어야 한다. */
function assertOneExam(text, label) {
  const q18 = (text.match(/^18[.]/gm) ?? []).length
  const q45 = (text.match(/^45[.]/gm) ?? []).length
  if (q18 !== 1 || q45 !== 1) throw new Error(`${label}: 회분 분리 실패 (18번 ${q18}회 · 45번 ${q45}회)`)
}

const files = fs.readdirSync(SRC_DIR).filter((f) => /^\d{4}(_[AB])?\.txt$/.test(f)).sort()

// 2014_B 는 2014_A 와 내용이 같으면 제외한다(추출 사고). 다르면 정상 자료이므로 쓴다.
const skipped = []
const usable = []
for (const f of files) {
  if (f === '2014_B.txt') {
    const a = fs.readFileSync(path.join(SRC_DIR, '2014_A.txt'))
    const b = fs.readFileSync(path.join(SRC_DIR, f))
    if (a.equals(b)) { skipped.push({ file: f, reason: '2014_A.txt 와 바이트 동일 — B형 추출 사고, 세면 2014만 2배' }); continue }
  }
  usable.push(f)
}

const perYear = new Map() //  year → { lemma → count }
const propnAll = new Map() // lemma → { propn, all } — 고유명사 태깅 비율
const yearMeta = []

for (const f of usable) {
  const year = Number(f.slice(0, 4))
  const raw = fs.readFileSync(path.join(SRC_DIR, f), 'utf8').replace(/\r/g, '')
  const { lines, split, form } = keepSingleForm(raw.split('\n'), f)
  const text = lines.join('\n')
  assertOneExam(text, f)

  const result = processText(text)
  const counts = perYear.get(year) ?? new Map()
  const propn = propnAll
  let tokens = 0
  for (const sent of result.sentences) {
    let seenWord = false //  이 문장에서 낱말이 하나라도 지나갔나 (문장 첫 낱말 판정)
    for (const tk of sent.tokens) {
      if (tk.isPunctuation || tk.isStopWord) continue
      // 고유명사 여부는 여기서 버리지 않고 비율로만 남긴다 —
      // winkNLP 는 제목·행사명 안의 science·university·art 도 PROPN 으로 붙여서,
      // POS 만으로 자르면 실단어가 같이 날아간다(실측). 판정은 사전 대조 단계에서 한다.
      const lemma = String(tk.lemma ?? '').toLowerCase()
      if (!isValidLearningWord(lemma)) continue
      counts.set(lemma, (counts.get(lemma) ?? 0) + 1)
      const pr = propn.get(lemma) ?? { propn: 0, all: 0, lower: 0, midUpper: 0 }
      pr.all += 1
      if (tk.pos === 'PROPN') pr.propn += 1
      // 문장 중간의 소문자 표기 — 인명·지명 판정의 실제 기준.
      // winkNLP 는 제목 속 Science·Art 도 PROPN 으로 붙이고 문장 첫 낱말도 대문자라
      // POS 나 대문자 하나만으로는 못 가른다. **한 번이라도 소문자로 쓰였으면 보통명사다.**
      const first = tk.surface?.[0] ?? ''
      const isLower = /[a-z]/.test(first)
      if (isLower) pr.lower += 1
      // 문장 첫 낱말의 대문자는 근거가 아니다 — scientists·activities 는 늘 문장 맨 앞에
      // 나와서("Scientists have found…") 대문자만 보면 전부 인명으로 몰린다(실측).
      else if (/[A-Z]/.test(first) && seenWord) pr.midUpper += 1
      seenWord = true
      propn.set(lemma, pr)
      tokens += 1
    }
  }
  perYear.set(year, counts)
  yearMeta.push({ year, file: f, form, formSplit: split, lines: lines.length, contentTokens: tokens, uniqueLemmas: counts.size })
  console.log(`${year}  ${f.padEnd(12)} ${split ? '홀/짝 분리' : '단일형   '} 토큰 ${String(tokens).padStart(6)} · 고유 ${String(counts.size).padStart(5)}`)
}

// ── lemma 단위로 합치기 ────────────────────────────────────────────
const years = [...perYear.keys()].sort((a, b) => a - b)
const agg = new Map()
for (const y of years) {
  for (const [lemma, n] of perYear.get(y)) {
    const e = agg.get(lemma) ?? { lemma, total: 0, byYear: {} }
    e.total += n
    e.byYear[y] = n
    agg.set(lemma, e)
  }
}
const rows = [...agg.values()].map((e) => {
  const ys = Object.keys(e.byYear).map(Number).sort((a, b) => a - b)
  const pr = propnAll.get(e.lemma) ?? { propn: 0, all: 0, lower: 0, midUpper: 0 }
  const propn_ratio = pr.all ? Number((pr.propn / pr.all).toFixed(3)) : 0
  const lower_seen = pr.lower > 0
  // 인명·지명 = 소문자로 쓰인 적이 없고 + 문장 중간에서 대문자로 쓰인 적이 있는 것.
  // 둘 다 0(문장 맨 앞에서만 관측)이면 판단 근거가 없으므로 보통명사로 둔다.
  const name_like = pr.lower === 0 && pr.midUpper > 0
  return { ...e, propn_ratio, lower_seen, name_like, years_appeared: ys, years_n: ys.length, appears_every_year: ys.length === years.length }
})
rows.sort((a, b) => b.total - a.total || a.lemma.localeCompare(b.lemma))
rows.forEach((r, i) => { r.rank = i + 1 })

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'corpus.json'), JSON.stringify({
  built_for: 'kice_csat 원문 빈도',
  source_dir: SRC_DIR,
  years, years_count: years.length,
  skipped, files: yearMeta,

  total_content_tokens: yearMeta.reduce((s, m) => s + m.contentTokens, 0),
  unique_lemmas: rows.length,
  rows,
}, null, 1))

console.log('')
console.log(`연도 ${years.length}개 (${years[0]}~${years[years.length - 1]})  제외 ${skipped.length}건`)
console.log(`내용어 토큰 ${yearMeta.reduce((s, m) => s + m.contentTokens, 0).toLocaleString()} · 고유 lemma ${rows.length.toLocaleString()}`)
console.log(`전 연도 등장 ${rows.filter((r) => r.appears_every_year).length} · 1개년만 ${rows.filter((r) => r.years_n === 1).length}`)
console.log(`→ ${path.join(OUT_DIR, 'corpus.json')}`)
