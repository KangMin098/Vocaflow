// scripts/textbook/source-inventory-scan.mjs
//
// **소스별로 무엇을 언제 몇 편 GET 했고 지금 어떤 상태인가** — 관리 뷰가 읽을 스냅샷.
//
// ── 왜 화면이 직접 세지 않나 ────────────────────────────────────────
// `library_articles` 는 본문이 1.3GB 라 조건부 `count: exact` 가 **8초 statement timeout**
// 에 걸린다(오류 message 가 빈 문자열로 와서 원인이 안 보인다). PostgREST 는 집계 함수도
// 꺼져 있다(PGRST123). 그래서 이 저장소의 다른 스캔들과 같은 길을 쓴다 —
// **읽기 전용 스캔이 스냅샷을 찍고, 화면은 그것을 읽으며 잰 시각을 함께 낸다.**
//
// ── 본문을 안 받는다 (이 스캔이 빠른 이유) ──────────────────────────
// 적격·결함 스캔은 본문을 봐야 해서 200~600초가 걸린다. 이 스캔은 **본문이 필요 없다** —
// 소스·상태·시각·판정 요약만 본다. 좁은 열만 받으므로 10만 행이 수십 초다.
//
// ⚠️ **`source_fetched_at` 을 「마지막 GET 시각」으로 쓰면 안 된다.** 실측 2026-09-15:
//   PLOS 45,096편 **전부 NULL** 이다(수집기가 안 채운다). 화면이 「한 번도 GET 안 함」으로
//   보이게 된다. 실제로 행이 생긴 시각은 `created_at` 이고, 그것이 곧 GET 시각이다.
//
// ⚠️ **적격 판정을 여기서 다시 하지 않는다.** 판정은 `source-eligibility-scan.mjs` 가
//   본문까지 보고 내리고, 이 스캔이 사본을 만들면 **둘이 다른 답을 하는 날이 온다**
//   (이 저장소는 어수 창이 두 벌이라 100~200 과 120~250 이 공존한 적이 있다).
//   여기서는 **판정 없이 세기만 한다** — 통과/탈락 수는 적격 스냅샷이 정본이다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/source-inventory-scan.mjs            ← 스냅샷 갱신
//   pnpm dlx tsx scripts/textbook/source-inventory-scan.mjs --no-write ← 터미널에만
//
// **읽기만 한다 — 재실행 안전.** 몇 번을 돌려도 DB 가 바뀌지 않는다.

import fs from 'node:fs'
import path from 'node:path'

import { retryingFetch } from '../lib/supabase-client.mjs'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다')
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const NO_WRITE = process.argv.includes('--no-write')
const SNAPSHOT = path.resolve('apps/web/src/lib/textbook/source-inventory-snapshot.json')

/** 5xx·연결 실패에 물러서는 GET — 긴 훑기는 한 번은 반드시 끊긴다. */
const FETCH = retryingFetch({
  onRetry: ({ attempt, wait, why }) =>
    process.stderr.write(`\n  ↻ ${attempt}차 재시도 (${Math.round(wait / 1000)}초 뒤) — ${why}\n`),
})

/**
 * 좁은 열만 커서 페이징으로 훑는다.
 *
 * `csat_fit` 는 jsonb 라 행마다 detoast 가 붙는다 — 그래서 **판정 요약 세 갈래만** 쓴다
 * (`gate.verdict` 유무 · `gate.purpose` · `gate.blockedBy` 첫 사유). 전체를 받으면
 * 이 스캔이 적격 스캔만큼 느려져 「빠른 스캔」이라는 존재 이유가 사라진다.
 */
const SELECT = 'id,source,status,created_at,article_v_level,license_class,display_only,copyright_safe_in_kr,csat_fit'
const PAGE = 1000

async function* walk() {
  let cursor = '00000000-0000-0000-0000-000000000000'
  let got = 0
  for (;;) {
    const params = new URLSearchParams({
      select: SELECT,
      id: `gt.${cursor}`,
      order: 'id.asc',
      limit: String(PAGE),
    })
    const res = await FETCH(`${URL_BASE}/rest/v1/library_articles?${params}`, { headers: HEADERS })
    if (!res.ok) throw new Error(`재고 조회 — ${res.status} ${(await res.text()).slice(0, 140)}`)
    const rows = await res.json()
    if (!rows.length) return
    for (const r of rows) yield r
    got += rows.length
    cursor = rows[rows.length - 1].id
    process.stderr.write(`  훑음 ${got.toLocaleString()}편\r`)
    if (rows.length < PAGE) return
  }
}

/** 한 소스의 집계 그릇. */
function blank() {
  return {
    total: 0,
    byStatus: {},
    /** 판정을 받은 편수 — `csat_fit.gate.verdict` 가 있는 것. */
    judged: 0,
    /** 미절단 원본 — 게이트를 돌려도 판정이 안 붙는다(`purpose='raw'`). */
    rawPurpose: 0,
    /** 학령 분석이 붙은 편수. */
    levelled: 0,
    /** 되돌릴 수 없는 법적 탈락 — 화면이 "빼는 것이 유일한 처방" 이라 부르는 몫. */
    legalBlocked: 0,
    /** 게이트가 댄 차단 사유별 편수 (상위만 화면에 쓴다). */
    blockedBy: {},
    firstGet: null,
    lastGet: null,
    /** 학령별 편수 — 드릴다운 필터의 분모. */
    byVLevel: {},
  }
}

const started = Date.now()
const bySource = new Map()
let scanned = 0

for await (const row of walk()) {
  scanned += 1
  const src = row.source ?? '(없음)'
  if (!bySource.has(src)) bySource.set(src, blank())
  const s = bySource.get(src)

  s.total += 1
  const st = row.status ?? '(없음)'
  s.byStatus[st] = (s.byStatus[st] ?? 0) + 1

  if (row.created_at) {
    if (!s.firstGet || row.created_at < s.firstGet) s.firstGet = row.created_at
    if (!s.lastGet || row.created_at > s.lastGet) s.lastGet = row.created_at
  }

  if (row.article_v_level != null) {
    s.levelled += 1
    const v = String(row.article_v_level)
    s.byVLevel[v] = (s.byVLevel[v] ?? 0) + 1
  }

  // 되돌릴 수 없는 법적 탈락 — 세 열 중 하나라도 걸리면.
  // 정본은 `source-eligibility.ts` 의 `legal` 축이고 여기서는 **같은 세 열만** 본다.
  if (row.display_only === true || row.copyright_safe_in_kr === false) s.legalBlocked += 1

  const gate = row.csat_fit?.gate
  if (gate?.verdict) s.judged += 1
  if (gate?.purpose === 'raw') s.rawPurpose += 1
  const blocked = Array.isArray(gate?.blockedBy) ? gate.blockedBy[0] : gate?.blockedBy
  if (blocked) s.blockedBy[blocked] = (s.blockedBy[blocked] ?? 0) + 1
}

const rows = [...bySource.entries()]
  .map(([source, s]) => ({
    source,
    ...s,
    topBlocked: Object.entries(s.blockedBy)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count })),
  }))
  .sort((a, b) => b.total - a.total)

const snapshot = {
  measuredAt: new Date().toISOString(),
  elapsedSeconds: Math.round((Date.now() - started) / 100) / 10,
  scope: '전체 상태 (status 필터 없음) — 관리 뷰는 보관·실패까지 본다',
  scanned,
  sources: rows,
}

// ── 보고 ────────────────────────────────────────────────────────────
const n = (x) => x.toLocaleString()
console.log(`\n\n소스별 원문 재고 — ${n(scanned)}편 · ${snapshot.elapsedSeconds}초\n`)
console.log(
  '  ' +
    '원천'.padEnd(20) +
    '전체'.padStart(8) +
    '검토대기'.padStart(10) +
    '발행'.padStart(7) +
    '판정'.padStart(8) +
    '학령'.padStart(8) +
    '  마지막 GET',
)
console.log('  ' + '─'.repeat(78))
for (const r of rows) {
  console.log(
    '  ' +
      r.source.padEnd(20) +
      n(r.total).padStart(8) +
      n(r.byStatus.ready ?? 0).padStart(10) +
      n(r.byStatus.published ?? 0).padStart(7) +
      n(r.judged).padStart(8) +
      n(r.levelled).padStart(8) +
      '  ' +
      (r.lastGet ? r.lastGet.slice(0, 10) : '—'),
  )
}

if (NO_WRITE) {
  console.log('\n  --no-write — 스냅샷을 쓰지 않았다.')
} else {
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`\n  → ${SNAPSHOT}`)
}
