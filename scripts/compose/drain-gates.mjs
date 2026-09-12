// scripts/compose/drain-gates.mjs
//
// ACP §20 재저작 드레인 — ⑨ 게이트 실행·기록 단계.
//   재저작 게이트 6종(I12~I17)을 실제 소스 지문으로 돌려 판정을 본문 해시와 함께 저장한다.
//
// 왜 스크립트인가: 이 단계는 지금까지 일회성 파일로만 돌렸다. 상설 경로가 없으면
//   ① 본문을 고친 뒤 다시 못 돌리고 ② 매번 손으로 짠 입력이 달라져 판정이 재현되지 않는다.
//   실제로 첫 실행 때 두 판에 **같은 사실 순서**를 넣어 I14 를 잘못 측정했다.
//
// 사실 순서(I14 의 재료)는 `composed_spec.fact_order` 에서 읽는다 — 드레인이 글을 쓸 때
//   반드시 기록해야 하는 값이다. 없으면 I14 를 계산하지 않고 그렇게 말한다(조용히 통과시키지 않는다).
//
// 대조군(서가)은 외부 소스와 **다른 자리**로 넘긴다 — 같은 자리에 넣으면 우리 글이
//   외부 취재로 계산돼 I12 출처 독립성이 부풀려진다.
//
// 재실행 안전: 같은 본문이면 같은 판정이 나오고 기존 행을 덮어쓴다(article_id+invariant 키).
//
// 실행: pnpm dlx tsx scripts/compose/drain-gates.mjs --batch <uuid> [--commit]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const commit = process.argv.includes('--commit')
const bi = process.argv.indexOf('--batch')
const batchId = bi >= 0 ? process.argv[bi + 1] : null
if (!batchId) {
  console.error('--batch <uuid> 가 필요합니다.')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { runComposeGates, shelfRecordFrom, normalizePunctuation, reflowSoftHyphens } =
  await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

const { data: batch } = await db
  .from('article_compose_batches')
  .select('id,topic,event_occurred_at')
  .eq('id', batchId)
  .single()
if (!batch) throw new Error('취재 묶음을 찾을 수 없습니다: ' + batchId)
if (!batch.event_occurred_at) throw new Error('사건 시각이 비어 있습니다 — I15 를 계산할 수 없습니다.')

const { data: srcRows } = await db
  .from('article_compose_sources')
  .select('id,publisher,url,published_at,fingerprint')
  .eq('batch_id', batchId)
const sources = (srcRows ?? []).map((r) => ({
  id: r.id,
  publisher: r.publisher,
  url: r.url,
  published_at: r.published_at ?? '',
  fingerprint: r.fingerprint,
}))

const { data: factRows } = await db
  .from('article_fact_ledger')
  .select('id,claim,kind,quote,quote_is_public')
  .eq('batch_id', batchId)
const factIds = (factRows ?? []).map((f) => f.id)
const { data: attRows } = await db
  .from('article_fact_attestation')
  .select('fact_id,source_id,ordinal')
  .in('fact_id', factIds.length ? factIds : ['00000000-0000-0000-0000-000000000000'])
const facts = (factRows ?? []).map((f) => ({
  id: f.id,
  claim: f.claim,
  kind: f.kind,
  quote: f.quote ?? undefined,
  quote_is_public: f.quote_is_public ?? undefined,
  attestations: (attRows ?? [])
    .filter((a) => a.fact_id === f.id)
    .map((a) => ({ source_id: a.source_id, ordinal: a.ordinal })),
}))

const { data: arts } = await db
  .from('library_articles')
  .select('id,title,source,content,composed_spec,status')
  .eq('compose_batch_id', batchId)
if (!arts?.length) throw new Error('이 묶음으로 쓴 아티클이 없습니다.')

// 서가 대조군 — 같은 묶음의 형제 판 + 같은 사건을 ACP 가 본문으로 가져간 글.
// 소스 URL 이 겹치는 ACP 글을 찾는다(사실 출처 9곳이 ACP 와 겹치므로 실제로 생긴다).
const srcUrls = sources.map((s) => s.url)
const { data: acpSame } = srcUrls.length
  ? await db
      .from('library_articles')
      .select('id,title,source,content')
      .in('source_url', srcUrls)
      .neq('source', 'original')
  : { data: [] }

console.log(`취재 묶음: ${batch.topic}`)
console.log(`소스 ${sources.length} · 사실 ${facts.length} · 아티클 ${arts.length} · ACP 중복 후보 ${(acpSame ?? []).length}\n`)

let blocked = 0
for (const a of arts) {
  const spec = a.composed_spec ?? {}
  const order = Array.isArray(spec.fact_order) ? spec.fact_order : null
  const body = reflowSoftHyphens(normalizePunctuation(a.content ?? ''))
  const hash = sha256(body)

  console.log(`▸ ${a.title}`)
  if (!order) {
    console.log('  ⚠ composed_spec.fact_order 가 없습니다 — I14 구조 독립성을 계산할 수 없습니다.')
    console.log('    드레인이 글을 쓸 때 사용한 사실 순서를 기록해야 합니다. 건너뜁니다.\n')
    blocked++
    continue
  }

  const shelf = [
    ...arts.filter((o) => o.id !== a.id),
    ...(acpSame ?? []),
  ].map((o) => shelfRecordFrom({ id: o.id, title: o.title, source: o.source, content: o.content ?? '' }))

  const res = runComposeGates({
    draft: { text: body, fact_order: order, event_occurred_at: batch.event_occurred_at },
    facts,
    sources,
    shelf,
  })

  for (const g of res) {
    const mark = g.verdict === 'PASS' ? ' ' : g.verdict === 'WARN' ? '!' : '✗'
    console.log(`  ${mark} ${g.verdict.padEnd(4)} ${g.invariant} — ${g.detail}`)
  }
  if (res.some((g) => g.verdict === 'FAIL')) blocked++

  if (commit) {
    const rows = res.map((g) => ({
      article_id: a.id,
      invariant: g.invariant,
      severity: 'critical',
      verdict: g.verdict,
      detail: g.detail,
      content_hash: hash,
    }))
    const { error } = await db
      .from('article_compose_gates')
      .upsert(rows, { onConflict: 'article_id,invariant' })
    if (error) throw new Error('게이트 저장 실패: ' + error.message)
    console.log(`  → 판정 ${rows.length}행 저장 (해시 ${hash.slice(0, 12)}…)`)
  }
  console.log()
}

console.log(commit ? `완료. 발행 차단 ${blocked}건.` : '\n--commit 을 붙이면 판정을 저장합니다.')
