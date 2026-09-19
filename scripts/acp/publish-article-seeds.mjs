// scripts/acp/publish-article-seeds.mjs
//
// ACP 시드(library_article_seed_catalog)를 library_articles 처리 큐에 연결한다.
//   Pipeline: ingest -> INSERT(queued) -> seed link.
//   Analysis belongs to process-queue; publication remains an Admin review action.
//   No synchronous analysis/publication callback runs beside the shared queue.
//
// 실행: pnpm dlx tsx scripts/acp/publish-article-seeds.mjs [--source <name>] [--limit N] [--commit]
//   --source 생략 시 pending 전체. --commit 없으면 dry-run(ingest 만 확인).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Rediscovery links only the seed. A changed body requires an explicit recrawl;
 * queued originals continue through process-queue, never through a new-body callback.
 */
export async function importSeedArticle({ db, article, seed }) {
  if (article.source !== seed.source) throw new Error('Seed source does not match ingested source')
  const { data: existing, error: lookupError } = await db.from('library_articles')
    .select('id,content,status').eq('source', article.source).eq('source_id', article.source_id).maybeSingle()
  if (lookupError) throw new Error(`Existing article lookup: ${lookupError.message}`)
  let articleId = existing?.id
  if (!existing) {
    const pubAt = article.published_at && !Number.isNaN(article.published_at.getTime())
      ? article.published_at.toISOString() : null
    const { data, error } = await db.from('library_articles').insert({
      source: article.source, source_id: article.source_id, title: article.title,
      author: article.author ?? null, source_url: article.source_url, published_at: pubAt,
      license: article.license, content: article.content, audio_url: article.audio_url ?? null,
      status: 'queued', feed_id: seed.feed_id, feed_label: seed.feed_label,
    }).select('id').single()
    // A concurrent insert may have won since lookup. Never analyze its row using
    // this fetch's content; leave the pending seed to retry discovery safely.
    if (error || !data?.id) throw new Error(`Article insert failed; retry discovery: ${error?.message ?? 'missing ID'}`)
    articleId = data.id
  }
  const { error: linkError } = await db.from('library_article_seed_catalog').update({
    imported_to_articles: true, imported_article_id: articleId, imported_at: new Date().toISOString(),
    curation_status: 'enqueued',
  }).eq('source', seed.source).eq('source_url', seed.source_url).eq('curation_status', 'pending')
    .select('source_url').single()
  if (linkError) throw new Error(`Seed link failed: ${linkError.message}`)
  if (existing) return { kind: 'existing', articleId, status: existing.status, bodyChanged: existing.content !== article.content }
  return { kind: 'new', articleId, status: 'queued' }
}

async function main() {

  const envPath = path.resolve('apps/web/.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }

  const commit = process.argv.includes('--commit')
  const si = process.argv.indexOf('--source')
  const onlySource = si >= 0 ? process.argv[si + 1] : null
  const li = process.argv.indexOf('--limit')
  const limit = li >= 0 ? Number(process.argv[li + 1] ?? 'NaN') : Infinity

  const { createClient } = await import('@supabase/supabase-js')
  const pipeline = await import('@vocaflow/library-pipeline')
  const {
    ingestVoaArticle,
    ingestNasaArticle,
    ingestNihArticle,
    ingestSimpleWikipediaArticle,
    ingestTheConversationArticle,
    ingestWikinewsArticle,
    VOA_FEEDS,
  } = pipeline

  // 소스별 본문 ingester (enqueue 라우트와 동일 분기)
  const INGEST = {
    voa: (url, level) => ingestVoaArticle(url, level),
    nasa: (url) => ingestNasaArticle(url),
    nih: (url) => ingestNihArticle(url),
    simple_wikipedia: (url) => ingestSimpleWikipediaArticle(url),
    the_conversation: (url) => ingestTheConversationArticle(url),
    wikinews: (url) => ingestWikinewsArticle(url),
  }

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // rate-limit 회피 throttle — MediaWiki(simple_wikipedia/wikinews)는 연속 요청 시 429.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const di = process.argv.indexOf('--delay')
  const delayFor = (src) =>
    di >= 0 ? Number(process.argv[di + 1] ?? '0') : src === 'simple_wikipedia' || src === 'wikinews' ? 1500 : 500

  let q = db
    .from('library_article_seed_catalog')
    .select('source, feed_id, feed_label, source_url, title')
    .eq('curation_status', 'pending')
    .order('source', { ascending: true })
    .order('feed_label', { ascending: true })
  if (onlySource) q = q.eq('source', onlySource)
  const { data: seeds, error: seedErr } = await q
  if (seedErr) {
    console.error('seed fetch failed:', seedErr.message)
    process.exit(1)
  }
  const targets = (seeds ?? []).slice(0, Number.isFinite(limit) ? limit : undefined)
  console.log(
    `[publish] source=${onlySource ?? 'ALL'} · pending=${seeds?.length ?? 0} · 대상=${targets.length} · commit=${commit}`,
  )

  let ok = 0
  let fail = 0
  let linkedExisting = 0

  for (const [i, seed] of targets.entries()) {
    const tag = `[${i + 1}/${targets.length}] ${seed.source} · ${seed.feed_label ?? '(no feed)'} · …${(seed.source_url ?? '').slice(-40)}`
    try {
      const ingest = INGEST[seed.source]
      if (!ingest) throw new Error(`no ingester for source: ${seed.source}`)
      const feed = seed.source === 'voa' && seed.feed_id ? VOA_FEEDS.find((f) => f.id === seed.feed_id) : undefined
      const article = await ingest(seed.source_url, feed?.level)

      if (!commit) {
        console.log(`  ${tag}\n    → DRY ok: "${(article.title ?? '').slice(0, 50)}" ${article.content.length}c audio=${!!article.audio_url}`)
        ok++
        continue
      }

      const outcome = await importSeedArticle({ db, article, seed })
      if (outcome.kind === 'new') {
        ok++
        console.log(`  ${tag}\n    → QUEUED · 분석은 process-queue, 발행은 Admin 검수에서 진행`)
      }
      if (outcome.kind === 'existing') {
        linkedExisting++
        console.log(`  ${tag}\n    → LINKED existing ${outcome.status}; 원문·분석·게시 상태 보존` +
          (outcome.bodyChanged ? ' · 수집 본문이 다름: 별도 재수집 검토 필요' : '') +
          (outcome.status === 'queued' ? ' · 분석은 process-queue에서 처리' : ''))
      }
    } catch (e) {
      console.error(`  ${tag}\n    → FAIL: ${e instanceof Error ? e.message : String(e)}`)
      fail++
    }
    if (i < targets.length - 1) await sleep(delayFor(seed.source))
  }

  console.log(`\n[publish] done — queued/dry=${ok} · linked existing=${linkedExisting} · fail=${fail}`)
  if (fail) process.exitCode = 1
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath && path.normalize(invokedPath).toLowerCase() === path.normalize(fileURLToPath(import.meta.url)).toLowerCase()) {
  await main()
}
