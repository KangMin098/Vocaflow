// scripts/csat/check-choice-band.mjs
//
// **선지 하나를 유형별 기출 대역에 대고 재는 자.** (§10.22)
//
// `check-passage-band.mjs` 가 지문에 해 주는 일을 **선지**에 한다.
//
// 왜 필요했나 — 2026-08-26 에 실제로 겪었다.
// §10.18 에서 "생성 오답의 혼동도 0.0155 vs 기출 0.0530(Holm 통과)" 을 격차로 보고했는데,
// 그것은 **세 유형을 합쳐 잰 값**이었다. 유형별로 가르니:
//   · 빈칸  기출 중앙 **0.0000** — 오답이 정답과 낱말을 안 겹치는 것이 **정상**이다.
//           내 것은 8/8 대역 안이었다. **멀쩡한 것을 결함으로 적었다.**
//   · 주제  기출 중앙 0.0807, 내 것 0.0134, 대역 안 1/4, Holm 0.0396 — **여기가 진짜 격차**
//   · 제목  기출 중앙 0.0758, 내 것 0.0289, 대역 안 2/4
// 고치겠다고 만든 v5 도 같은 이유로 반대편으로 넘어갔다 — 넘어간 것은 사실상 **빈칸 두 문항**
// (0.1939, 대역 상단 0.0900 의 두 배)이고 주제·제목은 각각 1/1 로 **잘 들어가 있었다.**
//
// **한 문장으로: 유형별 자를 안 만들고 합쳐 재면 멀쩡한 곳을 고치고 고칠 곳을 넘긴다.**
// 이 파일이 그 자다. 오답을 쓰는 동안 즉시 재서 대역 **안으로** 수렴시키기 위한 것이다.
//
// 측도는 §6.12 그대로 (IDF 가중 어휘 유사도):
//   · 접근성   accessibility      = sim(지문, 정답)
//   · 지문 미끼 distractorPassage = 평균 sim(지문, 오답)
//   · 미끼 격차 baitGap           = 지문 미끼 − 접근성
//   · 혼동도   confusion          = 평균 sim(정답, 오답)
//
// ⚠️ **IDF 는 기출 선지 + 재려는 문항의 선지**로 만든다. 작문 중에 쓰는 자이므로
//    다른 판(v1~v5)이 아직 없어도 돌아야 한다. `score-generated-bait.mjs` 는 채점용이라
//    기출+생성 전체를 합쳐 IDF 를 만든다 — 문서 455개에 5개를 더하는 차이라 값은 거의 같지만,
//    **두 스크립트의 수치를 섞어 인용하지 말 것.**
//
// ⚠️ 어휘 유사도는 **같은 뜻 다른 낱말**을 못 잡는다(§6.12 의 한계 그대로).
//    "오답이 매력적인가" 의 상한이 아니라 **표면 겹침**만 재는 자다.
//
// 실행:
//   pnpm dlx tsx scripts/csat/check-choice-band.mjs                      ← 유형별 대역표
//   pnpm dlx tsx scripts/csat/check-choice-band.mjs <문항JSON 또는 세트JSON>

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'

const STOP = new Set(('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
export const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

/** 선지 기반 측도를 낼 수 있는 유형 — ①~⑤ 가 실제 선택지인 것만.
 *  삽입·무관·순서는 ①~⑤ 가 지문 안의 **자리 표시**라 선지 유사도가 뜻을 갖지 않는다. */
export const CHOICE_TYPES = new Set(['R-BLANK', 'R-TOPIC', 'R-TITLE'])

/** 기출 문항 (선지 유형만) */
export function pastItems() {
  const out = []
  for (const r of allRows()) {
    if (!CHOICE_TYPES.has(r.type)) continue
    const b = itemBlocks(r.exam, r.no)[0]
    if (!b) continue
    const p = passageOf(b)
    const ch = choicesOf(b)
    const a = answerOf(r.exam, r.no)
    if (!p || p.length < 150 || !ch || ch.length !== 5 || !a) continue
    if (ch.some((c) => toks(c).length < 2)) continue
    out.push({ exam: r.exam, no: r.no, type: r.type, points: a.points, passage: p, choices: ch, k: a.answer - 1 })
  }
  return out
}

/** IDF 를 문항 목록에서 만든다 (문서 = 선지 하나) */
export function makeIdf(items) {
  const df = new Map()
  for (const it of items) for (const c of it.choices) for (const w of new Set(toks(c))) df.set(w, (df.get(w) ?? 0) + 1)
  const N = items.reduce((s, it) => s + it.choices.length, 0)
  return (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1
}

export function simWith(idf) {
  return (a, b) => {
    const A = new Set(toks(a))
    const B = new Set(toks(b))
    if (!A.size || !B.size) return 0
    let u = 0
    let i = 0
    for (const w of new Set([...A, ...B])) { const v = idf(w); u += v; if (A.has(w) && B.has(w)) i += v }
    return u ? i / u : 0
  }
}

/** 문항 하나의 네 측도 + 오답별 혼동도 */
export function choiceMetrics(it, idf) {
  const sim = simWith(idf)
  const key = it.choices[it.k]
  const per = it.choices.map((c, i) => (i === it.k ? null : { i: i + 1, conf: sim(key, c), pass: sim(it.passage, c) }))
  const dis = per.filter(Boolean)
  const accessibility = sim(it.passage, key)
  const distractorPassage = dis.reduce((s, d) => s + d.pass, 0) / dis.length
  return {
    accessibility,
    distractorPassage,
    baitGap: distractorPassage - accessibility,
    confusion: dis.reduce((s, d) => s + d.conf, 0) / dis.length,
    per,
  }
}

const AX = [
  { k: 'confusion', name: '혼동도 (정답↔오답)' },
  { k: 'distractorPassage', name: '지문 미끼 (지문↔오답)' },
  { k: 'accessibility', name: '접근성 (지문↔정답)' },
  { k: 'baitGap', name: '미끼 격차 (오답−정답)' },
]

/** 유형별 기출 대역 — 10 / 50 / 90 분위 */
export function choiceBands(past = pastItems()) {
  const idf = makeIdf(past)
  const rows = past.map((it) => ({ type: it.type, ...choiceMetrics(it, idf) }))
  const q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s[Math.floor(x * (s.length - 1))] }
  const out = {}
  for (const t of CHOICE_TYPES) {
    const xs = rows.filter((r) => r.type === t)
    if (xs.length < 8) continue
    out[t] = { n: xs.length }
    for (const a of AX) { const v = xs.map((r) => r[a.k]); out[t][a.k] = { lo: q(v, 0.1), mid: q(v, 0.5), hi: q(v, 0.9) } }
  }
  return out
}

// ── CLI ─────────────────────────────────────────────────────────────────────
// **임포트만 했을 때는 아무것도 하지 않는다.** 이 파일은 작문 루프에서 모듈로 불러 쓰는 자이므로
// 진입점일 때만 CLI 가 돌아야 한다 — 안 그러면 임포트하는 것만으로 choice-bands.json 을 덮어쓴다.
const ENTRY = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
const [, , fileArg] = process.argv
const MARK = ['①', '②', '③', '④', '⑤']

if (!ENTRY) {
  // 모듈로 쓰이는 중 — 내보낸 함수만 쓰게 두고 아무 일도 하지 않는다
} else if (!fileArg) {
  const past = pastItems()
  const B = choiceBands(past)
  console.log('유형별 기출 선지 대역 (10 ~ 50 ~ 90 분위)')
  console.log('='.repeat(84))
  console.log('유형       n    혼동도                  지문미끼                접근성')
  for (const [t, b] of Object.entries(B)) {
    const f = (k) => `${b[k].lo.toFixed(4)}~${b[k].mid.toFixed(4)}~${b[k].hi.toFixed(4)}`
    console.log(`${t.replace('R-', '').padEnd(10)}${String(b.n).padStart(3)}  ${f('confusion').padEnd(23)} ${f('distractorPassage').padEnd(23)} ${f('accessibility')}`)
  }
  console.log('')
  console.log('⚠️ **빈칸의 혼동도 중앙은 0.0000 이다.** 오답이 정답과 낱말을 안 겹치는 것이 기출의 정상값이고,')
  console.log('   그것을 "격차" 로 읽고 고치면 반대편으로 넘어간다 — 실제로 v5 에서 그렇게 됐다(§10.22).')
  const DIR = path.resolve('scripts/csat/data')
  fs.writeFileSync(path.join(DIR, 'choice-bands.json'), JSON.stringify(B, null, 1))
  console.log(`\n→ ${path.join(DIR, 'choice-bands.json')}`)
} else {
  const past = pastItems()
  const B = choiceBands(past)
  const j = JSON.parse(fs.readFileSync(fileArg, 'utf8'))
  const items = (j.items ?? [j]).filter((x) => CHOICE_TYPES.has(x.type))
  if (!items.length) { console.log('선지 측도를 낼 수 있는 문항이 없다 (빈칸·주제·제목만).'); process.exit(1) }

  console.log(`선지 대역 검사 — ${path.basename(fileArg)} · ${items.length}문항`)
  console.log('='.repeat(84))
  let okAll = 0
  let cntAll = 0
  for (const it of items) {
    const one = { type: it.type, passage: it.passage, choices: it.choices, k: it.answer - 1 }
    const idf = makeIdf([...past, one])
    const m = choiceMetrics(one, idf)
    const b = B[it.type]
    console.log('')
    console.log(`  ${it.no ?? '?'}번 ${it.type.replace('R-', '')} (기출 ${b.n}편)`)
    let ok = 0
    for (const a of AX) {
      if (!b[a.k]) continue
      const v = m[a.k]
      const inB = v >= b[a.k].lo && v <= b[a.k].hi
      if (inB) ok += 1
      cntAll += 1
      if (inB) okAll += 1
      const arrow = v < b[a.k].lo ? '↓ 낮다' : v > b[a.k].hi ? '↑ 높다' : ''
      console.log(`    ${a.name.padEnd(20)} ${v.toFixed(4)}   대역 ${b[a.k].lo.toFixed(4)} ~ ${b[a.k].hi.toFixed(4)} (중앙 ${b[a.k].mid.toFixed(4)})  ${inB ? '안' : '**밖**'} ${arrow}`)
    }
    console.log(`    오답별 혼동도: ${m.per.filter(Boolean).map((d) => `${MARK[d.i - 1]} ${d.conf.toFixed(3)}`).join('  ')}   (정답 ${MARK[it.answer - 1]})`)
    console.log(`    대역 안 ${ok}/4`)
    if (m.confusion < b.confusion.lo) console.log('      · 혼동도가 낮다 — 오답이 정답의 **핵심 명사·동사를 물게** 다시 쓴다(뜻은 틀리되 낱말은 겹치게)')
    if (m.confusion > b.confusion.hi) console.log('      · 혼동도가 높다 — 오답 다섯이 **같은 낱말을 돌려쓰고** 있다. 한둘만 물고 나머지는 다른 어휘로 푼다')
    if (m.distractorPassage < b.distractorPassage.lo) console.log('      · 지문 미끼가 낮다 — 오답에 **지문의 국소 어휘**를 심는다(§6.12 의 (a) 국소 어휘 미끼)')
    if (m.distractorPassage > b.distractorPassage.hi) console.log('      · 지문 미끼가 높다 — 오답이 지문을 너무 베꼈다. 지문에 없는 말로 바꾼다')
  }
  console.log('')
  console.log(`  전체 대역 안 **${okAll}/${cntAll}** = ${(okAll / cntAll * 100).toFixed(1)}%`)
}
