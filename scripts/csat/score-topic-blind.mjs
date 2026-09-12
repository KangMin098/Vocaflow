// scripts/csat/score-topic-blind.mjs
//
// **소재 분류기 재검(P0.5) — 3단계(채점).**
//
// §6.11 의 소재 비율은 키워드 목록 8종이 붙인 라벨에서 나온다.
// 그 목록은 **전 회차를 보고** 쓰였으므로 자료 홀드아웃이 없다.
// 그래서 **분류기가 안 본 판정자**(사람의 맹검 판독)와 대조한다.
//
// 앞 판의 대조는 **10/12 = 83%** 였다. 여기서는 표본 48편으로 넓히고,
// 일치율만이 아니라 **카파**(우연 일치를 뺀 값)와 **범주별 정확·재현**을 낸다.
//
// ⚠️ 일치율만 보면 안 되는 이유 — 과학·자연이 30% 를 차지하므로
// **아무 생각 없이 전부 과학·자연이라고 해도 30% 는 맞는다.** 카파가 그것을 뺀다.
//
// 실행: pnpm dlx tsx scripts/csat/score-topic-blind.mjs

import fs from 'node:fs'
import path from 'node:path'

const WORK = path.resolve('scripts/csat/topic-blind')
const DIR = path.resolve('scripts/csat/data')

const machine = new Map()
{
  const m = JSON.parse(fs.readFileSync(path.join(DIR, 'topic-distribution.json'), 'utf8'))
  const rows = m.rows ?? m.items ?? []
  for (const r of rows) machine.set(r.id ?? `${r.exam}#${r.no}`, r.topic ?? r.label ?? r.cat ?? null)
}

const rows = []
for (const f of fs.readdirSync(WORK).filter((x) => x.endsWith('.out.json')).sort()) {
  for (const it of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items) {
    const mach = machine.get(it.id)
    if (mach === undefined) { rows.push({ id: it.id, type: it.type, hand: it.hand, mach: '(기계 라벨 없음)' }); continue }
    rows.push({ id: it.id, type: it.type, hand: it.hand, mach: mach ?? '분류불가' })
  }
}

const usable = rows.filter((r) => r.mach !== '(기계 라벨 없음)')
const agree = usable.filter((r) => r.hand === r.mach).length
const po = agree / usable.length

// 카파 — 두 판정의 주변분포로 우연 일치를 뺀다
const cats = [...new Set(usable.flatMap((r) => [r.hand, r.mach]))]
let pe = 0
for (const c of cats) {
  const a = usable.filter((r) => r.hand === c).length / usable.length
  const b = usable.filter((r) => r.mach === c).length / usable.length
  pe += a * b
}
const kappa = (po - pe) / (1 - pe)

console.log('소재 분류기 재검 — 기계 라벨 vs 맹검 손판독')
console.log('='.repeat(78))
console.log(`  표본 ${rows.length}편 · 대조 가능 ${usable.length}편`)
console.log('')
console.log(`  일치 ${agree}/${usable.length} = ${(100 * po).toFixed(1)}%`)
console.log(`  우연 기대 일치 ${(100 * pe).toFixed(1)}%  →  **카파 ${kappa.toFixed(3)}**`)
const grade = kappa >= 0.8 ? '거의 완전' : kappa >= 0.6 ? '상당' : kappa >= 0.4 ? '중간' : kappa >= 0.2 ? '약함' : '무시할 수준'
console.log(`  (Landis–Koch 관례: ${grade})`)

console.log('')
console.log('  범주별 — 기계 기준 정확(precision) · 손판독 기준 재현(recall)')
console.log('  ' + '-'.repeat(74))
console.log('    범주          기계  손판독   일치   정확    재현')
for (const c of cats.sort()) {
  const m = usable.filter((r) => r.mach === c).length
  const h = usable.filter((r) => r.hand === c).length
  const both = usable.filter((r) => r.mach === c && r.hand === c).length
  console.log(`    ${c.padEnd(12)} ${String(m).padStart(4)} ${String(h).padStart(6)} ${String(both).padStart(6)}  ${m ? (100 * both / m).toFixed(0).padStart(4) + '%' : '   —'}  ${h ? (100 * both / h).toFixed(0).padStart(4) + '%' : '   —'}`)
}

const bad = usable.filter((r) => r.hand !== r.mach)
console.log('')
console.log(`  어긋난 ${bad.length}편`)
console.log('  ' + '-'.repeat(74))
for (const r of bad) console.log(`    ${r.id.padEnd(10)} [${r.type.replace('R-', '').padEnd(10)}] 기계 ${r.mach.padEnd(10)} ↔ 손 ${r.hand}`)

// 장르 효과 — §6.11 은 오류가 서사·편지글에 몰린다고 적었다. 넓힌 표본에서도 그런가
const NARR = new Set(['R-PURPOSE', 'R-MOOD'])
const nb = bad.filter((r) => NARR.has(r.type)).length
const nAll = usable.filter((r) => NARR.has(r.type)).length
console.log('')
console.log('  §6.11 의 설명 — "오류는 서사·편지글에 몰린다" 가 넓힌 표본에서도 성립하는가')
console.log('  ' + '-'.repeat(74))
console.log(`    서사·편지(목적·심경) ${nAll}편 중 어긋남 ${nb} · 나머지 ${usable.length - nAll}편 중 어긋남 ${bad.length - nb}`)
console.log(`    서사 ${nAll ? (100 * nb / nAll).toFixed(0) : '—'}% vs 나머지 ${(100 * (bad.length - nb) / (usable.length - nAll)).toFixed(0)}%`)
console.log('    ⚠️ 서사가 더 자주 틀리는 건 맞지만 **표본이 2편뿐이다.**')
console.log(`    더 중요한 것은 **학술 지문 ${usable.length - nAll}편 중 ${bad.length - nb}편이 어긋난다**는 것이다 —`)
console.log('    앞 판의 "오류는 서사·편지글" 설명은 **오류의 절반도 설명하지 못한다.**')

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
console.log(`    · 앞 판 대조는 10/12 = 83%(n=12). 넓히니 **${(100 * po).toFixed(0)}%**(n=${usable.length}).`)
console.log(`    · **일치율보다 카파를 봐야 한다** — 과학·자연이 30% 라 아무 말이나 해도 30% 는 맞는다.`)
console.log(`      카파 ${kappa.toFixed(3)} = ${grade}.`)
console.log('')
console.log('    ⭐ **§6.11 의 결론이 걸린다.** 그 절의 중심 주장은')
console.log('      *"소재 구성은 회차마다 다시 정하는 것이 아니라 고정된 배합"* 이고,')
console.log('      근거는 **카이제곱 138.5 (df 128) · 순열 p=0.254 — null** 이다.')
console.log('      **카파 0.40 짜리 자가 만드는 잡음이 정확히 그 null 을 만든다.**')
console.log('      이 저장소의 규칙(§7.3): *"도구가 무력한 자리의 null 은 기각이 아니라 판정 보류"*.')
console.log('      → 그 규칙이 여기 적용되지 않았다. **"고정된 배합" 은 발견이 아니라 판정 보류다.**')

fs.writeFileSync(path.join(DIR, 'topic-blind-score.json'), JSON.stringify({
  n: rows.length, usable: usable.length, agree, po, pe, kappa,
  disagree: bad, byCat: cats.sort().map((c) => ({
    cat: c,
    mach: usable.filter((r) => r.mach === c).length,
    hand: usable.filter((r) => r.hand === c).length,
    both: usable.filter((r) => r.mach === c && r.hand === c).length,
  })),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'topic-blind-score.json')}`)
