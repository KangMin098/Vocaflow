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

// ⚠️ 예전에는 `.is('compose_batch_id', null)` 로 compose 소속을 통째로 뺐다. 의도는
//   "본문을 보관하지 않는 글은 재분석할 수 없다" 였는데, **거른 축이 틀렸다** — 본문
//   유무는 `content` 가 말하고 아래에서 이미 그것으로 거른다. 배치 소속으로 거르면
//   집필 드레인이 넣은 글(배치에 매달리되 본문을 보관한다)이 통째로 빠져서,
//   새로 쓴 지문이 **어휘도 밴드도 없는 채로 남는다.**
// ⚠️ `.order` 없이 `.range` 를 쓰면 페이지 경계에서 같은 행이 겹치거나 빠진다
//   (PDCP 수집이 정렬 없는 페이지네이션으로 214건을 중복시키고 그만큼 누락한 전례가 있다).
const id = arg('id'), title = arg('title')
/**
 * 어휘가 한 줄도 없는 글만 고른다.
 *
 * **왜 필요한가** — 어휘는 화면에서 그대로 쓰이고 교재 조판에서도 단원 어휘가 된다.
 * 그런데 `ready`/`published` 인데 `library_article_vocabularies` 가 비어 있는 글이 실제로
 * 52편 있었다(2026-08-21 실측). 그런 글이 단원에 들어가면 그 단원만 어휘가 비고,
 * 권 검수의 "단원마다 어휘가 고르다" 가 떨어진다 — **원인이 조판이 아니라 재료에 있다.**
 *
 * ⚠️ 세는 법: `library_article_vocabularies` 를 **5개씩** 나눠 묻는다. 한 번에 크게 물으면
 *   PostgREST 행 상한에 걸려 뒤쪽 글이 전부 "어휘 0" 으로 보인다(200개씩 물었다가 실제로
 *   253/257 이 비었다는 거짓 결과를 얻었다).
 */
const missingVocab = process.argv.includes('--missing-vocab')
if (!id && !title && !missingVocab) {
  console.error('--id · --title · --missing-vocab 중 하나가 필요하다.')
  process.exit(2)
}

// ⚠️ **페이지로 받는다.** PostgREST 는 한 번에 1,000행만 준다. `library_articles` 는
//   5,900행이 넘으므로 페이지 없이 물으면 **뒤쪽 글이 통째로 안 보이고, 그것이
//   "재분석할 것이 없다" 로 읽힌다.** 실측 2026-08-30: 집필 드레인이 새로 넣은 V2 40편이
//   `--missing-vocab` 에 한 편도 안 잡혔고(어휘 0 · 밴드 NULL), 스크립트는 조용히 성공했다.
//   이 파일은 아래 어휘 조회에서만 상한을 알고 있었고 정작 본 목록에는 안 걸어 두었다.
/** 재분석에 필요한 열. 본문이 들어 있어 **행이 넓다** — 그래서 아래처럼 늦게 받는다. */
const FULL_COLS =
  'id, source, source_id, source_url, title, author, language, license, content, published_at, feed_id, status'

/**
 * id 만 커서로 훑는다.
 *
 * ⚠️ **거르기 전에 본문부터 받고 있었다** (실측 2026-09-06). `--missing-vocab` 은
 *   `ready`/`published` **21,839편의 본문을 전부 받아** 놓고 그중 어휘 없는 몇 편만 남겼다.
 *   이 표는 본문을 담아 1,000행당 힙이 ~8 MB 라 175 MB 를 읽는 셈이고, 실제로
 *   statement timeout 으로 **명령 자체가 못 돌았다**(그래서 `--id` 로 한 편씩 우회했다).
 *   순서를 뒤집는다 — **좁은 열로 후보를 좁히고, 살아남은 것만 본문을 받는다.**
 *   OFFSET 도 커서로 바꾼다(`id` 는 pk 라 고유하므로 경계에서 행이 새지 않는다).
 */
async function idsOf(applyFilter) {
  const out = []
  let cursor = null
  for (;;) {
    let p = db.from('library_articles').select('id').order('id').limit(1000)
    p = applyFilter(p)
    if (cursor !== null) p = p.gt('id', cursor)
    const { data, error } = await p
    if (error) throw new Error(error.message)
    if (!data?.length) break
    out.push(...data.map((r) => r.id))
    if (data.length < 1000) break
    cursor = data[data.length - 1].id
  }
  return out
}

/** 넓은 행을 **필요한 것만** 받는다. `IN` 묶음은 작게 — 행이 넓어 한 번에 크게 물으면 걸린다. */
async function fullRows(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await db
      .from('library_articles')
      .select(FULL_COLS)
      .in('id', ids.slice(i, i + 50))
      .order('id')
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
  }
  return out
}

let list
if (missingVocab) {
  // ① 후보 id 만 (좁다)
  const candidates = await idsOf((p) => p.in('status', ['ready', 'published']))
  console.log(`후보 ${candidates.length.toLocaleString()}편 — 어휘 유무를 확인한다`)
  // ② 어휘가 있는 것을 걷어낸다 (아래 §어휘 조회 참조)
  const have = new Set()
  for (let i = 0; i < candidates.length; i += 5) {
    const { data: v, error: ve } = await db
      .from('library_article_vocabularies')
      .select('library_article_id')
      .in('library_article_id', candidates.slice(i, i + 5))
      .limit(20000)
    if (ve) throw new Error('어휘 조회 실패: ' + (ve.message || '(빈 message)'))
    for (const r of v ?? []) have.add(r.library_article_id)
  }
  const missing = candidates.filter((x) => !have.has(x))
  console.log(`어휘 없는 글만 남긴다 — ${candidates.length} → ${missing.length}`)
  // ③ 살아남은 것만 본문을 받는다
  list = (await fullRows(missing)).filter((a) => (a.content ?? '').trim())
} else {
  const ids = await idsOf((p) => (id ? p.eq('id', id) : p.ilike('title', `%${title}%`)))
  list = (await fullRows(ids)).filter((a) => (a.content ?? '').trim())
}

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
