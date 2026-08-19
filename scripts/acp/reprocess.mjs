// scripts/acp/reprocess.mjs
//
// **이미 처리된 글을 다시 분석한다.** 정규화·분석 규칙을 고쳤을 때 쓴다.
//
// `process-queue.mjs` 는 `queued` 만 집으므로 이미 `ready`/`published` 인 글은 손대지 않는다.
// 규칙을 고치면 그 글들은 낡은 결과를 그대로 들고 있는데, 어휘 목록은 화면에서 그대로 쓰인다.
//
// ⚠️ `analyzeArticle` 이 해당 글의 `library_article_vocabularies` 를 지우고 다시 넣는다(멱등).
//    발행 상태(`status`)는 건드리지 않는다 — 재분석은 검수 결과를 뒤집는 일이 아니다.
//
// 실행:
//   pnpm dlx tsx scripts/acp/reprocess.mjs --id <uuid> [--id ...]
//   pnpm dlx tsx scripts/acp/reprocess.mjs --title "Root Words" --commit

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : null }
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const { analyzeArticle, computeLexicalNoise, normalizePunctuation, reflowSoftHyphens,
        resolveArticleRegister, assessReadingLoad } = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

let q = db.from('library_articles')
  .select('id, source, source_id, source_url, title, author, language, license, content, published_at, feed_id, status')
  .is('compose_batch_id', null)
const id = arg('id'), title = arg('title')
if (id) q = q.eq('id', id)
else if (title) q = q.ilike('title', `%${title}%`)
else { console.error('--id 또는 --title 이 필요하다.'); process.exit(2) }

const { data, error } = await q
if (error) throw new Error(error.message)
const list = (data ?? []).filter((a) => (a.content ?? '').trim())
console.log(`대상 ${list.length}편`)
for (const a of list) console.log(`  · ${a.status.padEnd(10)} ${String(a.title).slice(0, 60)}`)
if (!commit) { console.log('\n--commit 을 붙이면 재분석한다.'); process.exit(0) }

for (const a of list) {
  // 기사 경로와 **같은 설정**이어야 한다 — 다르면 재분석이 또 다른 결과를 만든다.
  const bodyText = reflowSoftHyphens(normalizePunctuation(a.content ?? ''), { joinHyphenLineBreaks: false })
  const norm = {
    raw: { source: a.source, source_id: a.source_id, source_url: a.source_url ?? '', title: a.title,
           author: a.author ?? undefined, language: a.language ?? 'en', license: a.license,
           published_at: a.published_at ? new Date(a.published_at) : null, content: a.content,
           estimated_cefr: null, fetched_at: new Date() },
    body: bodyText, body_hash: sha256(bodyText),
  }
  const result = await analyzeArticle(a.id, norm)
  await db.rpc('compute_article_vrl', { p_article_id: a.id })
  await db.rpc('compute_article_syntax', { p_article_id: a.id })
  const noise = computeLexicalNoise(bodyText)
  const { error: e } = await db.from('library_articles').update({
    cefr_level: result.cefr_level, cefr_confidence: result.cefr_confidence,
    word_count: result.word_count, reading_minutes: result.reading_minutes,
    register: resolveArticleRegister(a.source, a.feed_id ?? null), lexical_noise: noise,
    status_message: [
      noise > 0.08 ? `lexical_noise ${noise} > 0.08 — 단어세트 미발행(읽기용)` : null,
      assessReadingLoad(result.word_count).note,
    ].filter(Boolean).join(' · ') || null,
    content_hash: norm.body_hash,
  }).eq('id', a.id)
  if (e) console.log(`  ✗ ${a.id}: ${e.message}`)
  else console.log(`  ✓ ${result.cefr_level} · ${result.word_count}어 · 어휘 ${result.words.length}`)
}
