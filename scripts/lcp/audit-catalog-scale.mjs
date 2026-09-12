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

// ③ 챕터 단어장 개수 — **페이지가 실제로 쓰는 경로**(lib/library/word-set-counts.ts)와 같은 방식:
//    .range() 로 끝까지 페이지네이션 + book_id 한 열만. 여기가 합격 기준이다.
const PAGE = 1000
t = performance.now()
const counts = new Map()
let pages = 0
let countErr = null
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from('shared_word_sets')
    .select('book_id:curation_query->>book_id')
    .eq('is_published', true)
    .eq('category', 'library_book')
    .range(from, from + PAGE - 1)
  if (error) { countErr = error; break }
  pages++
  for (const r of data) {
    if (!r.book_id) continue
    counts.set(r.book_id, (counts.get(r.book_id) ?? 0) + 1)
  }
  if (data.length < PAGE) break
}
const pagedTotal = [...counts.values()].reduce((a, b) => a + b, 0)
const countMs = performance.now() - t

const { count: trueCount } = await db
  .from('shared_word_sets')
  .select('id', { count: 'exact', head: true })
  .eq('is_published', true)
  .eq('category', 'library_book')

record('단어장 개수(페이지네이션 경로)', {
  error: !!countErr || pagedTotal !== (trueCount ?? -1),
  warn: countMs > 3000,
  note: countErr
    ? `실패: ${countErr.message}`
    : `${pagedTotal}행 / count ${trueCount} · ${pages}페이지 · ${Math.round(countMs)}ms — 어긋나면 배지가 틀린다`,
})

const booksWithBadge = books.filter((b) => (counts.get(b.id) ?? 0) > 0).length
record('배지가 뜨는 도서 비율', {
  error: booksWithBadge < books.length * 0.5,
  note: `${booksWithBadge}/${books.length}권에 단어장 개수가 잡힌다`,
})

// ③-b 옛 경로(한 방 조회)가 지금 규모에서 어떻게 되는지 — **기록용**.
//     실패로 세지 않는다. 이건 "왜 페이지네이션을 쓰는가" 의 근거이지 회귀 대상이 아니다.
const { data: naive } = await db
  .from('shared_word_sets')
  .select('curation_query')
  .eq('is_published', true)
  .eq('category', 'library_book')
  .in('curation_query->>book_id', ids)
record('참고: 한 방 조회로 세면', {
  warn: (naive?.length ?? 0) < (trueCount ?? 0),
  note: `${naive?.length ?? 0}행만 온다 (실제 ${trueCount}) — PostgREST 는 한 응답에 ${PAGE}행까지만 준다`,
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
