// scripts/csat/source-round/retain-shortcut-scan.mjs
//
// **보관 판정 파일이 가공 시도(criteria.md §3-2)를 실제로 했는지 검산한다 — 읽기 전용.**
//
// 왜 (2026-09-25): 회차 8 이중 판정자가 스스로 보고했다 — `processing` 의 세 값을 편마다 가공해 보지 않고
//   판정값에 따라 한꺼번에 채웠고(keep → 셋 다 true · hold → detachable 만 · discard → 셋 다 false),
//   `sample` 은 본문 첫 문단의 첫 여섯 낱말을 자동으로 넣었다. 검사기(gate-reviews-verify)는 모양만 봐서
//   이것을 통과시켰다. 적재 전에 이 스크립트로 청크마다 잰다.
//
// 재는 것 (청크 하나 = 판정 파일 하나):
//   mech   `processing` 세 값이 위 기계 패턴과 똑같은 편의 비율
//   auto   `sample` 이 「8낱말 이상인 첫 문단의 첫 여섯 낱말」과 같은 편의 비율
//   note   `processing.note` 가 비었거나 청크 안에서 같은 문구가 되풀이된 편의 비율
// SUSPECT(note 되풀이 — 판정을 건너뛴 신호)면 그 청크는 적재하지 않고 다시 판정한다. WARN 은 sample 칸만 자동.
//
// ⚠️ mech 는 판정 근거로 쓰지 않는다 — 정직하게 가공한 판정자도 keep 을 셋 다 true 로 적는다(회차 7: 60~95%).
//   auto 도 단독으로는 안 된다 — 그림책처럼 짧은 글은 판정은 정직해도 sample 을 첫 문단으로 적기 쉽다.
//   지름길의 신호는 note 다(회차 8 두 번째 판정자: note 88~96% 되풀이 · 정직한 판정 0%).
//
// 실행: node scripts/csat/source-round/retain-shortcut-scan.mjs --round 8 [--threshold 0.9] [--b]
//   --b  두 번째 판정자 파일(.b.out.json)을 잰다(기본은 .out.json)

import fs from 'node:fs'
import path from 'node:path'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const ROUND = arg('round', '')
if (!ROUND) throw new Error('--round <n>')
const TH = Number(arg('threshold', 0.9))
const SUFFIX = process.argv.includes('--b') ? '.b.out.json' : '.out.json'
const DIR = path.resolve(`scripts/csat/source-round/round-${ROUND}`)

const verdictOf = (r) => (typeof r.retention === 'string' ? r.retention : r.retention?.verdict)
const MECH = { keep: [true, true, true], hold: [true, false, false], discard: [false, false, false] }
const firstSix = (content) => {
  const para = String(content ?? '').split(/\n{2,}/).map((p) => p.trim()).find((p) => p.split(/\s+/).length >= 8) ?? ''
  return para.split(/\s+/).slice(0, 6).join(' ').toLowerCase()
}
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

const rows = []
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(SUFFIX) && !f.endsWith('.b.out.json') === (SUFFIX === '.out.json')).sort()) {
  const chunkFile = path.join(DIR, f.replace(SUFFIX, '.json'))
  if (!fs.existsSync(chunkFile)) continue
  const chunk = JSON.parse(fs.readFileSync(chunkFile, 'utf8'))
  const out = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  const byId = new Map(chunk.map((c) => [c.id, c]))
  let mech = 0, auto = 0, note = 0
  const notes = new Map()
  for (const r of out) notes.set(norm(r.processing?.note), (notes.get(norm(r.processing?.note)) ?? 0) + 1)
  for (const r of out) {
    const p = r.processing ?? {}
    const want = MECH[verdictOf(r)]
    if (want && [p.detachable, p.standsAlone, p.vocabAdjustable].every((v, i) => v === want[i])) mech++
    const c = byId.get(r.id)
    if (c && norm(p.sample) && norm(p.sample) === firstSix(c.content)) auto++
    const n = norm(p.note)
    if (!n || notes.get(n) > 1) note++
  }
  const n = out.length || 1
  const m = { mech: mech / n, auto: auto / n, note: note / n }
  // SUSPECT = 판정 자체를 건너뛴 신호 — 메모가 비었거나 되풀이된다(가공을 안 했으니 쓸 말이 없다).
  // WARN    = 판정은 했는데 sample 칸만 첫 문단 자동값 — 적재는 막지 않는다.
  //   회차 8 gdl-08~12: sample 92~100% 자동이지만 메모가 편마다 다르고 구체적이었다
  //   (「셋째 딸 단락은 앞 문맥 없이 서고 learnt·stumble 만 바꾸면」). 처음 규칙(auto 단독 SUSPECT)이 이걸 잘못 걸었다.
  const suspect = m.note >= TH || (m.auto >= TH && m.note >= 0.5)
  const warn = !suspect && m.auto >= TH
  rows.push({ file: f, n: out.length, ...m, suspect, warn })
}

const pct = (x) => `${Math.round(x * 100)}%`.padStart(5)
console.log(`회차 ${ROUND} · ${SUFFIX} · 문턱 ${TH}`)
console.log('파일'.padEnd(40), '   n', ' mech', ' auto', ' note', '')
for (const r of rows) console.log(r.file.padEnd(40), String(r.n).padStart(4), pct(r.mech), pct(r.auto), pct(r.note), r.suspect ? ' SUSPECT' : r.warn ? ' WARN(sample)' : '')
const bad = rows.filter((r) => r.suspect)
console.log(`\n청크 ${rows.length} · SUSPECT ${bad.length} · WARN ${rows.filter((r) => r.warn).length}(sample 칸만 자동 — 적재 가능)`)
if (bad.length) {
  console.log('다시 판정할 청크:', bad.map((r) => r.file.replace(SUFFIX, '.json')).join(' '))
  process.exitCode = 1
}
