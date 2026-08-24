// scripts/csat/measure-extraction.mjs
//
// **지문·선택지 추출 성공률 — 의미 수준 검사가 몇 문항까지 닿을 수 있는지의 상한.**
//
// 이 저장소의 §3·§4·§6 명제가 전부 n=4~13 손표본에 머문 이유가 여기 있었다.
// 2단 조판 복원이 회차마다 구멍이 나서 **지문을 못 뽑는 문항**이 있었고,
// 그래서 전수 검사를 걸 수 없었다. 이 스크립트가 그 상한을 잰다.
//
// 성공 = 영어 지문 120자 이상 + 선택지 5개 전부 비지 않음.
// (도표·안내문은 지문이 표라 짧을 수 있으므로 유형별로 따로 센다)
//
// 실행: pnpm dlx tsx scripts/csat/measure-extraction.mjs [columns폴더]

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, useColumns, setBlockFor } from './lib-passage.mjs'

if (process.argv[2]) useColumns(process.argv[2])

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows

// 듣기는 지문이 음성이라 지면에 없다 — 분모에서 뺀다.
// section 컬럼이 몇 문항에서 어긋나 있으므로 유형 id 로 거른다(L-* = 듣기).
const reading = rows.filter((r) => !String(r.type).startsWith('L-'))

const MIN_CHARS = 120
const res = []
for (const r of reading) {
  const bs = itemBlocks(r.exam, r.no)
  const b = bs[0]
  // 장문 세트는 지문이 `[41~42]` 머리글 밑에 한 번만 있다
  const sb = setBlockFor(r.exam, r.no)
  const p = sb ? passageOf(sb) : b ? passageOf(b) : ''
  const ch = b ? choicesOf(b) : null
  const okP = p.length >= MIN_CHARS
  const okC = !!ch && ch.every((c) => c.length > 0)
  res.push({ exam: r.exam, no: r.no, type: r.type, chars: p.length, okP, okC, ok: okP && okC })
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const ok = res.filter((r) => r.ok).length

const byType = {}
for (const r of res) {
  const t = (byType[r.type] ??= { n: 0, ok: 0, noP: 0, noC: 0 })
  t.n += 1; if (r.ok) t.ok += 1; if (!r.okP) t.noP += 1; if (!r.okC) t.noC += 1
}
const byExam = {}
for (const r of res) {
  const e = (byExam[r.exam] ??= { n: 0, ok: 0 })
  e.n += 1; if (r.ok) e.ok += 1
}

console.log('지문·선택지 추출 성공률 (듣기 제외)')
console.log('='.repeat(60))
console.log(`  전체  ${ok}/${res.length} = ${pct(ok, res.length)}%`)
console.log()
console.log('  회차별')
for (const [e, v] of Object.entries(byExam)) {
  console.log(`    ${e.padEnd(7)} ${String(v.ok).padStart(3)}/${String(v.n).padEnd(3)} ${String(pct(v.ok, v.n)).padStart(5)}%`)
}
console.log()
console.log('  유형별 (실패 있는 것만)')
for (const [t, v] of Object.entries(byType).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)) {
  if (v.ok === v.n) continue
  console.log(`    ${t.padEnd(14)} ${String(v.ok).padStart(3)}/${String(v.n).padEnd(3)} ${String(pct(v.ok, v.n)).padStart(5)}%   지문실패 ${v.noP}  선택지실패 ${v.noC}`)
}

const out = { total: res.length, ok, rate: pct(ok, res.length), byExam, byType, fail: res.filter((r) => !r.ok) }
fs.writeFileSync(path.join(DIR, 'extraction.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${path.join(DIR, 'extraction.json')}`)
