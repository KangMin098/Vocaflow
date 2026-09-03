// scripts/csat/score-articles.mjs
//
// **원문마다 수능 적합도를 재서 DB 에 남긴다.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// `corpus-window-yield` · `discourse-band` 는 **자**다 — 돌릴 때마다 전수를 다시 계산한다.
// 6,500편에 수 분, 5만편이면 수십 분이다. 그래서 "지금 적합 원문이 몇 편인가" 를
// 물을 때마다 전수 계산을 해야 하고, 화면에서 걸러 보거나 감시할 수도 없다.
// 그건 측정이지 **관리**가 아니다.
//
// 이 스크립트는 같은 자를 한 번 대고 **결과를 원문에 붙인다.** 그러면
//   · `where (csat_fit->>'pass')::int > 0` 으로 즉시 질의된다 (부분 인덱스 있음)
//   · 새로 들어온 원문만 채점하면 되므로 비용이 누적되지 않는다
//   · 기준(대역)이 바뀌면 `bandsHash` 가 달라지므로 **재채점 대상을 알 수 있다**
//
// ⚠️ **전용 컬럼을 쓴다**(마이그레이션 20260830120000). 처음에는 CLAUDE.md 규약대로
//   `syntax_score`(jsonb)에 키를 더했는데, `process-queue.mjs:148` 이 부르는
//   `compute_article_syntax` RPC 가 그 컬럼을 **통째로 덮어써** 재처리마다 조용히 사라졌다.
//   "키만 더하면 마이그레이션이 필요 없다" 는 규약은 그 컬럼에 통째로 쓰는 주인이 없을 때만 성립한다.
//
// 저장 형태:
//   csat_fit = {
//     v: 1,                      // 채점기 판 — 로직이 바뀌면 올린다
//     bandsHash: "773d679f463c", // 기준 대역 값의 해시. 다르면 재채점 대상
//     shape: 12,                 // 모양+산문 게이트를 통과한 창 수 (R-BLANK 기준)
//     pass: 7,                   // 담화 대역까지 통과한 창 수  ← 이게 적합 여부
//     measuredAt: "..."
//   }
//
// 실행:
//   pnpm dlx tsx scripts/csat/score-articles.mjs                 # 밀린 양만 센다(읽기 전용)
//   pnpm dlx tsx scripts/csat/score-articles.mjs --commit [--limit 2000] [--force]
//
// 재실행 안전: 이미 같은 판·같은 대역으로 채점된 원문은 건너뛴다. `--force` 로만 다시 한다.

import fs from 'node:fs'
import path from 'node:path'

// ⚠️ 채점기는 **여기 두지 않는다** — 새 소스를 붙일지 재는 탐색기와 적재 시점 게이트도
//   같은 자를 써야 한다. 복사본이 생기면 "이 소스는 70% 통과" 라 재 놓고 적재한 뒤
//   채점하면 다른 값이 나온다. 자는 `lib-fit.mjs` 하나뿐이다.
import { BANDS_HASH, FLOOR, SCORER_VERSION, TYPE, scoreArticle } from './lib-fit.mjs'

// ⚠️ **이 채점기가 재지 않는 축: 소재.** 근거와 두 번의 실패한 시도는 `lib-fit.mjs` 머리말에
//   적어 뒀다(뉴스 분류기 2026-08-30 · 소재 분류기 확신도 게이트 2026-09-03).
//
// → 그래서 `pass > 0` 편수는 **「적합」의 절반**이다. 나머지 절반(소재 배합)은
//   `topic-gap.mjs` 가 재고, 목표(1만/3만/5만)와 견줄 값은 그쪽의 **균형 사정권**이다.
//   실측 2026-09-03: 적합 14,252편 → 균형 사정권 **4,161편**.
//   상세 `docs/reports/csat-source-fit-20260903.md`.

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const force = process.argv.includes('--force')
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

console.log(
  `수능 적합도 채점 v${SCORER_VERSION} · 기준 ${TYPE} · 대역 해시 ${BANDS_HASH}\n` +
    `담화 하한 (기출 ${FLOOR.n}편 10분위) 연결사 ${FLOOR.conn.toFixed(2)} · 지시어 ${FLOOR.ana.toFixed(2)}\n`,
)

/**
 * 일시적 실패는 물러섰다 다시 친다.
 *
 * ⚠️ 실측 2026-08-30 — 수집 배치와 동시에 돌리다 한 번의
 *   `Could not query the database for the schema cache. Retrying.` 로 **채점 배치가 통째로
 *   죽었다.** PostgREST 가 스키마 캐시를 다시 읽는 순간(컬럼을 막 추가했다)이나 부하가
 *   겹칠 때 나오는 과도기 오류인데, 그 한 번에 수천 편짜리 작업이 날아간다.
 *   영구 오류(권한·문법)는 재시도해도 같으므로 횟수를 제한하고 마지막엔 던진다.
 */
async function withRetry(label, fn, attempts = 4) {
  let last
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await fn()
    if (!error) return data
    last = error
    const transient = /schema cache|timeout|fetch failed|ECONN|503|502/i.test(error.message ?? '')
    if (!transient || i === attempts - 1) break
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
  }
  throw new Error(`${label} 실패: ${last?.message ?? '알 수 없음'}`)
}

// ⚠️ PostgREST 는 한 번에 1,000행만 준다 — range 로 끝까지 읽는다.
//   (이 상한 때문에 수집 배치가 이미 가진 글을 다시 GET 하던 적이 있다.)
const rows = []
for (let from = 0; ; from += 500) {
  const data = await withRetry('조회', () =>
    db
      .from('library_articles')
      .select('id, content, csat_fit')
      .not('content', 'is', null)
      .range(from, from + 499),
  )
  if (!data || data.length === 0) break
  rows.push(...data)
  if (data.length < 500) break
}

const needScore = rows.filter((r) => {
  if (force) return true
  const f = r.csat_fit
  return !f || f.v !== SCORER_VERSION || f.bandsHash !== BANDS_HASH
})
const targets = needScore.slice(0, LIMIT === Infinity ? undefined : LIMIT)

console.log(`원문 ${rows.length.toLocaleString()} · 채점 필요 ${needScore.length.toLocaleString()}` +
  `${commit ? ` · 이번에 ${targets.length.toLocaleString()}편` : ' (읽기 전용 — --commit 을 붙이면 쓴다)'}\n`)

let fit = 0
let written = 0
const failures = []
for (const a of targets) {
  const s = scoreArticle(a.content)
  if (s.pass > 0) fit++
  if (!commit) continue
  const record = {
    v: SCORER_VERSION,
    bandsHash: BANDS_HASH,
    type: TYPE,
    shape: s.shape,
    pass: s.pass,
    measuredAt: new Date().toISOString(),
  }
  const { error } = await db.from('library_articles').update({ csat_fit: record }).eq('id', a.id)
  if (error) failures.push(`${a.id}: ${error.message}`)
  else written++
}

console.log(`적합 원문(지문 1개 이상) ${fit.toLocaleString()} / ${targets.length.toLocaleString()}` +
  ` (${((100 * fit) / Math.max(1, targets.length)).toFixed(1)}%)`)
if (commit) console.log(`기록 ${written.toLocaleString()}편`)
if (failures.length) {
  console.log(`\n실패 ${failures.length}:`)
  for (const f of failures.slice(0, 10)) console.log('  · ' + f)
}
console.log(
  `\n질의: select count(*) from library_articles where (csat_fit->>'pass')::int > 0;`,
)
