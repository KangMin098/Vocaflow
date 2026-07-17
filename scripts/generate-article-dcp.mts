// scripts/generate-article-dcp.mts
//
// CTP DCP 아티클 드레인 — 발행 아티클(파생 가능) 본문 → 결정론 order/insert 문항 생성·upsert.
// 배경: dev-generate-items 라우트는 기본 register=argumentative·limit 20 로만 돌아 아티클 DCP 가
//   v5 argumentative 7편에 머물렀다. 본 스크립트는 동일 입력 게이트(설계 §T2)를 전 register·무제한으로
//   적용해 CSAT 핵심대(expository v4~v6) 를 포함한 전 적격 아티클로 확대한다(v06.228).
// 관행: Claude Code 수동 콘텐츠 드레인. 런타임 LLM 0(generateDcpItems 결정론·멱등).
//   시맨틱은 dev-generate-items 라우트와 정확히 동일 — seed=source_id, ref_id=id, onConflict upsert.
//
// 입력 게이트(파생 가능 콘텐츠만): status=published + NOT display_only + license PD/CC + lexical_noise≤0.08.
//   register 는 게이트가 아님(문항 품질은 generateDcpItems 의 문단 적격 필터가 담보) → 전 register 처리.
//
// 실행:  node_modules/.bin/tsx scripts/generate-article-dcp.mts            (dry-run — 산출량만 보고)
//        node_modules/.bin/tsx scripts/generate-article-dcp.mts --apply    (실제 upsert)
//   (idempotent — onConflict(kind,ref_id,type,paragraph_idx) upsert 로 재실행 안전)

import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import { generateDcpItems } from '@vocaflow/library-pipeline'

// ── env (.env.local 파싱 — dotenv 의존 없이) ──
function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m) out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnv('apps/web/.env.local')
const url = env['NEXT_PUBLIC_SUPABASE_URL']
const key = env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}
const APPLY = process.argv.includes('--apply')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

interface Article {
  id: string
  source_id: string
  content: string | null
  article_v_level: number | null
  register: string | null
}

interface DcpRow {
  kind: 'article'
  ref_id: string
  type: string
  item_role: 'practice'
  payload: Record<string, unknown>
  answer_key: Record<string, unknown>
  paragraph_idx: number
  v_level: number | null
}

console.log(`CTP DCP 아티클 드레인 ${APPLY ? '[APPLY]' : '[DRY-RUN]'} 시작…`)

// 파생 가능 콘텐츠 게이트 — dev-generate-items 라우트와 동일(register 제한만 제거).
const { data: rawArticles, error: qErr } = await db
  .from('library_articles')
  .select('id, source_id, content, article_v_level, register')
  .eq('status', 'published')
  .eq('display_only', false)
  .in('license_class', ['public_domain', 'cc0', 'cc_by', 'cc_by_sa'])
  .lte('lexical_noise', 0.08)
  .order('article_v_level', { ascending: true })
if (qErr) {
  console.error('아티클 조회 실패:', qErr.message)
  process.exit(1)
}
const articles = (rawArticles ?? []) as Article[]
console.log(`적격 아티클 ${articles.length}편 (전 register)`)

// register×v_level 산출량 집계
const byRegVLevel = new Map<string, { articles: number; items: number; withItems: number }>()
let totalItems = 0
let totalArticlesWithItems = 0
const errors: string[] = []

for (const a of articles) {
  const items = generateDcpItems(a.content ?? '', a.source_id)
  const bucket = `${a.register ?? '?'} v${a.article_v_level ?? '?'}`
  const agg = byRegVLevel.get(bucket) ?? { articles: 0, items: 0, withItems: 0 }
  agg.articles += 1
  agg.items += items.length
  if (items.length > 0) agg.withItems += 1
  byRegVLevel.set(bucket, agg)

  if (items.length === 0) continue
  totalArticlesWithItems += 1
  totalItems += items.length

  if (!APPLY) continue

  const rows: DcpRow[] = items.map((it) => ({
    kind: 'article',
    ref_id: a.id,
    type: it.type,
    item_role: 'practice',
    payload: it.payload,
    answer_key: it.answer_key,
    paragraph_idx: it.paragraph_idx,
    v_level: a.article_v_level,
  }))
  const { error } = await db
    .from('csat_dcp_items')
    .upsert(rows, { onConflict: 'kind,ref_id,type,paragraph_idx' })
  if (error) errors.push(`${a.id.slice(0, 8)} (${bucket}): ${error.message}`)
}

console.log('\n── register × v_level 산출량 ──')
for (const [bucket, agg] of [...byRegVLevel.entries()].sort()) {
  console.log(
    `  ${bucket.padEnd(18)} 아티클 ${agg.articles} → 문항생성 ${agg.withItems}편 · ${agg.items} items`,
  )
}
console.log(
  `\n합계: 아티클 ${articles.length}편 중 ${totalArticlesWithItems}편에서 ${totalItems} items ` +
    `(order+insert). ${APPLY ? `upsert 완료${errors.length ? ` · 에러 ${errors.length}` : ''}` : 'DRY-RUN (미기록)'}`,
)
if (errors.length) {
  console.log('에러:')
  for (const e of errors) console.log(`  ${e}`)
}
console.log('완료.')
