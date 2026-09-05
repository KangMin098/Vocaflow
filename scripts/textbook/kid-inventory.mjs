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
// ⚠️⚠️ **그런데 `.not(col, 'eq', 'false')` 도 같은 함정이다.** PostgREST 가 SQL `col <> 'false'`
//   로 번역하는데, `col` 이 NULL 이면 비교 결과가 UNKNOWN 이라 **그 행이 조용히 빠진다.**
//   주석에는 "미판정은 격리가 아니다" 라고 써 놓고 구현이 정반대였다
//   (실측 2026-09-05: 초3~4 를 449 로 셌으나 실제 652 − 격리 145 = **507**. 미판정 58편과
//    `gate.publishable` 키가 없는 행이 빠졌다).
//   그래서 **빼기로 센다** — 적재분에서 명시적 격리만 뺀다. NULL 은 어느 쪽에도 안 걸린다.
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

const quarantined = (q) => q.eq('csat_fit->gate->>publishable', 'false')

const rows = await Promise.all(
  BANDS.map(async (b) => {
    const label = `PD 발췌 · ${b}`
    const [{ count: held }, { count: bad }] = await Promise.all([
      countOf((q) => q.eq('feed_label', label)),
      countOf((q) => quarantined(q.eq('feed_label', label))),
    ])
    const ok = held - bad
    return { band: b, held, quarantined: bad, publishable: ok, quotaLeft: Math.max(0, QUOTA_PER_BAND - ok) }
  })
)
const [{ count: adaptedHeld }, { count: adaptedBad }] = await Promise.all([
  countOf((q) => q.eq('feed_id', 'adapted')),
  countOf((q) => quarantined(q.eq('feed_id', 'adapted'))),
])
const adaptedOk = adaptedHeld - adaptedBad

const total = rows.reduce((n, r) => n + r.publishable, 0) + adaptedOk
const pct = +((total / TARGET) * 100).toFixed(1)

if (JSON_OUT) {
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), target: TARGET, total, pct, rows, adapted: { held: adaptedHeld, publishable: adaptedOk } }, null, 2))
} else {
  const lp = (v, n) => String(v).padStart(n)
  console.log('\n  칸           적재   게시 가능   격리율   남은 몫')
  console.log('  ─────────────────────────────────────────────')
  for (const r of rows) {
    const quar = r.held ? ((r.quarantined / r.held) * 100).toFixed(0) : "0"
    console.log(`  ${r.band.padEnd(8)}${lp(r.held, 6)}${lp(r.publishable, 11)}${lp(quar + '%', 8)}${lp(r.quotaLeft.toLocaleString(), 10)}`)
  }
  console.log(`  ${'각색'.padEnd(8)}${lp(adaptedHeld, 6)}${lp(adaptedOk, 11)}`)
  console.log('  ─────────────────────────────────────────────')
  console.log(`  합계 **${total.toLocaleString()}** / ${TARGET.toLocaleString()} = **${pct}%**\n`)
  console.log('  분모는 고등 재고 18,320 의 절반이다. "게시 가능" 은 격리(publishable=false)가 아닌 것 —')
  console.log('  아직 판정 안 받은 행도 포함한다.\n')
}
