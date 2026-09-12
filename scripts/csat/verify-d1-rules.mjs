// scripts/csat/verify-d1-rules.mjs
//
// **D1(지문 선정)을 design-spec 과 같은 잣대로 시험한다.** (§10.33)
//
// ② 결정 커버리지에서 오래 비어 있던 칸이다. §10.29 에서 표본을 청소하고(84.4% 가 오염돼 있었다)
// §10.30 에서 대역 정의를 하나로 모은 뒤, **그 위에서** 다시 시도한 것이 이 파일이다.
//
// 세 관문은 design-spec / verify-choice-rules 와 같다 —
// ① 전 회차 위반 0 · ② 돌연변이가 잡힌다 · ③ 모평 홀드아웃.
//
// **결론을 먼저 적는다: D1 에는 비자명한 보편 규칙이 거의 없다.**
// 시도하고 떨어진 것들(청소된 논설문 코어 235편 · 수능 191 · 모평 44):
//
// | 후보 | 수능 위반 | 모평 위반 |
// |---|---|---|
// | 최빈어가 첫 또는 끝 문장에 | 32 | 7 |
// | 최빈어가 문장의 20% 이상에 | 4 | 0 |
// | 첫↔끝 문장 어휘 공유(수미상관) | 88 | 25 |
// | **인접 문장 사슬 안 끊김** | **164** | **42** |
// | 2회 이상 반복 내용어 ≥ 3개 | 3 | 0 |
// | 고유명사(유형) ≤ 3 | 21 | 7 |
// | 연도 표기 ≤ 1 | 1 | 2 |
//
// ⚠️ **초안 §1 의 "사슬 밀도" 가설은 기각된다.** 인접 문장 어휘 사슬이 한 번도 안 끊기는 지문은
//    **191편 중 27편(14%)** 이고, 끊긴 비율의 중앙값은 **43%** 다.
//    기출 지문은 어휘를 이어 붙여 고른 글이 **아니다.**
//
// ⭐ **대신 두괄식이 나왔다.** 최빈 내용어를 담은 문장의 자리를 기저(임의의 두 문장, 순열 20,000회)와 견주면:
//    · 첫 문장에 **67.7%** — **p < 0.0001, 기저보다 높다**
//    · 끝 문장에 48.3% — p=0.986, 구분 안 됨
//    · 수미상관 51.7% — p=0.809, 구분 안 됨
//    · "첫 **또는** 끝" 83.2% — p=0.066 → **합치면 지워진다**(P0.7 의 형제)
//    즉 **주제문은 앞에 온다. 뒤가 아니다.** 다만 67.7% 는 규칙이 아니라 **경향**이므로 SOFT 로 둔다.
//
// 아래 D1a·D1b 는 위반 0 을 통과한 둘이다. **둘 다 결속성의 최소 바닥**이고,
// "좋은 지문" 을 고르는 규칙이 아니라 **"글이 아닌 것을 걸러내는" 규칙**이다. 그 이상으로 읽지 말 것.
//
// 실행: pnpm dlx tsx scripts/csat/verify-d1-rules.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { itemBlocks, passageOf, allRows } from './lib-passage.mjs'
import { cleanPassage, looksInterleaved } from './clean-passage.mjs'

const MOCK = new Set(['M2606', 'M2609', 'M2706'])
/** D1(지문 선정)이 적용되는 논설문 코어. 편지(목적·심경)·도표·공지는 다른 재료다. */
export const CORE_TYPES = new Set(['R-TOPIC', 'R-TITLE', 'R-BLANK', 'R-ORDER', 'R-INSERT', 'R-IRRELEVANT', 'R-SUMMARY', 'R-GIST', 'R-CLAIM', 'R-IMPLY'])

const STOP = new Set('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once not no nor if while during'.split(' '))
const W = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
const stem = (w) => w.toLowerCase().replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
export const contentWords = (s) => W(s).map(stem).filter((w) => w.length > 2 && !STOP.has(w))
export const sentences = (s) => s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => W(x).length >= 3)

/** 지문 하나의 D1 측도 */
export function d1Metrics(p) {
  const ss = sentences(p)
  const cs = ss.map(contentWords)
  const all = cs.flat()
  const freq = new Map()
  for (const w of all) freq.set(w, (freq.get(w) ?? 0) + 1)
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]
  const uniq = new Set(all).size
  return {
    sents: ss.length,
    topWord: top?.[0],
    topCount: top?.[1] ?? 0,
    repeatedWords: [...freq.values()].filter((v) => v >= 2).length,
    repeatedRate: uniq ? [...freq.values()].filter((v) => v >= 2).length / uniq : 0,
    topInFirst: Boolean(top) && cs.length > 0 && cs[0].includes(top[0]),
  }
}

/** 세 관문을 통과한 D1 규칙. **결속성의 바닥**이지 품질 기준이 아니다. */
export const D1_RULES = [
  {
    id: 'D1a',
    grade: 'HARD',
    name: '지문은 내용어를 되풀이한다 (최빈 내용어 ≥ 2회)',
    why: '청소된 논설문 코어 235편 전부에서 최소 2회. 중앙값은 5회. '
      + '되풀이가 없는 글은 나열이지 논지가 아니다 — 그런 글은 대의파악 문항의 재료가 못 된다.',
    check: (m) => m.topCount >= 2,
  },
  {
    id: 'D1b',
    grade: 'HARD',
    name: '되풀이되는 내용어가 어휘의 3% 이상이다',
    why: '실측 최소 0.038 · 중앙 0.159. D1a 를 길이로 정규화한 것 — '
      + '긴 글에서 낱말 하나만 두 번 나오는 경우를 D1a 는 통과시키지만 이 규칙은 잡는다.',
    check: (m) => m.repeatedRate >= 0.03,
  },
]

export function corePassages() {
  const out = []
  for (const r of allRows()) {
    if (!CORE_TYPES.has(r.type)) continue
    const b = itemBlocks(r.exam, r.no)[0]
    if (!b) continue
    const p = cleanPassage(passageOf(b))
    if (!p || p.length < 150 || looksInterleaved(p)) continue
    const m = d1Metrics(p)
    if (m.sents < 2) continue
    out.push({ exam: r.exam, no: r.no, type: r.type, mock: MOCK.has(r.exam), passage: p, ...m })
  }
  return out
}

if (Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = corePassages()
  const D = rows.filter((r) => !r.mock)
  const M = rows.filter((r) => r.mock)
  console.log('D1(지문 선정) 규칙 검증 — design-spec 과 같은 세 관문')
  console.log('='.repeat(78))
  console.log(`  청소된 논설문 코어 ${rows.length}편 (수능14 ${D.length} · 모평3 ${M.length})`)
  console.log('')

  console.log('  ① 전 회차 검사')
  const viol = []
  for (const r of D1_RULES) {
    const v = rows.filter((x) => !r.check(x))
    viol.push(...v.map((x) => ({ exam: x.exam, no: x.no, rule: r.id })))
    console.log(`     ${r.id} ${r.name}`)
    console.log(`        위반 ${v.length}건${v.length ? ` — ${v.slice(0, 6).map((x) => `${x.exam} ${x.no}번`).join(' · ')}` : ' **통과**'}`)
  }

  console.log('')
  console.log('  ② 돌연변이 — 규칙을 어기는 입력이 실제로 잡히는가')
  // 되풀이가 없는 글 — 같은 지문에서 **반복 내용어를 전부 다른 낱말로 갈아 끼운 것**과 같다
  const listy = 'Mercury orbits quickly. Venus retains thick clouds. Earth supports diverse life. Mars shows rusty plains. Jupiter dwarfs every neighbour. Saturn wears bright rings.'
  let caught = 0
  for (const r of D1_RULES) {
    const m = d1Metrics(listy)
    const ok = !r.check(m)
    if (ok) caught += 1
    console.log(`     ${r.id}  ${ok ? '**잡힌다**' : '✗ 못 잡는다'}  (되풀이 없는 나열문 → 최빈 ${m.topCount}회 · 반복어 비율 ${m.repeatedRate.toFixed(3)})`)
  }
  console.log(`     ${caught}/${D1_RULES.length} — "위반 0" 이 공허하지 않다.`)

  console.log('')
  console.log('  ③ 모평 홀드아웃 (규칙 도출에 안 쓴 3회차)')
  const hv = M.filter((x) => !D1_RULES.every((r) => r.check(x)))
  console.log(`     ${M.length}편 — 위반 ${hv.length}건 ${hv.length ? '✗' : '**통과**'}`)

  console.log('')
  console.log('  ⚠️ 이 둘은 **결속성의 바닥**이지 "좋은 지문" 의 기준이 아니다.')
  console.log('     걸러내는 것은 "글이 아닌 것"(나열·목록)이고, 기출 지문의 선정 기준은 어휘 표면에 없다.')
  console.log(`     두괄식 경향: 최빈어가 첫 문장에 ${(D.filter((r) => r.topInFirst).length / D.length * 100).toFixed(1)}% (기저 대비 p<0.0001, §10.33) — **경향이지 규칙이 아니다.**`)

  const DIR = path.resolve('scripts/csat/data')
  fs.writeFileSync(path.join(DIR, 'd1-rules-verify.json'), JSON.stringify({ n: rows.length, nExam: D.length, nMock: M.length, violations: viol, mutationCaught: caught, holdout: hv.length, topInFirst: D.filter((r) => r.topInFirst).length / D.length }, null, 1))
  console.log(`\n→ ${path.join(DIR, 'd1-rules-verify.json')}`)
}
