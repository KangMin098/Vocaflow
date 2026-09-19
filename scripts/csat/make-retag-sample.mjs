// scripts/csat/make-retag-sample.mjs
//
// **재태깅 일치율 검사용 표본을 뽑는다 — 읽기 전용.**
//
// 왜. 585문항의 해석자가 나(Claude)다. 기각 판정이 진짜 기각인지 태깅 노이즈인지
// 분리되지 않았다. 문맥 없는 다른 세션에 같은 일을 시켜 일치율을 잰다.
//
// 두 층을 따로 잰다 — 성격이 다르다.
//   층A 문항 → 유형(43종)   : 발문 문자열이 거의 결정론적이라 높게 나와야 정상.
//                            낮으면 유형 경계 정의 자체가 흔들린다는 뜻이다.
//   층B 유형 → 개념(6종)    : **여기가 진짜 내 판단이다.** 문항별 노이즈가 아니라
//                            체계적 편향이라, 60문항 재태깅으로는 안 잡히고
//                            매핑 자체를 독립 재구성해야 잡힌다.
//
// ⚠️ 표본은 고정 시드로 뽑는다. 돌릴 때마다 달라지면 일치율을 비교할 수 없다.
//
// 실행: pnpm dlx tsx scripts/csat/make-retag-sample.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const classified = R('classified.json')
const bp = Object.fromEntries(R('blueprint.json').blueprint.map((x) => [x.type, x]))
const concepts = R('curriculum-concepts.json').concepts

// 고정 시드 LCG — Math.random 을 쓰면 재현이 안 된다
let seed = 20260823
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }

const pool = classified.rows.filter((r) => r.exam !== '2014A' && r.stem && r.stem.length > 6)
const shuffled = [...pool]
for (let i = shuffled.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rnd() * (i + 1))
  ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
}
const sample = shuffled.slice(0, 60)

// 층A — 문항 목록(정답 라벨 없이) + 유형 카탈로그
const catalog = Object.values(bp)
  .map((x) => ({ code: x.type, name: x.name, section: x.section }))
  .sort((a, b) => a.code.localeCompare(b.code))

const layerA = {
  task: '아래 60개 문항 각각에 유형 코드 하나씩 배정하라. 코드는 catalog 에 있는 것만 쓴다.',
  catalog,
  items: sample.map((r) => ({ id: `${r.exam}#${r.no}`, no: r.no, stem: r.stem })),
}

// 층B — 개념 카탈로그 + 유형 목록(매핑 없이)
const layerB = {
  task: '43개 유형 각각을 2015 개정 영어과 읽기 성취기준 6개 중 하나에 배정하라. 각 유형은 정확히 하나에.',
  concepts: concepts.map((c) => ({ id: c.id, name: c.name })),
  types: catalog,
}

fs.writeFileSync(path.join(OUT_DIR, 'retag-layerA.json'), JSON.stringify(layerA, null, 1))
fs.writeFileSync(path.join(OUT_DIR, 'retag-layerB.json'), JSON.stringify(layerB, null, 1))

// 정답지(비교용) — 재태깅 세션에는 절대 주지 않는다
const truth = {
  layerA: Object.fromEntries(sample.map((r) => [`${r.exam}#${r.no}`, r.type])),
  layerB: Object.fromEntries(concepts.flatMap((c) => c.types.map((t) => [t, c.id]))),
}
fs.writeFileSync(path.join(OUT_DIR, 'retag-truth.json'), JSON.stringify(truth, null, 1))

console.log(`층A 문항 ${sample.length}개 · 유형 카탈로그 ${catalog.length}종`)
console.log(`층B 유형 ${catalog.length}종 → 개념 ${concepts.length}종`)
console.log(`  회차 분포: ${[...new Set(sample.map((r) => r.exam))].sort().join(' ')}`)
console.log(`  유형 분포: ${new Set(sample.map((r) => r.type)).size}종`)
console.log(`\n→ retag-layerA.json · retag-layerB.json · retag-truth.json (정답지는 재태깅 세션에 주지 말 것)`)
