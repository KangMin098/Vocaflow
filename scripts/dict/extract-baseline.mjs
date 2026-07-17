// scripts/dict/extract-baseline.mjs
// 추출 경로 통합(1단계) 전/후 비교용 baseline 덤프.
//   각 도서/글의 현재 추출 결과(study 단어 = sort_order<=40)를 단어 집합으로 저장.
//   통합 마이그 적용 후 재실행 → diff 로 "뽑히는 단어가 얼마나 바뀌나" 확인(발행 단어장 영향 파악).
// 사용: node scripts/dict/extract-baseline.mjs --out scripts/dict/data/extract-baseline.json
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'scripts/dict/data/extract-baseline.json')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const out = { books: {}, articles: {}, meta: {} }
// 도서
const { data: books } = await db.from('library_books').select('id, title')
for (const b of books ?? []) {
  const { data, error } = await db.rpc('select_book_chapter_vocab', { p_book_id: b.id })
  if (error || !data) continue
  const words = data.filter((r) => r.sort_order <= 40).map((r) => `${r.chapter_idx}:${r.word}`).sort()
  if (words.length) out.books[b.id] = { title: b.title, n: words.length, words }
}
// 글
const { data: arts } = await db.from('library_articles').select('id, title')
for (const a of arts ?? []) {
  const { data, error } = await db.rpc('select_article_vocab', { p_article_id: a.id })
  if (error || !data) continue
  const words = data.filter((r) => r.sort_order <= 40).map((r) => r.word).sort()
  if (words.length) out.articles[a.id] = { title: a.title, n: words.length, words }
}
out.meta = {
  books: Object.keys(out.books).length, articles: Object.keys(out.articles).length,
  book_words: Object.values(out.books).reduce((s, x) => s + x.n, 0),
  article_words: Object.values(out.articles).reduce((s, x) => s + x.n, 0),
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log('baseline:', JSON.stringify(out.meta), '→', OUT)
