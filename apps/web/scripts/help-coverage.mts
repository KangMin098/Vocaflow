// apps/web/scripts/help-coverage.mts
//
// **화면도움말 도식 적용률 계기.** 도식이 몇 화면에 붙었고, 붙지 않은 화면의 산문이
// 얼마나 두꺼운지 잰다. 짐작 대신 이 숫자로 말한다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/help-coverage.mts

import { HELP_REGISTRY } from '../src/lib/admin/help/index'
import type { ScreenHelp } from '../src/lib/admin/help/types'

/** 도움말 한 벌이 화면에 내는 **가시 텍스트** 길이. 라벨·제목까지 센다. */
function visibleChars(h: ScreenHelp): number {
  let n = h.summary.length + (h.when?.length ?? 0)
  for (const s of h.steps ?? []) n += s.title.length + s.detail.length + (s.done?.length ?? 0)
  for (const f of h.fields ?? []) n += f.label.length + f.detail.length
  for (const c of h.cautions ?? []) n += c.length
  if (h.drain) {
    n += h.drain.what.length
    for (const p of h.drain.prerequisites) n += p.length
    for (const s of h.drain.procedure) n += s.title.length + s.detail.length + (s.done?.length ?? 0)
    for (const v of h.drain.verify) n += v.length
    for (const r of h.drain.recovery ?? []) n += r.length
  }
  return n
}

interface Row { key: string; unit: string; diagrams: number; chars: number }

const rows: Row[] = []
for (const [key, entry] of Object.entries(HELP_REGISTRY)) {
  rows.push({ key, unit: '(화면)', diagrams: entry.screen.diagrams?.length ?? 0, chars: visibleChars(entry.screen) })
  for (const [tab, help] of Object.entries(entry.tabs ?? {})) {
    rows.push({ key, unit: tab, diagrams: help.diagrams?.length ?? 0, chars: visibleChars(help) })
  }
}

const withDiagram = rows.filter((r) => r.diagrams > 0)
const without = rows.filter((r) => r.diagrams === 0)
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

console.log(`도움말 단위(화면+탭) ${rows.length} · 화면 ${Object.keys(HELP_REGISTRY).length}`)
console.log(`도식 있음 ${withDiagram.length} / ${rows.length} = ${((withDiagram.length / rows.length) * 100).toFixed(1)}%`)
console.log(`가시 텍스트 합계 ${sum(rows.map((r) => r.chars)).toLocaleString()}자 · 도식 없는 단위 ${sum(without.map((r) => r.chars)).toLocaleString()}자`)
console.log('')
console.log('— 도식 없는 단위 중 산문이 두꺼운 순 (상위 20) —')
for (const r of without.sort((a, b) => b.chars - a.chars).slice(0, 20)) {
  console.log(`  ${String(r.chars).padStart(5)}자  ${r.key} ${r.unit}`)
}
console.log('')
console.log('— 도식이 붙은 단위 —')
for (const r of withDiagram) console.log(`  ${r.diagrams}개  ${r.key} ${r.unit} (${r.chars}자)`)
