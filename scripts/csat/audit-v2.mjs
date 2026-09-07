// scripts/csat/audit-v2.mjs
//
// **설계도 v2-draft 의 명제별 판정 커버리지를 잰다.**
//
// 목표는 "설계도가 14개년 기출에 100% 가깝게 적용된다" 인데, 그대로는 측정할 수 없다.
// 측정 가능한 형태로 바꾸면 두 축이다:
//
//   A. 판정 커버리지 = 판정이 끝난 명제 / 전체 명제
//      판정 = HARD · HARD_CAND · SOFT · REJECTED 중 하나. UNTESTED · STALE 은 미판정.
//      (STALE 은 "초안이 실측과 모순" 이므로 설계도 쪽이 아직 안 고쳐진 상태 = 미적용)
//
//   B. 전수 커버리지 = 14회차 전부에서 검사된 명제 / 전체 명제
//      표본 n=5 짜리 명제는 "14개년에 적용된다" 고 말할 수 없다.
//
// 두 축을 곱하지 않고 따로 낸다 — 하나를 올리려 다른 하나를 깎는 것을 보이게 하려고.
//
// 실행: pnpm dlx tsx scripts/csat/audit-v2.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const led = JSON.parse(fs.readFileSync(path.join(DIR, 'v2-claims.json'), 'utf8'))
const claims = led.claims

// **id 중복 가드.** 2026-08-26 에 실제로 겪었다 — 새 명제를 이미 쓰이는 번호(P4.6)로 올렸고,
// 다음 사이클에서 `find(P4.6)` 이 **원래 명제**를 집어 그 근거를 통째로 덮어썼다.
// 대장이 조용히 망가지면 커버리지 수치는 멀쩡해 보인다. 그래서 여기서 먼저 막는다.
{
  const seen = new Map()
  const dups = []
  for (const c of claims) {
    if (seen.has(c.id)) dups.push(c.id)
    else seen.set(c.id, c)
  }
  if (dups.length) {
    console.error(`✗ 명제 id 가 중복이다: ${[...new Set(dups)].join(', ')}`)
    console.error('  같은 번호를 두 명제가 쓰면 find(id) 가 엉뚱한 것을 집어 근거를 덮어쓴다.')
    process.exit(1)
  }
}

const DECIDED = new Set(['HARD', 'HARD_CAND', 'SOFT', 'REJECTED'])
const RULE = new Set(['HARD', 'HARD_CAND'])

const total = claims.length
const decided = claims.filter((c) => DECIDED.has(c.status))
const stale = claims.filter((c) => c.status === 'STALE')
const untested = claims.filter((c) => c.status === 'UNTESTED')
const fullExam = claims.filter((c) => c.exams >= 14)
const rules = claims.filter((c) => RULE.has(c.status))

const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10)

const bySec = {}
for (const c of claims) {
  const s = (bySec[c.sec] ??= { total: 0, decided: 0, stale: 0, untested: 0, full: 0 })
  s.total += 1
  if (DECIDED.has(c.status)) s.decided += 1
  if (c.status === 'STALE') s.stale += 1
  if (c.status === 'UNTESTED') s.untested += 1
  if (c.exams >= 14) s.full += 1
}

const byStatus = {}
for (const c of claims) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1

const L = []
const say = (s = '') => L.push(s)

say('설계도 v2-draft — 명제별 판정 커버리지')
say('='.repeat(72))
say()
say(`  전체 명제  ${total}`)
say()
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
  say(`    ${k.padEnd(10)} ${String(v).padStart(3)}   ${String(pct(v, total)).padStart(5)}%`)
}
say()
say('  A. 판정 커버리지 (HARD·HARD_CAND·SOFT·REJECTED)')
say(`     ${decided.length}/${total} = ${pct(decided.length, total)}%`)
say()
say('  B. 14회차 전수 커버리지')
say(`     ${fullExam.length}/${total} = ${pct(fullExam.length, total)}%`)
say()
say('  C. 규칙으로 쓸 수 있는 명제 (HARD + HARD_CAND)')
say(`     ${rules.length}/${total} = ${pct(rules.length, total)}%`)
say()

say('  섹션별')
say('  ' + '-'.repeat(68))
say('  sec   전체   판정      전수      STALE  UNTESTED')
for (const [k, v] of Object.entries(bySec).sort()) {
  say(
    `  §${k.padEnd(4)} ${String(v.total).padStart(4)}  ` +
      `${String(v.decided).padStart(3)} ${String(pct(v.decided, v.total)).padStart(5)}%  ` +
      `${String(v.full).padStart(3)} ${String(pct(v.full, v.total)).padStart(5)}%  ` +
      `${String(v.stale).padStart(5)}  ${String(v.untested).padStart(8)}`,
  )
}
say()

if (stale.length) {
  say(`  ⚠️  STALE ${stale.length}건 — 초안이 이 저장소의 실측과 모순된다. 초안을 고쳐야 한다.`)
  say('  ' + '-'.repeat(68))
  for (const c of stale) {
    say(`  ${c.id}  ${c.text}`)
    say(`        → ${c.evidence}`)
  }
  say()
}

if (untested.length) {
  say(`  ○  UNTESTED ${untested.length}건 — 다음 사이클의 작업 목록`)
  say('  ' + '-'.repeat(68))
  for (const c of untested) say(`  ${c.id}  ${c.text}`)
  say()
}

const out = {
  total,
  byStatus,
  coverageDecided: pct(decided.length, total),
  coverageFullExam: pct(fullExam.length, total),
  coverageRule: pct(rules.length, total),
  bySec,
  stale: stale.map((c) => c.id),
  untested: untested.map((c) => c.id),
}
fs.writeFileSync(path.join(DIR, 'v2-audit.json'), JSON.stringify(out, null, 1))
say(`→ ${path.join(DIR, 'v2-audit.json')}`)

console.log(L.join('\n'))
