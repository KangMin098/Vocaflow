// scripts/csat/test-h13-anaphora-type.mjs
//
// **H13 — 삽입의 지시어는 '낱말' 을 받는가 '명제' 를 받는가.**
//
// ── 왜 이 질문으로 왔나 ─────────────────────────────────────────────
// H12(지시어의 해소가 자리를 잠그는가)를 기계로 재려다 무너졌다.
// 9문항만 잡혔고 그중 5개가 '해소 자리 0' 이었다. 놓친 것들을 보니 이유가 하나였다:
//     `this problem` · `such a feeling` · `made this happen`
// **선행사가 낱말이 아니라 앞에서 서술된 명제**다. 어휘 일치로는 원리상 못 잡는다.
//
// 그렇다면 물어야 할 것이 바뀐다 — 해소가 되느냐가 아니라 **무엇을 받느냐**다.
//
//   구체 조응 (concrete)  `these dogs` → 앞에 나온 낱말 dogs 를 받는다. 어휘로 추적 가능
//   추상 조응 (abstract)  `this problem` → 앞에서 **서술된 상황**을 받는다. 어휘로 추적 불가
//
// ── 예측 ────────────────────────────────────────────────────────────
// 추상 조응이 지배적이라면, 이 저장소의 12개 가설이 전부 실패한 이유가 설명된다 —
// **가설이 전부 어휘 수준이었고, 제약은 명제 수준에 있었다.**
// 그리고 학습 처방도 갈린다: 어휘 추적 훈련은 구체 조응에서만 통한다.
//
// ⚠️ 판정은 의미 수준이라 기계로 못 한다. 여기서는 **후보를 뽑아 내가 읽고 분류**한다
//    (CLAUDE.md §🤖 — LLM 판단이 필요한 일은 Claude Code 가 직접 한다).
//    이 스크립트는 분류할 지시 표현 목록과 그 앞 문맥을 뽑는다.
//
// 실행: pnpm dlx tsx scripts/csat/test-h13-anaphora-type.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const COL_DIR = path.join(OUT_DIR, 'columns')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const cache = new Map()
const examLines = (e) => {
  if (!cache.has(e)) {
    const p = path.join(COL_DIR, `${e}.txt`)
    cache.set(e, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : null)
  }
  return cache.get(e)
}
function itemLines(exam, no) {
  const lines = examLines(exam)
  if (!lines) return null
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0 || j - i > 220) j = Math.min(i + 160, lines.length)
  return lines.slice(i, j)
}
const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()

// ⚠️ 1판의 파서 결함 셋을 고친다:
//   (a) `such as` 는 예시 표지지 조응이 아니다 — 반드시 제외
//   (b) `made this happen` 의 this 는 대명사고 happen 은 동사다 — 뒤가 명사여야 한다
//   (c) 대명사 단독(they/it)은 선행사 명사를 특정할 수 없어 따로 센다
const VERBS = new Set('happen happened be been become came come go went do does did make made take took give gave say said'.split(' '))
function anaphors(given) {
  const out = []
  for (const m of given.matchAll(/\b(this|these|those|such)\s+(?:a\s+|an\s+|the\s+)?([a-z]+)/gi)) {
    const det = m[1].toLowerCase(), head = m[2].toLowerCase()
    if (det === 'such' && head === 'as') continue            // (a)
    if (VERBS.has(head)) continue                             // (b)
    if (/^(is|are|was|were|will|would|can|could|may|might|must|has|have|had)$/.test(head)) continue
    out.push({ kind: 'dem', text: `${m[1]} ${m[2]}`, head })
  }
  const pm = given.match(/^\s*(They|Them|Their|It|Its|He|She|His|Her)\b/)
  if (pm) out.push({ kind: 'pro', text: pm[1], head: null })  // (c)
  return out
}

const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const items = []
let noAnaphor = 0, skipped = 0
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-INSERT')) {
  const L = itemLines(q.exam, q.no)
  if (!L) { skipped += 1; continue }
  const blocks = []; let cur = []
  for (const raw of L.slice(1)) { if (!raw.trim()) { if (cur.length) { blocks.push(cur); cur = [] } } else cur.push(raw) }
  if (cur.length) blocks.push(cur)
  const en = blocks.filter((b) => /[A-Za-z]{3,}/.test(b.join(' ')))
  if (en.length < 2) { skipped += 1; continue }
  const given = clean(en[0].join(' '))
  if (given.split(/\s+/).length < 6) { skipped += 1; continue }
  const an = anaphors(given)
  if (!an.length) { noAnaphor += 1; items.push({ id: `${q.exam}#${q.no}`, given, anaphors: [] }); continue }
  items.push({ id: `${q.exam}#${q.no}`, ans: key.get(`${q.exam}#${q.no}`)?.answer, given, anaphors: an })
}

console.log('H13  삽입 주어진 문장의 지시 표현 — 낱말을 받는가 명제를 받는가')
console.log('═'.repeat(78))
console.log(`  문항 ${items.length} (추출 실패 ${skipped}) · 지시 표현 없음 ${noAnaphor}`)
console.log('')
console.log('  아래를 읽고 각 지시 표현을 분류한다:')
console.log('    구체(C) — 앞에 나온 **낱말**을 받는다 (these dogs → dogs)')
console.log('    추상(A) — 앞에서 **서술된 상황·명제**를 받는다 (this problem → 앞 문장이 묘사한 문제)')
console.log('')
for (const it of items) {
  if (!it.anaphors.length) { console.log(`  ${it.id}  [지시 표현 없음]  ${it.given.slice(0, 62)}`); continue }
  console.log(`  ${it.id} (정답 ${it.ans})  ${it.anaphors.map((a) => `«${a.text}»`).join(' ')}`)
  console.log(`      ${it.given.slice(0, 96)}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'h13-anaphora.json'), JSON.stringify({ n: items.length, noAnaphor, items }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'h13-anaphora.json')}`)
