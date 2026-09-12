// scripts/csat/test-listening-scripts.mjs
//
// **듣기 대본을 붙여 I3(한글 선택지엔 3점이 안 붙는다)의 교락을 부분적으로 푼다.**
//
// ── 문제 ────────────────────────────────────────────────────────────
// I3 은 13개년 179문항 예외 0 으로 아주 강하지만 **인과를 못 가른다** —
// 선택지 언어와 유형이 완전히 교락돼 있고, 같은 유형에서 언어가 바뀐 회차가 없다.
// "한글이라 쉽다" 와 "쉬운 걸 묻느라 한글로 냈다" 가 구분되지 않았다.
//
// ── 이 실험이 여는 것 ───────────────────────────────────────────────
// **듣기 안에서는 매체가 같다.** 전부 대화·담화이고 길이대도 비슷하다.
// 그런데 선택지 언어는 갈린다 — 목적·주제·의견·관계·이유·할일 등은 한글,
// 응답·상황말하기·지불금액·표·세트 등은 영어.
// 지문(대본)이 같은 종류인데 3점이 한쪽에만 붙는다면 언어 쪽 설명이 살아남는다.
//
// ── 사전 예측 (돌리기 전에 적는다) ──────────────────────────────────
//   3점이 **대본 난도** 때문이라면 → 영어 선택지 유형의 대본이 더 길거나 어려워야 한다.
//   대본이 비슷한데 3점만 갈린다면 → 난도는 대본이 아니라 **선택지 쪽**에서 온다.
//
// ⚠️ 완전한 인과 해소는 아니다. 유형은 여전히 언어와 붙어 있다.
//    다만 '지문이 어려워서' 라는 대안 설명 하나는 이걸로 검사할 수 있다.
//
// 자료: 수능 듣기평가 대본 PDF 7개년 (저장소 밖). 대본 원문은 커밋하지 않고 계측치만 남긴다.
//
// 실행: pnpm dlx tsx scripts/csat/test-listening-scripts.mjs <대본폴더>

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const SRC = process.argv[2] ?? path.join(
  'C:/Users/ADMINI~1/AppData/Local/Temp/claude/d--workspace-Vocaflow',
  '00503867-93d4-4990-a295-a90c882e90a4/scratchpad/listen',
)
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

/** 대본을 문항 번호로 자른다. `N. <한글 발문>` 다음이 영문 대본이다. */
function parseScript(text) {
  const lines = text.split('\n')
  const items = new Map()
  let cur = null
  for (const raw of lines) {
    const l = raw.trim()
    if (!l || /^={3,}|^-\s*\d+\s*-$|^\d{4}학년도|영어 영역 듣기평가/.test(l)) continue
    const m = l.match(/^\[?(\d{1,2})\s*[~～]?\s*(\d{1,2})?\]?\s*[.\]]\s*(.*)$/)
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 17) {
      cur = Number(m[1])
      if (!items.has(cur)) items.set(cur, [])
      const tail = m[3] ?? ''
      if (/[A-Za-z]{3,}/.test(tail) && !/[가-힣]/.test(tail)) items.get(cur).push(tail)
      continue
    }
    if (cur === null) continue
    if (/[가-힣]/.test(l) && !/^[MW]\s*:/.test(l)) continue // 한글 발문·주석은 버린다
    items.get(cur).push(l)
  }
  const out = new Map()
  for (const [no, arr] of items) {
    const t = arr.join(' ').replace(/\s+/g, ' ').replace(/^[MW]\s*:\s*/, '').trim()
    if ((t.match(/[A-Za-z]/g) ?? []).length > 60) out.set(no, t)
  }
  return out
}

const STOP = new Set(`a an the of to in on at by for with from into and or but if so is are was were be been am
it its their our your his her they we you he she i as do does did have has has had not no can could will would
this that these those there here what which who when where why how all any too very just`.split(/\s+/))
const words = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? [])
const contentW = (s) => words(s).filter((w) => w.length > 3 && !STOP.has(w))

// ── 대본 읽기 ────────────────────────────────────────────────────────
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f.endsWith('.txt')) : []
if (!files.length) { console.log(`대본 텍스트가 없다: ${SRC}`); process.exit(0) }

const scripts = new Map() // exam -> Map(no -> text)
for (const f of files) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8')
  const m = text.match(/(\d{4})학년도/)
  const exam = m ? m[1] : path.basename(f, '.txt')
  const parsed = parseScript(text)
  if (parsed.size) scripts.set(exam, parsed)
}
console.log(`대본 ${scripts.size}개년: ${[...scripts.keys()].sort().join(' ')}`)
console.log(`  문항 파싱 ${[...scripts.values()].reduce((s, m) => s + m.size, 0)}개`)

// ── 문항 메타와 결합 ────────────────────────────────────────────────
const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))
const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const rows = []
for (const [exam, m] of scripts) {
  for (const [no, text] of m) {
    const q = classified.rows.find((r) => r.exam === exam && r.no === no)
    const a = key.get(`${exam}#${no}`)
    if (!q || !a) continue
    const lang = bp[q.type]?.constraints?.choice_lang ?? []
    const w = words(text), cw = contentW(text)
    const sents = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 5)
    rows.push({
      exam, no, type: q.type, points: a.points,
      hasKo: lang.includes('ko'),
      words: w.length,
      typeToken: new Set(cw).size / (cw.length || 1),
      longWords: w.filter((x) => x.length >= 8).length / (w.length || 1),
      sentLen: w.length / (sents.length || 1),
    })
  }
}

if (!rows.length) { console.log('결합된 문항이 없다 — 파서 확인 필요'); process.exit(0) }

const mean = (a, f) => a.reduce((s, r) => s + f(r), 0) / a.length
const ko = rows.filter((r) => r.hasKo), en = rows.filter((r) => !r.hasKo)
const p3 = (a) => `${a.filter((r) => r.points === 3).length}/${a.length}`

console.log('')
console.log('듣기 대본 계측 — 선택지 언어별 (매체·형식이 같은 집단 안 비교)')
console.log('─'.repeat(76))
console.log('  집단          문항   3점    대본 길이  어휘다양도  긴낱말비율  문장길이')
for (const [lab, g] of [['한글 선택지', ko], ['영어 선택지', en]]) {
  console.log(
    `  ${lab.padEnd(12)} ${String(g.length).padStart(3)}  ${p3(g).padStart(6)}` +
      `  ${mean(g, (r) => r.words).toFixed(0).padStart(7)}단어` +
      `  ${mean(g, (r) => r.typeToken).toFixed(3).padStart(7)}` +
      `  ${(100 * mean(g, (r) => r.longWords)).toFixed(1).padStart(7)}%` +
      `  ${mean(g, (r) => r.sentLen).toFixed(1).padStart(6)}`,
  )
}

console.log('')
console.log('  판정')
const dw = mean(en, (r) => r.words) - mean(ko, (r) => r.words)
const dl = 100 * (mean(en, (r) => r.longWords) - mean(ko, (r) => r.longWords))
const ds = mean(en, (r) => r.sentLen) - mean(ko, (r) => r.sentLen)
console.log(`    대본 길이 차 ${dw >= 0 ? '+' : ''}${dw.toFixed(0)}단어 · 긴낱말 ${dl >= 0 ? '+' : ''}${dl.toFixed(1)}%p · 문장길이 ${ds >= 0 ? '+' : ''}${ds.toFixed(1)}`)
const harder = dw > 20 || dl > 2 || ds > 2
if (harder) {
  console.log('    → 영어 선택지 유형의 **대본이 실제로 더 어렵다.** 3점이 대본 난도에서 올 수 있다.')
  console.log('      I3 의 인과 해석("선택지 언어가 측정 범위를 정한다")이 약해진다.')
} else {
  console.log('    → 대본은 두 집단이 **비슷하다.** 그런데 3점은 영어 선택지에만 붙는다.')
  console.log('      난도가 지문이 아니라 **선택지 쪽**에서 온다는 해석이 살아남는다.')
}

fs.writeFileSync(path.join(OUT_DIR, 'listening-scripts.json'), JSON.stringify({
  exams: [...scripts.keys()], n: rows.length,
  ko: { n: ko.length, three: ko.filter((r) => r.points === 3).length, words: mean(ko, (r) => r.words), longWords: mean(ko, (r) => r.longWords), sentLen: mean(ko, (r) => r.sentLen) },
  en: { n: en.length, three: en.filter((r) => r.points === 3).length, words: mean(en, (r) => r.words), longWords: mean(en, (r) => r.longWords), sentLen: mean(en, (r) => r.sentLen) },
  note: '대본 원문은 저장하지 않는다. 계측치만 남긴다.',
}, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'listening-scripts.json')}`)
