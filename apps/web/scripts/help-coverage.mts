// apps/web/scripts/help-coverage.mts
//
// **화면도움말 도식 적용률 계기.** 도식이 몇 화면에 붙었고, 붙지 않은 화면의 산문이
// 얼마나 두꺼운지 잰다. 짐작 대신 이 숫자로 말한다.
//
// ── 어디까지 그리면 되는가 (실측 2026-09-14) ────────────────────────
// 도식은 「지금 어느 칸이고 다음은 무엇인가」가 **산문에 묻혔을 때** 값을 한다.
// 묻히지 않은 화면에 그리면 읽을 것이 하나 더 늘 뿐이고, `help/types.ts` 가 적어 둔 대로
// **억지로 그린 그림은 산문보다 나쁘다**.
//
// 그래서 기준을 **가시 텍스트 1,200자**로 잡았다. 그 위를 전부 그린 결과가 68/105(64.8%)이고,
// 남은 37 단위는 전부 **734자 이하**다 — 한 화면을 훑는 데 스크롤이 필요 없는 길이다.
// 백분율을 더 올리려고 그 아래를 그리지 않는다. 새 화면이 두꺼워지면 그때 이 자가 다시 짚는다.
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
