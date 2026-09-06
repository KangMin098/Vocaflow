// scripts/textbook/source-eligibility-scan.mjs
//
// **교재에 실을 수 있는 원문이 몇 편인가 — 일곱 축으로 전수 판정한다.**
//
// ── 왜 이 스크립트가 있나 ────────────────────────────────────────────
// 조판기(`volume-pool.mjs`)는 원문을 고를 때 `status` · **법적 축 3열** · 제목 두 가지만 본다
// (법적 축은 2026-09-06 에 이 판정을 만들면서 추가했다 — 그전에는 `display_only` 하나였다).
// **게시 게이트 · 내용 판정 · 잘린 지문 유무는 여전히 안 본다.**
// 그래서 "지금 조판을 돌리면 못 쓸 원문이 몇 편 들어가는가" 를 아무도 답할 수 없었다.
//
// 판정 자체는 `packages/library-pipeline/src/textbook/source-eligibility.ts` 가 갖는다.
// 이 파일은 **DB 에서 값을 길어 와 그 함수에 넣고 세기만** 한다 — 자를 두 벌 두지 않는다.
//
// ── 왜 커서 페이징인가 ───────────────────────────────────────────────
// `count: 'exact'` 는 이 표에서 쓸 수 없다. 실측 2026-09-06: `library_articles`(91,358행)
// 에 조건 하나만 걸어도 **8초 statement timeout** 에 걸리고, PostgREST 가 돌려주는
// 오류 message 가 **빈 문자열**이라 원인이 안 보인다. 본문 컬럼이 1.3GB 라 어떤 필터든
// seq scan 이 되기 때문이고, 이건 `kid-inventory.mjs` 와 Admin 재고 패널이 지금 죽어 있는
// 이유이기도 하다. 커서 페이징은 pk 인덱스를 타므로 깊이와 무관하다.
//
// 재실행 안전: **읽기만 한다.** 몇 번 돌려도 DB 가 바뀌지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs
//   pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs --json <경로>
//   pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs --band 2   # V2 만

import fs from 'node:fs'
import path from 'node:path'

const {
  judgeSource,
  tallyEligibility,
  GRADE_LABEL,
  GRADE_NEXT_STEP,
  ELIGIBILITY_AXES,
  ELIGIBILITY_SPEC_VERSION,
} = await import('../../packages/library-pipeline/src/textbook/source-eligibility.ts')

// ── 환경 ──────────────────────────────────────────────────────────
function loadEnv(file = 'apps/web/.env.local') {
  for (const line of fs.readFileSync(path.resolve(file), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다')
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const JSON_OUT = arg('json')
const ONLY_BAND = arg('band')

// **판정에 필요한 값만** 길어 온다. 본문을 받으면 21,769편에 1.3GB 를 끌어오게 된다.
const SELECT = [
  'id',
  'title',
  'status',
  'source',
  'article_v_level',
  'word_count',
  'register',
  'cefr_level',
  'display_only',
  'license_class',
  'copyright_safe_in_kr',
  'syn:syntax_score->>score',
  'gp:csat_fit->gate->>publishable',
  'gb:csat_fit->gate->>blockedBy',
  'gv:csat_fit->gate->>verdict',
  'gpu:csat_fit->gate->>purpose',
  'win:csat_fit->make->windows',
].join(',')

async function page(cursor) {
  const qs =
    `select=${encodeURIComponent(SELECT)}` +
    `&status=in.(ready,published)` +
    (ONLY_BAND ? `&article_v_level=eq.${ONLY_BAND}` : '') +
    `&order=id.asc&limit=1000${cursor ? `&id=gt.${cursor}` : ''}`
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(`${URL_BASE}/rest/v1/library_articles?${qs}`, { headers: HEADERS })
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 140)}`)
      return await r.json()
    } catch (e) {
      if (attempt === 5) throw new Error(`재고 조회 — ${e.message}`)
      await new Promise((res) => setTimeout(res, 1500 * attempt))
    }
  }
}

/**
 * **문항이 붙은 원문의 id 집합** — 긴 글이 교재에 실리는 실제 경로다.
 *
 * ── 왜 이걸 세야 하나 (실측 2026-09-06) ──────────────────────────────
 * 처음에는 `csat_fit.make.windows`(발췌창)로 "자를 수 있는가" 를 판정했다. 그런데
 * **그 열을 읽는 코드가 저장소에 하나도 없다** — `score-articles` 가 쓰고 아무도 안 읽는다.
 * 조판(`composeUnits`)이 인쇄하는 것은 문항에 저장된 `passage_text` 이고, 그 지문은
 * 만들 때 `itemWordSpec`(유형·학년별 시중 어수창)을 통과한다.
 * 그러니 긴 글의 진짜 신호는 **문항 보유**다.
 *
 * ── 왜 전수 훑기인가 ─────────────────────────────────────────────────
 * PostgREST 집계(`select=ref_id,count()`)는 이 프로젝트에서 꺼져 있다(PGRST123).
 * 한 페이지 최대 1,000행이 강제되므로 65만 행을 훑으려면 650여 회가 든다.
 * 대신 인덱스 `(kind, ref_id, type, paragraph_idx)` 를 그대로 타는 **index-only scan** 이라
 * 페이지당 100~500ms 다. 커서는 `ref_id` 이고, 같은 `ref_id` 의 나머지 행은 건너뛴다.
 */
async function loadArticlesWithItems() {
  const ids = new Set()
  let cursor = null
  let pages = 0
  for (;;) {
    const qs =
      `kind=eq.article&select=ref_id&order=ref_id.asc&limit=1000` +
      (cursor ? `&ref_id=gt.${cursor}` : '')
    let rows
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const r = await fetch(`${URL_BASE}/rest/v1/csat_dcp_items?${qs}`, { headers: HEADERS })
        if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 140)}`)
        rows = await r.json()
        break
      } catch (e) {
        if (attempt === 5) throw new Error(`문항 보유 조회 — ${e.message}`)
        await new Promise((res) => setTimeout(res, 1500 * attempt))
      }
    }
    if (!rows.length) break
    for (const r of rows) if (r.ref_id) ids.add(r.ref_id)
    // ⚠️ **마지막 ref_id 를 그대로 커서로 쓴다.** 그 id 의 남은 행은 건너뛰지만,
    //   이미 집합에 넣었으므로 잃는 것이 없다 — 세는 것은 "있는가" 이지 "몇 개인가" 가 아니다.
    const last = rows[rows.length - 1].ref_id
    if (last === cursor) break // 한 ref_id 가 1,000행을 넘으면 진전이 없다 — 무한 루프 방지
    cursor = last
    pages += 1
    if (pages % 50 === 0) process.stderr.write(`  문항 보유 ${ids.size.toLocaleString()}편\r`)
    if (rows.length < 1000) break
  }
  process.stderr.write(`  문항 보유 ${ids.size.toLocaleString()}편 (${pages}쪽)\n`)
  return ids
}

const started = Date.now()
const withItems = await loadArticlesWithItems()

/** DB 행 → 판정 입력. **여기서만 열 이름을 안다.** */
const toInput = (r) => ({
  title: r.title ?? null,
  status: r.status ?? null,
  articleVLevel: r.article_v_level ?? null,
  wordCount: r.word_count ?? null,
  register: r.register ?? null,
  cefrLevel: r.cefr_level ?? null,
  syntaxScore: r.syn == null ? null : Number(r.syn),
  displayOnly: r.display_only ?? null,
  licenseClass: r.license_class ?? null,
  copyrightSafeInKr: r.copyright_safe_in_kr ?? null,
  // ⚠️ jsonb 텍스트 추출이라 문자열 'true'/'false' 로 온다. `Boolean('false') === true` 다 —
  //   그냥 넘기면 **차단된 원문이 전부 통과한다.**
  gatePublishable: r.gp == null ? null : r.gp === 'true',
  gateBlockedBy: r.gb ?? null,
  gateVerdict: r.gv ?? null,
  gatePurpose: r.gpu ?? null,
  excerptWindows: Array.isArray(r.win) ? r.win.length : null,
  hasItems: withItems.has(r.id),
  outsidePct: null, // 본문을 재야 나온다 — 이 스캔은 본문을 안 받는다
})

// ── 훑기 ──────────────────────────────────────────────────────────
const perBand = new Map() // v_level → 판정 배열
const perSourceBlocked = new Map() // source → 조판 불가 편수
const all = []
let cursor = null
for (;;) {
  const rows = await page(cursor)
  if (!rows.length) break
  for (const r of rows) {
    const v = judgeSource(toInput(r))
    all.push(v)
    const band = r.article_v_level ?? 0
    if (!perBand.has(band)) perBand.set(band, [])
    perBand.get(band).push(v)
    if (v.grade !== 'usable' && v.grade !== 'excerpt') {
      const s = r.source ?? '(없음)'
      perSourceBlocked.set(s, (perSourceBlocked.get(s) ?? 0) + 1)
    }
  }
  cursor = rows[rows.length - 1].id
  process.stderr.write(`  판정 ${all.length.toLocaleString()}\r`)
  if (rows.length < 1000) break
}
process.stderr.write('\n')

const total = tallyEligibility(all)
const elapsed = ((Date.now() - started) / 1000).toFixed(1)

// ── 출력 ──────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n)
const num = (n, w = 7) => n.toLocaleString().padStart(w)

console.log(`\n원문 적격 판정 — 규격 v${ELIGIBILITY_SPEC_VERSION} · 조판 풀 ${total.total.toLocaleString()}편 · ${elapsed}초\n`)
console.log(`  ${pad('등급', 16)}${num('편수')}   비율    다음에 할 일`)
console.log('  ' + '─'.repeat(94))
for (const [grade, n] of Object.entries(total.byGrade)) {
  const pct = total.total ? ((n / total.total) * 100).toFixed(1) : '0.0'
  console.log(`  ${pad(GRADE_LABEL[grade], 16)}${num(n)}  ${pct.padStart(5)}%   ${GRADE_NEXT_STEP[grade]}`)
}
console.log('  ' + '─'.repeat(94))
console.log(`  ${pad('조판 가능', 16)}${num(total.composable)}  ${String(total.composablePct).padStart(5)}%\n`)

console.log('  탈락 축')
for (const axis of ELIGIBILITY_AXES) {
  const n = total.byBlockedAxis[axis.id] ?? 0
  if (!n) continue
  console.log(`    ${pad(axis.label, 12)}${num(n)}   ${axis.recoverable ? '되돌릴 수 있음' : '되돌릴 수 없음'}   ${axis.source}`)
}

console.log('\n  밴드별')
console.log(`    ${pad('V', 4)}${num('편수')}${num('조판가능')}   비율    ${pad('그대로', 8)}${pad('발췌', 8)}${pad('발췌불가', 9)}${pad('미판정', 8)}${pad('분석없음', 9)}${pad('불가', 8)}`)
const bands = [...perBand.keys()].sort((a, b) => a - b)
for (const b of bands) {
  const t = tallyEligibility(perBand.get(b))
  const g = t.byGrade
  console.log(
    `    ${pad(b || '없음', 4)}${num(t.total)}${num(t.composable)}  ${String(t.composablePct).padStart(5)}%    ` +
      `${pad(g.usable.toLocaleString(), 8)}${pad(g.excerpt.toLocaleString(), 8)}${pad(g['excerpt-blind'].toLocaleString(), 9)}` +
      `${pad(g.unjudged.toLocaleString(), 8)}${pad(g.unknown.toLocaleString(), 9)}${pad(g.blocked.toLocaleString(), 8)}`
  )
}

console.log('\n  조판 불가가 많은 원천')
for (const [s, n] of [...perSourceBlocked.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`    ${pad(s, 20)}${num(n)}`)
}

if (JSON_OUT) {
  // 화면이 이 파일을 읽는다(`apps/web/src/lib/textbook/source-eligibility-snapshot.json`).
  // **화면이 다시 계산하지 않는다** — 여기서 잰 값이 그대로 보여야 화면과 CLI 가 같은 말을 한다.
  const snapshot = {
    measuredAt: new Date().toISOString(),
    specVersion: ELIGIBILITY_SPEC_VERSION,
    elapsedSeconds: Number(elapsed),
    scope: ONLY_BAND ? `V${ONLY_BAND}` : "status in ('ready','published')",
    articlesWithItems: withItems.size,
    total,
    byBand: bands.map((b) => ({ vLevel: b || null, ...tallyEligibility(perBand.get(b)) })),
    blockedBySource: [...perSourceBlocked.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count })),
  }
  fs.writeFileSync(JSON_OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`\n  → ${JSON_OUT}`)
}
