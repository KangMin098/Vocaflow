// scripts/csat/export-vocab-blind.mjs
//
// **어휘(30번)의 치환 성격 — 초안이 "반의어 치환" 이라 했고 아무도 안 봤다.**
//
// 실측 H4 가 확인한 것은 **자리**뿐이다(④⑤ 77%). **무엇을 무엇으로 바꿨는지**는
// 이 저장소가 한 번도 재 본 적이 없다. 어휘 유형은 선지가 지문 속 밑줄이라
// §6.15 의 추상도 자를 못 쓴다 — 다른 자가 필요하다.
//
// 어휘 문항은 두 형식이다:
//   **네모형**(4문항 · 2014A~2017) — `(A) frequently / rarely` 처럼 **치환 쌍이 지면에 인쇄된다.**
//     판단이 필요 없다. `score-vocab-blind.mjs` 가 그대로 읽어 센다.
//   **밑줄형**(13문항 · 2018~) — 표시어만 있고 **올바른 낱말은 안 보인다.** 판독이 필요하다.
//
// 이 파일은 **밑줄형만** 뽑는다.
//
// **맹검.** 정답 번호는 청크에 쓰지 않는다(KEY.json 으로 격리).
// 표시어 다섯 각각에 대해 두 값을 매긴다 — 자료 보기 전에 고정한 규칙표다:
//   contextFit  1~5  이 낱말이 문맥에 맞는가
//   antonymFits true/false  **이 낱말을 반의어로 바꾸면 문맥이 나아지는가**
//
// 두 번째가 이 배치의 요점이다. 초안이 맞다면 **정답 낱말에서만 참**이어야 하고,
// 오답 넷에서 참인 비율이 곧 **실측 기저**다(가정하지 않는다).
// 첫 번째는 대조 항목 — 내 판독이 문항을 실제로 풀 수 있는지 본다.
//
// **재실행 안전.** 이미 채운 문항은 다시 뽑지 않는다.
//
// 실행: pnpm dlx tsx scripts/csat/export-vocab-blind.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, answerOf, allRows } from './lib-passage.mjs'

const WORK = path.resolve('scripts/csat/vocab-blind')
const PER = 7
fs.mkdirSync(WORK, { recursive: true })

const BOX = /\(([ABC])\)\s*([A-Za-z][A-Za-z-]*)\s*\/\s*([A-Za-z][A-Za-z-]*)/g
const MARK = /([①②③④⑤])\s*([A-Za-z][A-Za-z-]*)/g

const under = []
const boxed = []
for (const r of allRows()) {
  if (r.type !== 'R-VOCAB') continue
  const a = answerOf(r.exam, r.no)
  if (!a || a.answer < 1 || a.answer > 5) continue
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const t = b.join(' ').replace(/\s+/g, ' ').replace(/\[\s*3\s*점\s*\]/g, '').trim()
  const pairs = [...t.matchAll(BOX)]
  if (pairs.length >= 2) {
    boxed.push({ id: `${r.exam}#${r.no}`, answer: a.answer, points: a.points, pairs: pairs.map((m) => ({ slot: m[1], a: m[2], b: m[3] })) })
    continue
  }
  const words = [...t.matchAll(MARK)].map((m) => m[2])
  if (words.length !== 5) continue
  under.push({
    id: `${r.exam}#${r.no}`,
    passage: t.replace(/^\d{1,2}\.\s*다음[^?]*\?\s*/, '').trim(),
    words: words.map((w, i) => ({ marker: '①②③④⑤'[i], word: w })),
    _key: { answer: a.answer, points: a.points },
  })
}

// 네모형은 판단이 필요 없으므로 그대로 저장한다 — 채점기가 읽는다
fs.writeFileSync(path.join(WORK, 'BOXED.json'), JSON.stringify({ items: boxed }, null, 1))
fs.writeFileSync(path.join(WORK, 'KEY.json'), JSON.stringify(Object.fromEntries(under.map((x) => [x.id, x._key])), null, 1))

const done = new Set()
for (const f of fs.readdirSync(WORK)) {
  if (!f.endsWith('.out.json')) continue
  for (const row of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items ?? []) done.add(row.id)
}
const todo = under.filter((x) => !done.has(x.id))

const RUBRIC = {
  note: '자료를 보기 전에 고정한 규칙표. 표시어 다섯 각각에 두 값을 매긴다. 정답이 무엇인지 모르는 채로 매겨야 한다.',
  contextFit: '1~5. 이 낱말이 문맥에 맞는가. 1 = 문맥과 정면으로 어긋난다. 3 = 어색하지만 읽힌다. 5 = 자연스럽다. (대조 항목 — 내 판독이 문항을 실제로 풀 수 있는지 본다)',
  antonymFits: 'true/false. **이 낱말을 반의어로 바꾸면 문맥이 나아지는가.** 형태가 닮은 다른 낱말(effect/affect 류)이나 무관한 낱말로 바꿔야 나아지는 경우는 false 다. 낱말이 이미 맞으면 false.',
}

const chunks = []
for (let i = 0; i < todo.length; i += PER) chunks.push(todo.slice(i, i + PER))
chunks.forEach((c, i) => {
  fs.writeFileSync(path.join(WORK, `chunk-${String(i).padStart(2, '0')}.json`), JSON.stringify({
    rubric: RUBRIC,
    fillInstruction: '각 words 원소에 contextFit(1~5) · antonymFits(true/false) 두 키를 더해 chunk-NN.out.json 으로 저장할 것.',
    items: c.map((x) => ({ id: x.id, passage: x.passage, words: x.words })),
  }, null, 1))
})

console.log('어휘 치환 판독 — 몫 뽑기')
console.log('='.repeat(70))
console.log(`  어휘 전체 ${under.length + boxed.length}문항 — 네모형 ${boxed.length}(판단 불필요) · 밑줄형 ${under.length}`)
console.log(`  이미 채운 것 ${done.size} · 이번에 뽑은 것 ${todo.length} · 청크 ${chunks.length}개`)
console.log(`  → ${WORK}`)
if (!todo.length) console.log('  → 남은 몫이 없다. score-vocab-blind.mjs 로 채점할 것.')
