// scripts/dict/w0815-pubvocab.mjs
// 발행 도서 어휘 집합 로더 — w0815 배치 3종(gapword · note · synant)의 공통 대상 정의.
//   "학습자가 실제로 만나는 단어"만 보강하기 위해 published 도서의 library_book_vocabularies 를
//   lemma 단위로 집계한다(노이즈 제외). 전수 45,699 대신 ~17K 로 대상을 좁히는 것이 이 배치의 전제.
//   반환: Map(lemma → {freq, books:Set<title>, sentence})  — sentence = 최다빈도 챕터의 first_sentence.
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
export const db = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'],
  process.env['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { persistSession: false } },
)

/** 발행 도서 목록 (id → title). */
export async function publishedBooks() {
  const { data, error } = await db.from('library_books').select('id, title, book_v_level').eq('status', 'published')
  if (error) throw new Error(error.message)
  return new Map(data.map((b) => [b.id, { title: b.title, v: b.book_v_level }]))
}

/** 발행 도서 어휘 집계 — lemma → {freq, books:string[], sentence}. */
export async function publishedVocab() {
  const books = await publishedBooks()
  const agg = new Map()
  for (const [bookId, meta] of books) {
    let from = 0
    for (;;) {
      const { data, error } = await db.from('library_book_vocabularies')
        .select('word, lemma, frequency_in_chapter, first_sentence, noise_kind')
        .eq('library_book_id', bookId).range(from, from + 999)
      if (error) throw new Error(error.message)
      if (!data.length) break
      for (const r of data) {
        if (r.noise_kind) continue
        const lem = (r.lemma || r.word || '').toLowerCase().trim()
        if (!lem) continue
        const e = agg.get(lem) ?? { freq: 0, books: new Set(), sentence: '', best: 0 }
        e.freq += r.frequency_in_chapter ?? 1
        e.books.add(meta.title)
        if ((r.frequency_in_chapter ?? 1) > e.best && r.first_sentence) {
          e.best = r.frequency_in_chapter ?? 1
          e.sentence = r.first_sentence
        }
        agg.set(lem, e)
      }
      if (data.length < 1000) break
      from += 1000
    }
  }
  return agg
}

/** shared_dictionary 존재 여부 배치 조회 — words[] → Map(word → row|null). select 는 컬럼 목록. */
export async function dictRows(words, select) {
  const out = new Map()
  for (let i = 0; i < words.length; i += 200) {
    const slice = words.slice(i, i + 200)
    const { data, error } = await db.from('shared_dictionary').select(select).in('word', slice)
    if (error) throw new Error(error.message)
    for (const r of data) out.set(r.word.toLowerCase(), r)
  }
  return out
}

/** 청크 파일 쓰기 — 기존 chunk-NN.json 을 정리하고 새로 굽는다(out.json 은 보존). */
export function writeChunks(dir, items, size) {
  fs.mkdirSync(dir, { recursive: true })
  for (const f of fs.readdirSync(dir)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(dir, f))
  let n = 0
  for (let i = 0; i < items.length; i += size) {
    fs.writeFileSync(path.join(dir, `chunk-${String(n).padStart(2, '0')}.json`), JSON.stringify(items.slice(i, i + size), null, 1))
    n++
  }
  return n
}

/** *.out.json 수집 — 배열만 반환(파싱 실패는 경고 후 건너뜀). */
export function readOuts(dir) {
  const rows = []
  let files = 0
  for (const f of fs.readdirSync(dir)) {
    if (!/\.out\.json$/.test(f)) continue
    files++
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (Array.isArray(arr)) rows.push(...arr)
    } catch { console.warn('parse fail:', f) }
  }
  return { files, rows }
}
