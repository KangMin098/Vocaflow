// scripts/lcp/audit-catalog-scale.mjs
//
// 학습자 도서 카탈로그(/library/books)가 **발행 권수가 늘어도 버티는지** 실측한다.
//
// 왜 필요한가: 그 페이지는 발행 도서를 상한 없이 전량 가져온 뒤,
//   그 id 목록을 `.in(...)` 으로 3~4개 후속 쿼리에 그대로 넘긴다. 13권에서는 아무 문제가 없다.
//   권수가 늘면 두 가지가 조용히 깨진다 —
//     ① `.in()` 은 PostgREST GET 쿼리스트링이라 id 가 늘수록 URL 이 길어진다(414/게이트웨이 상한).
//     ② 챕터 단어장 조회는 **개수를 세려고** 행을 전부 받아 온다. 권수 × 챕터수로 늘어난다.
//   둘 다 page.tsx 가 error 를 무시하므로(`const { data: sets }`) 실패해도 화면은 뜨고
//   배지만 0 이 된다 — **틀린 화면이 정상처럼 보이는** 실패다. 그래서 숫자로 잰다.
//
// 사용: node scripts/lcp/audit-catalog-scale.mjs

import { makeClient } from '../dict-common.mjs'

const db = makeClient()
const ms = (t) => `${Math.round(performance.now() - t)}ms`

const BOOK_COLS =
  'id, title, author, cefr_level, cefr_band, book_v_level, ' +
  'word_count, chapter_count, reading_minutes, cover_from, cover_to, cover_image_url, lexical_coverage, ' +
  'is_picture_book, librivox_audio, published_at, curation_metadata'

const results = []
const record = (name, detail) => {
  results.push({ name, ...detail })
  const flag = detail.error ? '✗' : detail.warn ? '⚠' : '✓'
  console.log(`${flag} ${name} — ${detail.note}`)
}

// ① 카탈로그 게이트 — page.tsx 와 같은 조건·같은 컬럼, 상한 없음
let t = performance.now()
const { data: books, error: bErr } = await db
  .from('library_books')
  .select(BOOK_COLS)
  .eq('status', 'published')
  .eq('copyright_safe_in_kr', true)
  .not('published_at', 'is', null)
  .order('published_at', { ascending: false })
const bookMs = performance.now() - t
record('도서 전량 조회', {
  error: !!bErr,
  warn: bookMs > 1500,
  note: bErr ? `실패: ${bErr.message}` : `${books.length}권 · ${Math.round(bookMs)}ms · payload ${(JSON.stringify(books).length / 1024).toFixed(0)}KB`,
})
if (bErr) process.exit(1)

const ids = books.map((b) => b.id)

// ② URL 길이 — `.in()` 은 GET 쿼리스트링이다
const inClauseLen = ids.join(',').length
record('.in() 쿼리스트링 길이', {
  error: inClauseLen > 15000,
  warn: inClauseLen > 6000,
  note: `${ids.length} id → ${inClauseLen}자 (URL 인코딩 전). 6,000자 초과부터 게이트웨이 상한이 위험하다`,
})

// ③ 챕터 단어장 개수 — page.tsx 는 세기 위해 전 행을 받아 온다
t = performance.now()
const { data: sets, error: sErr } = await db
  .from('shared_word_sets')
  .select('curation_query')
  .eq('is_published', true)
  .eq('category', 'library_book')
  .in('curation_query->>book_id', ids)
const setMs = performance.now() - t
record('챕터 단어장 조회(개수용)', {
  error: !!sErr,
  warn: !sErr && (sets.length >= 1000 || setMs > 1500),
  note: sErr
    ? `실패: ${sErr.message}`
    : `${sets.length}행 · ${Math.round(setMs)}ms${sets.length >= 1000 ? ' — 1,000행 상한에 닿았을 수 있다(개수가 잘린다)' : ''}`,
})

// 같은 조건으로 count 를 따로 받아 대조 — 행이 잘렸는지 확인하는 유일한 방법.
//   ⚠️ 필터를 하나라도 빼고 세면(예: .in(ids) 생략) 미발행 도서의 세트까지 세어 오탐이 난다.
const { count: trueCount } = await db
  .from('shared_word_sets')
  .select('id', { count: 'exact', head: true })
  .eq('is_published', true)
  .eq('category', 'library_book')
  .in('curation_query->>book_id', ids)
record('단어장 개수 정합', {
  error: !sErr && sets.length < (trueCount ?? 0),
  note: `받아온 ${sErr ? 'n/a' : sets.length} vs 같은 조건 count ${trueCount} — 적으면 행이 잘린 것이고 화면의 "단어장 N" 배지가 틀린다`,
})

// ④ 시드 카탈로그
t = performance.now()
const { data: seeds, error: seErr } = await db
  .from('library_seed_catalog')
  .select('imported_book_id, est_v_level, curation_meta, description, popularity_rank')
  .in('imported_book_id', ids)
record('시드 카탈로그 조회', {
  error: !!seErr,
  warn: !seErr && performance.now() - t > 1500,
  note: seErr ? `실패: ${seErr.message}` : `${seeds.length}행 · ${ms(t)}`,
})

// ⑤ 로그인 사용자 진도 — texts .in(ids)
t = performance.now()
const { error: tErr, data: texts } = await db
  .from('texts')
  .select('id, library_book_id, chapter_idx, status')
  .in('library_book_id', ids)
  .order('chapter_idx', { ascending: true })
record('진도(texts) 조회', {
  error: !!tErr,
  warn: !tErr && performance.now() - t > 1500,
  note: tErr ? `실패: ${tErr.message}` : `${texts.length}행 · ${ms(t)}`,
})

const bad = results.filter((r) => r.error)
const warn = results.filter((r) => !r.error && r.warn)
console.log(`\n실패 ${bad.length} · 경고 ${warn.length} · 검사 ${results.length}`)
process.exit(bad.length > 0 ? 1 : 0)
