// scripts/csat/checklist-exp/export.mjs
//
// **실험 2 표본 — 회차 8·10 판정이 끝난 원천에서 층화 추출해 눈가림 청크를 만든다(읽기 전용 · DB 0).**
//
// 정답은 이미 저장소에 있다: `scripts/csat/source-round/round-{8,10}/chunk-*.out.json`(전문 판정) · `.b.out.json`(이중 판정).
// 보관 판정이 93% 라 무작위로 뽑으면 폐기·보류가 몇 건 안 된다 → 판정값별로 정해진 수를 뽑고, 집계 때 모집단 비율로 되돌린다.
// 고르기는 `sha256(seed:id)` 순서 — 같은 seed 면 같은 표본(재실행 안전).
//
// 청크에는 **판정·why·slots 를 넣지 않는다**(눈가림). 정답은 `key.json` 에 따로 둔다.
// 청크는 본문 글자 수 `--budget`(기본 120,000자)으로 자른다 — 논문 한 편이 3만 자라 편수로 자르면 청크 크기가 열 배 갈린다.
//
// 실행: node scripts/csat/checklist-exp/export.mjs [--seed exp2] [--keep 100 --hold 40 --discard 60] [--budget 120000]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const SEED = arg('seed', 'exp2')
const WANT = { keep: Number(arg('keep', 100)), hold: Number(arg('hold', 40)), discard: Number(arg('discard', 60)) }
const BUDGET = Number(arg('budget', 120_000))
const ROUNDS = ['round-8', 'round-10']
const OUT = path.resolve('scripts/csat/checklist-exp/work')

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const pool = { keep: [], hold: [], discard: [] }
const population = { keep: 0, hold: 0, discard: 0 }

for (const r of ROUNDS) {
  const dir = path.resolve(`scripts/csat/source-round/${r}`)
  for (const f of fs.readdirSync(dir).filter((x) => /^chunk-.*[^b]\.out\.json$/.test(x) && !x.endsWith('.b.out.json'))) {
    const inputs = new Map(readJson(path.join(dir, f.replace('.out.json', '.json'))).map((x) => [x.id, x]))
    const bFile = path.join(dir, f.replace('.out.json', '.b.out.json'))
    const second = fs.existsSync(bFile) ? new Map(readJson(bFile).map((x) => [x.id, x.retention])) : new Map()
    for (const o of readJson(path.join(dir, f))) {
      const inp = inputs.get(o.id)
      if (!inp || !pool[o.retention]) continue
      population[o.retention]++
      pool[o.retention].push({ inp, truth: o, second: second.get(o.id) ?? null, round: r })
    }
  }
}

const order = (id) => crypto.createHash('sha256').update(`${SEED}:${id}`).digest('hex')
const picked = Object.entries(WANT).flatMap(([v, n]) =>
  pool[v].sort((a, b) => order(a.inp.id).localeCompare(order(b.inp.id))).slice(0, n)
)
// 청크 안에서 판정값이 몰리지 않게 섞는다 — 판정자가 「이 청크는 폐기 모음」 이라고 눈치채지 않도록.
picked.sort((a, b) => order(`mix:${a.inp.id}`).localeCompare(order(`mix:${b.inp.id}`)))

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT).filter((x) => /^chunk-\d+\.json$/.test(x))) fs.rmSync(path.join(OUT, f))

const chunks = [[]]
let size = 0
for (const p of picked) {
  const len = String(p.inp.content ?? '').length
  if (chunks.at(-1).length && size + len > BUDGET) { chunks.push([]); size = 0 }
  chunks.at(-1).push(p)
  size += len
}
chunks.forEach((c, i) => {
  const items = c.map(({ inp }) => ({
    id: inp.id,
    title: inp.title,
    source: inp.source,
    words: inp.hints?.words ?? null,
    v_level: inp.hints?.v_level ?? null,
    content: inp.content,
  }))
  fs.writeFileSync(path.join(OUT, `chunk-${String(i + 1).padStart(2, '0')}.json`), JSON.stringify(items, null, 1) + '\n')
})
fs.writeFileSync(
  path.join(OUT, 'key.json'),
  JSON.stringify({
    seed: SEED,
    population,
    items: picked.map(({ inp, truth, second, round }) => ({
      id: inp.id, source: inp.source, round, criteria_version: truth.criteria_version,
      truth: truth.retention, hold_reason: truth.hold_reason ?? null, genre: truth.genre ?? null, why: truth.why, second,
    })),
  }, null, 1) + '\n'
)

console.log(`  모집단 ${JSON.stringify(population)} · 표본 ${picked.length} · 청크 ${chunks.length}`)
chunks.forEach((c, i) => console.log(`    chunk-${String(i + 1).padStart(2, '0')} ${c.length}편 · ${c.reduce((s, p) => s + String(p.inp.content).length, 0).toLocaleString()}자`))
