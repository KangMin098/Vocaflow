// scripts/csat/measure-vocab-format.mjs
//
// **어휘(30번)의 출제 형식을 회차마다 계측한다 — E10 이 읽는다.**
//
// 어휘 문항은 두 형식뿐이다:
//   **네모형** `(A) frequently / rarely` — 낱말 쌍을 셋 놓고 고르게 한다
//   **밑줄형** `① pressure … ⑤ preferred` — 지문 안 표시어 다섯 중 틀린 것을 고르게 한다
//
// 둘뿐이므로 **기저가 1/2 이고 가정이 아니다.**
//
// `design-spec.mjs` 와 `test-spec-mutation.mjs` 가 이 파일의 산출을 문항에 붙여
// E10 을 검사한다. 형식은 지면에서만 보이므로 여기서 한 번 계측해 자료로 남긴다 —
// 설계기준 쪽이 본문 파싱에 직접 의존하지 않게 하려는 것이다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-vocab-format.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const BOX = /\(([ABC])\)\s*([A-Za-z][A-Za-z-]*)\s*\/\s*([A-Za-z][A-Za-z-]*)/g
const MARK = /([①②③④⑤])\s*([A-Za-z][A-Za-z-]*)/g

const out = {}
const rows = []
for (const r of allRows()) {
  if (r.type !== 'R-VOCAB') continue
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const t = b.join(' ').replace(/\s+/g, ' ')
  const nBox = [...t.matchAll(BOX)].length
  const nMark = [...t.matchAll(MARK)].length
  // ⚠️ **네모형도 ①~⑤ 를 갖는다** — 낱말 쌍 셋의 조합을 고르는 선택지가 그것이다.
  // 그래서 표시어 개수로 먼저 재면 네모형 넷이 전부 "판정 불가" 로 떨어진다(실제로 그랬다).
  // 낱말 쌍 `(A) x / y` 는 **네모형에만** 있으므로 그것을 먼저 본다.
  let fmt = null
  if (nBox >= 2) fmt = 'box'
  else if (nMark === 5) fmt = 'underline'
  if (!fmt) { rows.push({ exam: r.exam, no: r.no, fmt: '?', nBox, nMark }); continue }
  out[`${r.exam}#${r.no}`] = fmt
  rows.push({ exam: r.exam, no: r.no, fmt, nBox, nMark })
}

fs.writeFileSync(path.join(DIR, 'vocab-format.json'), JSON.stringify(out, null, 1))

console.log('어휘 30번 출제 형식 계측')
console.log('='.repeat(70))
for (const r of rows.sort((a, b) => a.exam.localeCompare(b.exam))) {
  console.log(`  ${r.exam.padEnd(6)} #${r.no}  ${r.fmt === 'box' ? '네모형' : r.fmt === 'underline' ? '밑줄형' : '판정 불가'}  (쌍 ${r.nBox} · 표시어 ${r.nMark})`)
}
const bad = rows.filter((r) => r.fmt === '?')
console.log(`\n  계측 ${Object.keys(out).length}/${rows.length}${bad.length ? ` · 판정 불가 ${bad.length}` : ''}`)
console.log(`→ ${path.join(DIR, 'vocab-format.json')}`)
