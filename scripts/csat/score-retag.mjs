// scripts/csat/score-retag.mjs
//
// **재태깅 일치율 채점 — 읽기 전용.**
//
// 두 층을 따로 채점한다.
//   층A 문항 → 유형(43종)  : 발문이 거의 결정론적이라 **높게 나와야 정상**이다.
//                           낮으면 유형 경계 정의가 흔들린다는 뜻이고, 유형을 쓰는
//                           모든 계측(3점률·배분 이동·①-회피 범위)이 같이 흔들린다.
//   층B 유형 → 개념(6종)   : 여기가 실제 판단이다. 낮게 나오는 것이 오히려 정상이고,
//                           **낮으면 개념 기반 주장(§3.7 개념별 무게)만** 흔들린다.
//
// ⚠️ 일치율만 보면 안 된다. 우연 일치를 뺀 **Cohen's kappa** 를 함께 낸다 —
//    한 유형이 표본의 절반이면 아무렇게나 찍어도 일치율이 높게 나온다.
// ⚠️ 불일치가 **어느 주장을 건드리는지** 까지 봐야 결론이 난다. 그래서 §3 에서
//    ①-회피 14유형 경계와 한글 선택지 경계가 재태깅으로 바뀌는지 직접 확인한다.
//
// 실행: pnpm dlx tsx scripts/csat/score-retag.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const P = (f) => path.join(OUT_DIR, f)
const R = (f) => JSON.parse(fs.readFileSync(P(f), 'utf8'))
const has = (f) => fs.existsSync(P(f))

if (!has('retag-layerA-result.json') && !has('retag-layerB-result.json')) {
  console.log('재태깅 결과 파일이 아직 없다. 다른 세션의 산출을 기다린다.')
  process.exit(0)
}

const truth = R('retag-truth.json')

/** Cohen's kappa — 우연 일치를 뺀 일치도 */
function kappa(pairs) {
  const n = pairs.length
  if (!n) return NaN
  const po = pairs.filter(([a, b]) => a === b).length / n
  const cats = [...new Set(pairs.flat())]
  let pe = 0
  for (const c of cats) {
    const pa = pairs.filter(([a]) => a === c).length / n
    const pb = pairs.filter(([, b]) => b === c).length / n
    pe += pa * pb
  }
  return pe === 1 ? 1 : (po - pe) / (1 - pe)
}
const grade = (k) =>
  k >= 0.81 ? '거의 완전 일치' : k >= 0.61 ? '상당한 일치' : k >= 0.41 ? '보통' : k >= 0.21 ? '약함' : '거의 없음'

const out = {}

// ── 층A ──────────────────────────────────────────────────────────────
if (has('retag-layerA-result.json')) {
  const mine = truth.layerA
  const theirs = R('retag-layerA-result.json')
  const ids = Object.keys(mine)
  const missing = ids.filter((i) => !theirs[i])
  const pairs = ids.filter((i) => theirs[i]).map((i) => [mine[i], theirs[i]])
  const agree = pairs.filter(([a, b]) => a === b).length
  const k = kappa(pairs)
  console.log('층A  문항 → 유형(43종)')
  console.log('─'.repeat(72))
  console.log(`  채점 ${pairs.length}/${ids.length}${missing.length ? ` · 미제출 ${missing.length}` : ''}`)
  console.log(`  일치 ${agree}/${pairs.length} = ${(100 * agree / pairs.length).toFixed(1)}%`)
  console.log(`  Cohen's kappa = ${k.toFixed(3)}  (${grade(k)})`)
  const diffs = ids.filter((i) => theirs[i] && theirs[i] !== mine[i])
  if (diffs.length) {
    console.log(`  불일치 ${diffs.length}건:`)
    for (const i of diffs) console.log(`    ${i.padEnd(10)} 내 판정 ${mine[i].padEnd(14)} vs 재태깅 ${theirs[i]}`)
  }
  out.layerA = { n: pairs.length, agree, rate: agree / pairs.length, kappa: k, diffs: diffs.map((i) => ({ id: i, mine: mine[i], theirs: theirs[i] })) }
}

// ── 층B ──────────────────────────────────────────────────────────────
if (has('retag-layerB-result.json')) {
  const mine = truth.layerB
  const theirs = R('retag-layerB-result.json')
  const codes = Object.keys(mine)
  const pairs = codes.filter((c) => theirs[c]).map((c) => [mine[c], theirs[c]])
  const agree = pairs.filter(([a, b]) => a === b).length
  const k = kappa(pairs)
  console.log('')
  console.log('층B  유형 → 개념(6종)')
  console.log('─'.repeat(72))
  console.log(`  채점 ${pairs.length}/${codes.length}`)
  console.log(`  일치 ${agree}/${pairs.length} = ${(100 * agree / pairs.length).toFixed(1)}%`)
  console.log(`  Cohen's kappa = ${k.toFixed(3)}  (${grade(k)})`)
  const diffs = codes.filter((c) => theirs[c] && theirs[c] !== mine[c])
  if (diffs.length) {
    console.log(`  불일치 ${diffs.length}건:`)
    for (const c of diffs) console.log(`    ${c.padEnd(14)} 내 판정 ${mine[c]} vs 재태깅 ${theirs[c]}`)
  }
  out.layerB = { n: pairs.length, agree, rate: agree / pairs.length, kappa: k, diffs: diffs.map((c) => ({ type: c, mine: mine[c], theirs: theirs[c] })) }
}

// ── 불일치가 어느 주장을 건드리는가 ──────────────────────────────────
if (has('retag-layerA-result.json')) {
  const SEQ = new Set(['R-GRAMMAR', 'R-VOCAB', 'R-IRRELEVANT', 'X-VOCAB', 'X-REFER', 'R-REFER', 'R-INSERT',
    'R-FACT', 'X-FACT', 'R-NOTICE', 'R-CHART', 'L-NOTMENTION', 'L-SET-NOT', 'L-ANNOUNCE'])
  const mine = truth.layerA
  const theirs = R('retag-layerA-result.json')
  const crossed = Object.keys(mine).filter((i) => theirs[i] && SEQ.has(mine[i]) !== SEQ.has(theirs[i]))
  console.log('')
  console.log('불일치가 살아남은 주장을 건드리는가')
  console.log('─'.repeat(72))
  console.log(`  ①-회피 경계(순서 대응 14유형)를 넘나든 문항  ${crossed.length}건`)
  for (const i of crossed) console.log(`    ${i} : ${mine[i]}(${SEQ.has(mine[i]) ? '대응' : '비대응'}) vs ${theirs[i]}(${SEQ.has(theirs[i]) ? '대응' : '비대응'})`)
  console.log(`  → ${crossed.length === 0 ? '①-회피는 재태깅에 영향받지 않는다.' : '경계가 흔들린다 — 해당 문항의 정답 번호를 확인할 것.'}`)
  out.boundaryCrossings = crossed
}

fs.writeFileSync(P('retag-score.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${P('retag-score.json')}`)
