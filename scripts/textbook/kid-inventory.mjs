// scripts/textbook/kid-inventory.mjs
//
// **초·중 원문 재고를 목표 대비로 한 번에 잰다.**
//
// ── 왜 이 스크립트가 있나 ────────────────────────────────────────────
// 사이클마다 같은 수치를 임시 스크립트로 다시 세고 있었다. 그때마다 조건이 미묘하게
// 달라져 **같은 날 잰 값이 서로 어긋났다** — 어떤 회차는 적재분을, 어떤 회차는 게시
// 가능분을 세었다. 목표 달성률은 한 벌의 정의로만 세어야 한다.
//
// ── 세는 규칙 ────────────────────────────────────────────────────────
// 분모 **9,160** = 고등 재고(V5~V9 · ready+published · display_only 제외) 18,320 의 절반.
// 분자 = kid 발췌 5칸 + 각색분 중 **게시 가능**한 것.
//
// ⚠️ "게시 가능" 은 `csat_fit->gate->>publishable` 이 **명시적으로 'false' 가 아닌 것**이다.
//   아직 판정을 안 받은 행(null)은 격리가 아니다. `eq('...', 'true')` 로 세면 미판정분이
//   통째로 빠져 달성률이 실제보다 낮게 나온다(실측으로 밟은 함정).
//
// 재실행 안전: 읽기만 한다. 몇 번 돌려도 DB 가 바뀌지 않는다.
//
// 실행:
//   node scripts/textbook/kid-inventory.mjs
//   node scripts/textbook/kid-inventory.mjs --json   # 기계가 읽을 형태

import { client, dbRetry } from './lib/db.mjs'

const TARGET = 9160
const BANDS = ['초3~4', '초5~6', '초6~중1', '중1~2', '중3']
const QUOTA_PER_BAND = 1832

const JSON_OUT = process.argv.includes('--json')
const db = await client()

const countOf = (build) =>
  dbRetry(() => build(db.from('library_articles').select('id', { count: 'exact', head: true })), '재고 조회')

const publishable = (q) => q.not('csat_fit->gate->>publishable', 'eq', 'false')

const rows = await Promise.all(
  BANDS.map(async (b) => {
    const label = `PD 발췌 · ${b}`
    const [{ count: held }, { count: ok }] = await Promise.all([
      countOf((q) => q.eq('feed_label', label)),
      countOf((q) => publishable(q.eq('feed_label', label))),
    ])
    return { band: b, held, publishable: ok, quotaLeft: Math.max(0, QUOTA_PER_BAND - ok) }
  })
)
const [{ count: adaptedHeld }, { count: adaptedOk }] = await Promise.all([
  countOf((q) => q.eq('feed_id', 'adapted')),
  countOf((q) => publishable(q.eq('feed_id', 'adapted'))),
])

const total = rows.reduce((n, r) => n + r.publishable, 0) + adaptedOk
const pct = +((total / TARGET) * 100).toFixed(1)

if (JSON_OUT) {
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), target: TARGET, total, pct, rows, adapted: { held: adaptedHeld, publishable: adaptedOk } }, null, 2))
} else {
  const lp = (v, n) => String(v).padStart(n)
  console.log('\n  칸           적재   게시 가능   격리율   남은 몫')
  console.log('  ─────────────────────────────────────────────')
  for (const r of rows) {
    const quar = r.held ? (((r.held - r.publishable) / r.held) * 100).toFixed(0) : '0'
    console.log(`  ${r.band.padEnd(8)}${lp(r.held, 6)}${lp(r.publishable, 11)}${lp(quar + '%', 8)}${lp(r.quotaLeft.toLocaleString(), 10)}`)
  }
  console.log(`  ${'각색'.padEnd(8)}${lp(adaptedHeld, 6)}${lp(adaptedOk, 11)}`)
  console.log('  ─────────────────────────────────────────────')
  console.log(`  합계 **${total.toLocaleString()}** / ${TARGET.toLocaleString()} = **${pct}%**\n`)
  console.log('  분모는 고등 재고 18,320 의 절반이다. "게시 가능" 은 격리(publishable=false)가 아닌 것 —')
  console.log('  아직 판정 안 받은 행도 포함한다.\n')
}
