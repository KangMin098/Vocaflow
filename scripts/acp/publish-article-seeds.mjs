// scripts/acp/publish-article-seeds.mjs
//
// ACP 시드(library_article_seed_catalog, feed 프로그램별)를 library_articles 로 발행 — 범용.
//   파이프라인: ingest(live) → INSERT(queued) → seed 마킹 → normalize
//              → analyzeArticle(skipLlm) → compute_article_vrl → ready → publish.
//   feed_label 승계. service_role 직접 쓰기(admin RPC 우회 — force-publish 라우트 동등).
//   게이트: copyright_safe_in_kr=true (+ VOA 만 audio_url 필수). The Conversation=display_only.
//
// 실행: pnpm dlx tsx scripts/acp/publish-article-seeds.mjs [--source <name>] [--limit N] [--commit]
//   --source 생략 시 pending 전체. --commit 없으면 dry-run(ingest 만 확인).

import fs from 'node:fs'
import path from 'node:path'

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
  analyzeArticle,
  computeLexicalNoise,
  normalizePunctuation,
  reflowSoftHyphens,
} = pipeline

// ACP §18 §4-B — 소스별 register 기본값 (dev-process 와 동일)
const REGISTER_BY_SOURCE = {
  voa: 'news',
  nasa: 'expository',
  nih: 'expository',
  simple_wikipedia: 'expository',
  the_conversation: 'argumentative',
  wikinews: 'news',
}

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

const crypto = await import('crypto')
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

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
let skip = 0
let fail = 0

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

    // dedupe → INSERT(queued) + feed_label
    const { data: existing } = await db
      .from('library_articles')
      .select('id')
      .eq('source', article.source)
      .eq('source_id', article.source_id)
      .maybeSingle()

    let articleId
    if (existing) {
      articleId = existing.id
      await db
        .from('library_articles')
        .update({ feed_id: seed.feed_id, feed_label: seed.feed_label })
        .eq('id', articleId)
        .is('feed_label', null)
    } else {
      const pubAt =
        article.published_at && !Number.isNaN(article.published_at.getTime())
          ? article.published_at.toISOString()
          : null
      const { data: ins, error: insErr } = await db
        .from('library_articles')
        .insert({
          source: article.source,
          source_id: article.source_id,
          title: article.title,
          author: article.author ?? null,
          source_url: article.source_url,
          published_at: pubAt,
          license: article.license,
          content: article.content,
          audio_url: article.audio_url ?? null,
          status: 'queued',
          feed_id: seed.feed_id,
          feed_label: seed.feed_label,
        })
        .select('id')
        .single()
      if (insErr) throw new Error('insert: ' + insErr.message)
      articleId = ins.id
    }

    await db
      .from('library_article_seed_catalog')
      .update({
        imported_to_articles: true,
        imported_article_id: articleId,
        imported_at: new Date().toISOString(),
        curation_status: 'enqueued',
      })
      .eq('source', article.source)
      .eq('source_url', seed.source_url)

    // normalize + analyze(skipLlm) + VRL → ready
    const bodyText = reflowSoftHyphens(normalizePunctuation(article.content))
    const norm = {
      raw: {
        source: article.source,
        source_id: article.source_id,
        source_url: article.source_url,
        title: article.title,
        author: article.author ?? undefined,
        language: 'en',
        license: article.license,
        published_at: article.published_at ?? null,
        content: article.content,
        estimated_cefr: null,
        fetched_at: new Date(),
      },
      body: bodyText,
      body_hash: sha256(bodyText),
    }
    const result = await analyzeArticle(articleId, norm, { skipLlm: true })
    const { error: vrlErr } = await db.rpc('compute_article_vrl', { p_article_id: articleId })
    if (vrlErr) console.warn(`     vrl warn: ${vrlErr.message}`)
    const noise = computeLexicalNoise(bodyText)
    await db
      .from('library_articles')
      .update({
        cefr_level: result.cefr_level,
        cefr_confidence: result.cefr_confidence,
        word_count: result.word_count,
        reading_minutes: result.reading_minutes,
        llm_cost_usd: result.llm_cost_usd,
        register: REGISTER_BY_SOURCE[article.source] ?? null,
        lexical_noise: noise,
        status: 'ready',
        content_hash: norm.body_hash,
        status_message: noise > 0.08 ? `lexical_noise ${noise} > 0.08 — 단어세트 미발행(읽기용)` : null,
      })
      .eq('id', articleId)

    // force-publish 게이트 (copyright + VOA 만 audio)
    const { data: a2 } = await db
      .from('library_articles')
      .select('copyright_safe_in_kr, audio_url, status, display_only')
      .eq('id', articleId)
      .single()
    if (!a2?.copyright_safe_in_kr) {
      console.log(`  ${tag}\n    → ready(발행 보류): 저작권 미확인`)
      skip++
      continue
    }
    if (article.source === 'voa' && !(a2.audio_url && a2.audio_url.trim())) {
      console.log(`  ${tag}\n    → ready(발행 보류): VOA 오디오 없음`)
      skip++
      continue
    }
    if (a2.status !== 'published') {
      await db
        .from('library_articles')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', articleId)
    }
    console.log(
      `  ${tag}\n    → PUBLISHED · cefr=${result.cefr_level} · ${result.word_count}w · vocab=${result.words.length}${a2.display_only ? ' · display_only' : ''}`,
    )
    ok++
  } catch (e) {
    console.error(`  ${tag}\n    → FAIL: ${e instanceof Error ? e.message : String(e)}`)
    fail++
  }
  if (i < targets.length - 1) await sleep(delayFor(seed.source))
}

console.log(`\n[publish] done — ok/published=${ok} · skip=${skip} · fail=${fail}`)
