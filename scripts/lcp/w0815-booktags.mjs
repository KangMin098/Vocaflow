// scripts/lcp/w0815-booktags.mjs
// T4a — library_books.category_tags 채움 (실측 0/401). 도서 검색 search_vector 의 C 가중치가 통째로 비어 있다.
//   태그는 자유 문자열이 아니라 아래 고정 어휘에서만 고른다 — 자유 입력이면 같은 장르가 철자별로 갈려
//   GIN 인덱스가 있어도 검색이 안 붙는다(articles 쪽이 아예 비어 있어 기존 관례는 없음 → 여기서 정의).
//   chunk : 제목·저자·연도·V-Level·챕터수·본문 도입부를 근거로 넘긴다(제목만으로는 오분류가 잦다).
//   apply : 고정 어휘 교집합만 채택 · 2~5개 · 이미 태그가 있으면 스킵(멱등).
// 실행: node scripts/lcp/w0815-booktags.mjs chunk [--dir D] [--size 40] [--all]
//       node scripts/lcp/w0815-booktags.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/lcp/w0815-booktags')
const SIZE = parseInt(arg('--size', '40'), 10)
const COMMIT = process.argv.includes('--commit')
const ALL = process.argv.includes('--all')

// 고정 태그 어휘 — vocaflow_domains 8종에 문학 장르/형식을 더한 것. 여기 없는 값은 apply 가 버린다.
export const TAG_VOCAB = new Set([
  // 형식
  'fiction', 'nonfiction', 'short-story', 'poetry', 'drama', 'essay', 'textbook', 'reference', 'biography', 'letters', 'speech',
  // 장르
  'adventure', 'mystery', 'detective', 'romance', 'historical', 'fantasy', 'science-fiction', 'horror', 'satire', 'humor',
  'coming-of-age', 'fairy-tale', 'fable', 'myth-legend', 'war', 'travel', 'nature', 'philosophy', 'religion', 'politics',
  // 도메인(vocaflow_domains 정렬)
  'academic', 'business', 'entertainment', 'general', 'literature', 'news-media', 'science-tech', 'travel-culture',
  // 독자
  'children', 'young-adult', 'adult', 'classic', 'contemporary',
])

if (MODE === 'chunk') {
  let q = db.from('library_books').select('id, title, author, original_publish_year, book_v_level, chapter_count, word_count, cefr_level, category_tags, status')
  if (!ALL) q = q.in('status', ['published', 'ready'])
  const { data, error } = await q
  if (error) { console.error(error.message); process.exit(1) }
  const todo = data.filter((b) => !(b.category_tags && b.category_tags.length))

  // 근거 = 1챕터 도입부(제목만으로는 오분류가 잦다)
  const items = []
  for (const b of todo) {
    const { data: ch } = await db.from('library_chapters_master')
      .select('chapter_title, content_hash').eq('library_book_id', b.id).order('chapter_idx').limit(1)
    let opening = ''
    if (ch && ch[0]?.content_hash) {
      const { data: cc } = await db.from('content_chunks').select('content').eq('hash', ch[0].content_hash).limit(1)
      if (cc && cc[0]?.content) opening = String(cc[0].content).slice(0, 500)
    }
    items.push({
      id: b.id, title: b.title, author: b.author, year: b.original_publish_year,
      v_level: b.book_v_level, chapters: b.chapter_count, words: b.word_count, cefr: b.cefr_level,
      first_chapter_title: ch?.[0]?.chapter_title ?? null, opening,
    })
  }
  fs.mkdirSync(DIR, { recursive: true })
  for (const f of fs.readdirSync(DIR)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(DIR, f))
  fs.writeFileSync(path.join(DIR, 'TAG_VOCAB.json'), JSON.stringify([...TAG_VOCAB], null, 1))
  let n = 0
  for (let i = 0; i < items.length; i += SIZE) {
    fs.writeFileSync(path.join(DIR, `chunk-${String(n).padStart(2, '0')}.json`), JSON.stringify(items.slice(i, i + SIZE), null, 1))
    n++
  }
  console.log(`booktags targets: ${items.length} · chunks: ${n} → ${DIR}/chunk-NN.json (+ TAG_VOCAB.json)`)
  process.exit(0)
}

if (MODE === 'apply') {
  const rows = []
  let files = 0
  for (const f of fs.readdirSync(DIR)) {
    if (!/\.out\.json$/.test(f)) continue
    files++
    try { const a = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); if (Array.isArray(a)) rows.push(...a) } catch { console.warn('parse fail', f) }
  }
  const items = new Map()
  let bad = 0, offVocab = 0
  for (const e of rows) {
    if (!e || typeof e.id !== 'string' || !Array.isArray(e.category_tags)) { bad++; continue }
    const raw = [...new Set(e.category_tags.map((t) => String(t ?? '').trim().toLowerCase()))]
    const tags = raw.filter((t) => TAG_VOCAB.has(t))
    offVocab += raw.length - tags.length
    if (tags.length < 2) { bad++; continue }
    items.set(e.id, tags.slice(0, 5))
  }
  console.log(`files: ${files} · books: ${items.size} · rejected: ${bad} · off-vocab tags dropped: ${offVocab}`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [id, t] of items) { if (n++ >= 10) break; console.log(' ', id.slice(0, 8), t.join(', ')) }
    process.exit(0)
  }

  let done = 0, failed = 0, skipped = 0
  for (const [id, tags] of items) {
    const { data: cur } = await db.from('library_books').select('category_tags').eq('id', id).single()
    if (cur?.category_tags?.length) { skipped++; continue }
    const { error } = await db.from('library_books').update({ category_tags: tags }).eq('id', id)
    if (error) { failed++; if (failed < 5) console.warn(id, error.message) } else done++
  }
  console.log(`updated: ${done} · already tagged (skip): ${skipped} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/lcp/w0815-booktags.mjs chunk|apply [--dir D] [--size N] [--all] [--commit]')
process.exit(1)
