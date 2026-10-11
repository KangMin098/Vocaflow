// scripts/csat/diagnosis/review-impact-guard.mjs
//
// 영향 큰 셀 가드(2026-10-11 · 6차 P0-4) — 추천에 큰 영향을 주는 태그는 더 엄격하게: 단일 변경만으로 합성 학습자의 약한 축 1순위를
// THRESHOLD(5%) 이상 바꾸는 셀은 **판정자 전원이 같은 방향(있음/없음)** 일 때만 바꾸고, 아니면 시드 값을 유지한다. **DB 에 쓰지 않는다.**
//   입력: pilot/<exam>-review-final.json(최종 · 판정자별 · 시드) · tmp/pilot/tag-sensitivity-<exam>.json(셀별 1순위 뒤집힘 비율)
//   출력: 같은 final 파일에 guard 기록 · 되돌린 셀 반영(version 에 +impact)
//   node scripts/csat/diagnosis/review-impact-guard.mjs M2609 M2606
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..')
const THRESHOLD = 5
for (const exam of process.argv.slice(2)) {
  const p = path.join(ROOT, `scripts/csat/diagnosis/pilot/${exam}-review-final.json`)
  const final = JSON.parse(fs.readFileSync(p, 'utf8'))
  const sens = JSON.parse(fs.readFileSync(path.join(ROOT, `tmp/pilot/tag-sensitivity-${exam}.json`), 'utf8'))
  const byNo = new Map(final.items.map((it) => [it.no, it]))
  const reverted = []
  const kept = []
  for (const c of sens.allCells.filter((x) => (x.flip ?? 0) >= THRESHOLD)) {
    const it = byNo.get(c.no)
    const votes = [it.claudeA?.[c.code], it.claudeB?.[c.code], it.claudeC?.[c.code]].filter((v) => v !== undefined)
    const unanimous = votes.every((v) => (v > 0) === (votes[0] > 0)) && (votes[0] > 0) === (it.w[c.code] > 0)
    if (unanimous) { kept.push(`#${c.no} ${c.code} ${c.from}→${c.to} ${c.flip}%`); continue }
    it.w[c.code] = it.seedV2[c.code] ?? 0
    reverted.push(`#${c.no} ${c.code} ${c.from}→${c.to}(시드 ${it.w[c.code]} 유지) ${c.flip}% 표 ${votes.join('/')}`)
  }
  final.version = `${String(final.version ?? 'final-v1').replace(/\+impact$/, '')}+impact`
  final.impactGuard = { threshold: `${THRESHOLD}%`, rule: '단일 변경 1순위 뒤집힘 ≥ 기준 인 셀은 판정자 전원 같은 방향일 때만 변경 · 아니면 시드 유지', at: '2026-10-11', kept, reverted }
  fs.writeFileSync(p, JSON.stringify(final, null, 2) + '\n')
  console.log(JSON.stringify({ exam, highImpact: kept.length + reverted.length, keptUnanimous: kept.length, revertedToSeed: reverted.length }))
  if (reverted.length) console.log('  되돌림:', reverted.join(' | '))
}
