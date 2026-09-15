// scripts/csat/test-p35-grammar-pool.mjs
//
// **P3.5 재검 — "어법 밑줄은 문법 풀 10종 안에 100% 든다" 는 반증 가능한가.**
//
// 대장에 이렇게 적혀 있었다: *"밑줄 65개 100% 풀 안 — 그러나 풀을 사후에 정의했으므로
// 반증 불가 위험(G3). 재검 필요"*. 그 걱정을 두 갈래로 푼다.
//
// **갈래 1 — 안 쓰이는 칸이 있는가.**
//   표는 **10칸으로 선언**돼 있다. 항진명제라면 열 칸이 골고루 걸려야 한다.
//   실제로 몇 칸이 한 번도 안 걸리는지 센다. 안 걸리는 칸이 있으면 표가 공허하지 않다.
//
// **갈래 2 — 홀드아웃.**
//   `verify-h3-h7.mjs` 는 **2014A 와 모평 3회차를 뺐다**(수능 13회차 65밑줄만 썼다).
//   그 **4문항 20밑줄**은 규칙표를 만들 때 한 번도 안 본 것이다.
//   **표를 한 글자도 고치지 않고** 그대로 걸어 본다.
//     · 100% 들어가면 → 사후 정의라는 걱정이 실제로는 문제가 아니었다는 증거
//     · 빠지는 것이 나오면 → **P3.5 는 그 자리에서 반증된다.** 표를 넓혀 덮지 않는다
//
// ⚠️ **이 파일은 grammar-pool.mjs 를 읽기만 한다.** 못 잡는 것이 나와도 표를 고치지 않는다 —
//    고치면 홀드아웃이 홀드아웃이 아니게 된다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p35-grammar-pool.mjs

import fs from 'node:fs'
import path from 'node:path'
import { POOL } from './grammar-pool.mjs'
import { itemBlocks, allRows, answerOf } from './lib-passage.mjs'
import { binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const DERIVED = new Set(['2014B', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'])
const MARKS = ['①', '②', '③', '④', '⑤']

/** 밑줄 뒤 구간을 뽑는다 — verify-h3-h7 과 같은 방식(마커에서 다음 마커까지) */
function spansOf(exam, no) {
  const b = itemBlocks(exam, no)[0]
  if (!b) return null
  const body = b.join(' ').replace(/\s+/g, ' ')
  const out = []
  for (let n = 0; n < 5; n += 1) {
    const at = body.indexOf(MARKS[n])
    if (at < 0) return null
    const end = n === 4 ? Math.min(body.length, at + 90) : body.indexOf(MARKS[n + 1])
    out.push(body.slice(at + 1, end < 0 ? at + 90 : end).trim())
  }
  return out
}

const label = (span) => POOL.find(([, re]) => re.test(span))?.[0] ?? null

// 홀드아웃에서 정규식이 놓친 것을 **직접 읽어** 판정한 결과.
// 여기 적는 것은 "무엇이 무너졌는지" 를 가르기 위해서다 — 풀이 열린 것인지,
// 아니면 규칙표의 낱말 목록이 좁은 것인지. **정규식은 고치지 않는다.**
const HAND = {
  '2014A#27-3': { cat: 'G6 형용사·부사', why: 'This sounds ③ unfair — 보어 자리 형용사' },
  '2014A#27-5': { cat: 'G1 준동사 vs 정동사', why: 'make us ⑤ pay — 사역동사 뒤 원형부정사' },
  'M2606#29-2': { cat: 'G6 형용사·부사', why: 'make … more ② real — 목적격 보어 형용사' },
  'M2606#29-3': { cat: 'G1 준동사 vs 정동사', why: 'easier for us ③ perceive — to부정사 자리' },
  'M2609#29-3': { cat: 'G6 형용사·부사', why: 'find … too ③ strong — 목적격 보어 형용사' },
  'M2609#29-4': { cat: 'G3 수일치', why: 'retailers, who ④ feel — 선행사 복수' },
}

const groups = { derived: [], holdout: [] }
for (const r of allRows()) {
  if (r.type !== 'R-GRAMMAR') continue
  const sp = spansOf(r.exam, r.no)
  if (!sp) continue
  const a = answerOf(r.exam, r.no)
  const g = DERIVED.has(r.exam) ? 'derived' : 'holdout'
  sp.forEach((s, i) => groups[g].push({ exam: r.exam, no: r.no, n: i + 1, span: s, isAnswer: a && a.answer === i + 1, label: label(s) }))
}

console.log('P3.5 재검 — 문법 풀 10종이 반증 가능한가')
console.log('='.repeat(78))
console.log(`  도출 집합 ${groups.derived.length}밑줄 · **홀드아웃 ${groups.holdout.length}밑줄**(2014A + 모평 3 — 표를 만들 때 안 본 것)`)
console.log('')

console.log('  갈래 1 — 열 칸 중 몇 칸이 실제로 걸리는가')
console.log('  ' + '-'.repeat(74))
const all = [...groups.derived, ...groups.holdout]
const used = {}
for (const [name] of POOL) used[name] = 0
for (const x of all) if (x.label) used[x.label] += 1
for (const [name] of POOL) {
  const v = used[name]
  console.log(`    ${name.padEnd(22)} ${String(v).padStart(3)}  ${v ? '█'.repeat(Math.min(30, v)) : '— 한 번도 안 걸린다'}`)
}
const dead = POOL.filter(([n]) => !used[n]).map(([n]) => n)
console.log('')
console.log(`    쓰이는 칸 ${POOL.length - dead.length}/${POOL.length} · **안 쓰이는 칸 ${dead.length}**`)
console.log(`    ${dead.length ? '✓ 표가 공허하지 않다 — 걸릴 수 있는데 안 걸리는 칸이 있다' : '✗ 열 칸이 모두 걸린다 — 항진명제 의심'}`)

console.log('')
console.log('  갈래 2 — 홀드아웃 (표를 한 글자도 안 고쳤다)')
console.log('  ' + '-'.repeat(74))
for (const g of ['derived', 'holdout']) {
  const xs = groups[g]
  const hit = xs.filter((x) => x.label).length
  console.log(`    ${g === 'derived' ? '도출 집합' : '홀드아웃 '} ${hit}/${xs.length} = ${(100 * hit / xs.length).toFixed(1)}%`)
}
const miss = groups.holdout.filter((x) => !x.label)
if (miss.length) {
  console.log('')
  console.log(`    ⚠️ **정규식 기준으로 풀 밖에 떨어진 밑줄 ${miss.length}개 — 도출 집합의 100% 는 여기서 무너진다.**`)
  for (const m of miss) console.log(`      ${m.exam}#${m.no}-${m.n}${m.isAnswer ? '(정답)' : ''}  ${m.span.slice(0, 70)}`)
  console.log('    표를 넓혀 덮지 않는다. 이것이 홀드아웃의 뜻이다.')
  console.log('')
  console.log('    여섯 개를 **직접 읽었다** — 무엇이 무너진 것인지 가른다')
  console.log('    ' + '-'.repeat(70))
  for (const m of miss) {
    const h = HAND[`${m.exam}#${m.no}-${m.n}`]
    console.log(`      ${(`${m.exam}#${m.no}-${m.n}`).padEnd(12)} ${h ? h.cat.padEnd(18) : '?'.padEnd(18)} ${h ? h.why : ''}`)
  }
  const inPool = miss.every((m) => HAND[`${m.exam}#${m.no}-${m.n}`])
  console.log('')
  console.log(`      → ${inPool ? '**여섯 개 모두 이미 쓰이는 범주 안이다.** 무너진 것은 풀이 아니라 **정규식의 닫힌 낱말 목록**이다.' : '풀 밖의 포인트가 실제로 있다.'}`)
} else {
  console.log('')
  console.log('    ✓ **홀드아웃 20밑줄 전부 풀 안이다.** 사후 정의라는 걱정이 실제 문제는 아니었다.')
}

console.log('')
console.log('  홀드아웃 분류 내역')
console.log('  ' + '-'.repeat(74))
for (const x of groups.holdout) {
  console.log(`    ${x.exam.padEnd(6)}#${x.no}-${x.n}${x.isAnswer ? '*' : ' '} ${(x.label ?? '**미분류**').padEnd(22)} ${x.span.slice(0, 44)}`)
}

// 안 쓰이는 칸의 부재가 우연인가 — 쓰인 칸의 최소 빈도를 기저로 삼아 거칠게 본다
console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
const usedCnt = POOL.map(([n]) => used[n]).filter((v) => v > 0)
const minUsed = Math.min(...usedCnt)
const pIfLikeMin = binomUpper(all.length, 1, minUsed / all.length)
console.log(`    · **홀드아웃 정확도 70%.** 도출 집합의 100% 는 **실패한 낱말을 목록에 넣어 만든 값**이다
      (verify-h3-h7.mjs 주석이 그 과정을 스스로 적어 두었다). 즉 100% 는 애초에 증거가 아니었다.
    · 다만 **풀 자체는 안 무너졌다** — 빠진 여섯이 전부 이미 쓰이는 6종 안이다(손판정).
      P3.5 를 지지하는 것은 정규식이 아니라 **사람의 판독**이다. 그렇게 적어야 한다.
    · 가장 드물게 쓰인 칸도 ${minUsed}/${all.length} 는 걸린다.`)
console.log(`      죽은 칸 ${dead.length}개가 그 정도 빈도였다면 한 번이라도 걸릴 확률 ${(pIfLikeMin * 100).toFixed(1)}% —`)
console.log(`      ${dead.length}칸이 모두 0 이라 **표는 항진명제가 아니다** — 반증 가능성은 확보됐다.`)
console.log('      ⚠️ 그러나 **그 네 종이 실제로 출제되지 않는다고는 말할 수 없다.**')
console.log('      정규식이 그 포인트가 밑줄 잡히는 **표면 형태**를 못 맞출 수 있다 —')
console.log('      병렬은 접속사가 아니라 둘째 요소에 밑줄이 가고, 태는 분사만 밑줄 잡힐 수 있다.')
console.log('      **죽은 칸은 도구의 한계와 출제의 부재를 구분하지 못한다.**')
if (!miss.length) console.log('    · 홀드아웃 100% — P3.5 를 SOFT 로 유지하되 "재검 필요" 는 해소한다.')

fs.writeFileSync(path.join(DIR, 'p35-grammar-pool.json'), JSON.stringify({
  derived: groups.derived.length, holdout: groups.holdout.length,
  used, dead, holdoutMiss: miss.map((m) => ({ id: `${m.exam}#${m.no}-${m.n}`, span: m.span })),
  holdoutRows: groups.holdout,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'p35-grammar-pool.json')}`)
