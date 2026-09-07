// scripts/csat/verify-choice-rules.mjs
//
// **선지 층위의 규칙을 design-spec 과 같은 잣대로 세운다.** (§10.26)
//
// `design-spec.mjs` 는 **회차 구조**(배점·유형·자리)를 검사한다. 이 파일은 **선지**를 검사한다.
// 같은 세 관문을 통과해야 HARD 로 올린다 — ① 전 회차 위반 0 · ② 돌연변이가 잡힌다 · ③ 모평 홀드아웃.
//
// 왜 필요했나 — 2026-08-26 의 주제 오답 홀드아웃에서 나왔다(§10.26).
// 기출 지문 5편에 **수치를 안 보고** 주제 선지를 썼더니 사전 등록한 예측이 반증됐다
// (혼동도 대역 안 3/5, 네 측도 9/20 = 45%). 빗나간 **방향이 뒤집혔다** —
// v1~v4 는 너무 낮았는데(0.0135) 이번엔 너무 높다(0.1391).
// 뜯어보니 한 오답이 혼동도 **1.000** 이었다:
//   정답 'why small animals are more dangerous to hikers than large ones'
//   오답 'why large animals are more dangerous to hikers than small ones'
// **정답 문장 틀을 낱말 그대로 두고 방향만 뒤집었다.** 낱말 집합이 같으니 표면 유사도가 1.0 이다.
// 기출은 이것을 하지 않는다 — 그것이 아래 R2 다.
//
// ⚠️ 이 자는 **표면 겹침**만 잰다(§6.12 의 한계). "오답이 매력적인가" 를 재는 것이 아니라
//    "정답과 낱말이 얼마나 겹치는가" 를 잰다. R2 는 그 겹침의 **상한**에 대한 규칙이다.
//
// 실행: pnpm dlx tsx scripts/csat/verify-choice-rules.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pastItems, makeIdf, simWith, toks } from './check-choice-band.mjs'

const MOCK = new Set(['M2606', 'M2609', 'M2706'])
const past = pastItems()
const sim = simWith(makeIdf(past))

/** 선지 규칙. design-spec 의 E/I 규칙과 같은 모양 — check 가 false 면 위반. */
export const CHOICE_RULES = [
  {
    id: 'C1',
    grade: 'HARD',
    name: '어떤 오답도 정답과 어휘가 통째로 겹치지 않는다 (혼동도 < 0.50)',
    why: '정답 문장 틀을 그대로 두고 방향만 뒤집은 오답을 기출은 쓰지 않는다. '
      + '수능 14회차 오답 304개 최대 0.424 · 모평 3회차 60개 최대 0.179.',
    check: (it) => {
      const key = it.choices[it.k]
      return it.choices.every((c, i) => i === it.k || sim(key, c) < 0.50)
    },
  },
]

/** 지문 낱말 되쓰기 — **규칙이 아니라 대역**이다. 모평에서 예외가 나왔다. */
export function reuseBands() {
  const reuse = (p, c) => { const P = new Set(toks(p)); const C = toks(c); return C.length ? C.filter((w) => P.has(w)).length / C.length : 0 }
  const q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s[Math.floor(x * (s.length - 1))] }
  const out = {}
  for (const t of ['R-TOPIC', 'R-TITLE', 'R-BLANK']) {
    const xs = past.filter((i) => i.type === t)
    if (!xs.length) continue
    const key = xs.map((x) => reuse(x.passage, x.choices[x.k]))
    const dis = xs.flatMap((x) => x.choices.filter((_, i) => i !== x.k).map((c) => reuse(x.passage, c)))
    out[t] = {
      key: { lo: q(key, 0.1), mid: q(key, 0.5), hi: q(key, 0.9) },
      dis: { lo: q(dis, 0.1), mid: q(dis, 0.5), hi: q(dis, 0.9) },
      n: xs.length,
    }
  }
  return out
}

const run = (items) => {
  const bad = []
  for (const it of items) for (const r of CHOICE_RULES) if (!r.check(it)) bad.push({ exam: it.exam, no: it.no, rule: r.id })
  return bad
}

// CLI 는 진입점일 때만 — 이 파일은 fit-choice-band.mjs 가 CHOICE_RULES 를 임포트한다
if (Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('선지 규칙 검증 — design-spec 과 같은 세 관문')
  console.log('='.repeat(78))
  console.log(`  기출 ${past.length}문항 (빈칸·주제·제목) · 오답 ${past.reduce((s, x) => s + x.choices.length - 1, 0)}개`)
  console.log('')

  // ① 전 회차 위반 0
  const all = run(past)
  console.log('  ① 전 회차 검사')
  for (const r of CHOICE_RULES) {
    const v = all.filter((b) => b.rule === r.id)
    console.log(`     ${r.id} ${r.name}`)
    console.log(`        위반 ${v.length}건${v.length ? ` — ${v.map((b) => `${b.exam} ${b.no}번`).join(' · ')}` : ' **통과**'}`)
  }

  // ② 돌연변이 — 규칙을 어기는 입력을 만들어 잡히는지 본다
  console.log('')
  console.log('  ② 돌연변이 — 규칙을 어기는 입력이 실제로 잡히는가')
  let caught = 0
  for (const r of CHOICE_RULES) {
    // C1 을 어기는 입력: 정답 문장의 낱말 순서만 바꾼 오답을 ① 자리에 넣는다
    const base = past.find((x) => x.type === 'R-TOPIC')
    const key = base.choices[base.k]
    const flipped = key.split(' ').reverse().join(' ')   // 낱말 집합은 같고 순서만 다르다 → 유사도 1.0
    const mutant = { ...base, choices: base.choices.map((c, i) => (i === 0 ? flipped : c)) }
    const ok = !r.check(mutant)
    if (ok) caught += 1
    console.log(`     ${r.id}  ${ok ? '**잡힌다**' : '✗ 못 잡는다'}  (정답 낱말을 그대로 뒤집은 오답 → 혼동도 ${sim(key, flipped).toFixed(3)})`)
  }
  console.log(`     ${caught}/${CHOICE_RULES.length} — "위반 0" 이 공허하지 않다.`)

  // ③ 모평 홀드아웃 — 규칙 도출에 안 쓴 회차
  console.log('')
  console.log('  ③ 모평 홀드아웃 (규칙 도출에 안 쓴 3회차)')
  const holdout = past.filter((x) => MOCK.has(x.exam))
  const hv = run(holdout)
  console.log(`     ${holdout.length}문항 · 오답 ${holdout.reduce((s, x) => s + x.choices.length - 1, 0)}개 — 위반 ${hv.length}건 ${hv.length ? '✗' : '**통과**'}`)

  // 대역(규칙 아님) — 되쓰기는 모평에서 예외가 나왔다
  console.log('')
  console.log('  참고 — 지문 낱말 되쓰기는 **규칙이 아니라 대역**이다')
  console.log('  ' + '-'.repeat(74))
  const RB = reuseBands()
  console.log('  유형     정답 10~50~90        오답 10~50~90')
  for (const [t, b] of Object.entries(RB)) {
    const f = (x) => `${x.lo.toFixed(2)}~**${x.mid.toFixed(2)}**~${x.hi.toFixed(2)}`
    console.log(`  ${t.replace('R-', '').padEnd(8)} ${f(b.key).padEnd(20)} ${f(b.dis)}`)
  }
  console.log('  ⚠️ "되쓰기 < 0.85" 를 규칙으로 세우려 했으나 **모평에서 4건 예외**가 나왔다(최대 1.000).')
  console.log('     그래서 규칙이 아니라 대역으로 둔다 — 기출도 가끔 지문 문장을 통째로 옮긴다.')

  const DIR = path.resolve('scripts/csat/data')
  fs.writeFileSync(path.join(DIR, 'choice-rules-verify.json'), JSON.stringify({ n: past.length, violations: all, holdout: hv, mutationCaught: caught, reuseBands: RB }, null, 1))
  console.log(`\n→ ${path.join(DIR, 'choice-rules-verify.json')}`)

}
