// scripts/lcp/backfill-chapter-level-histogram.mjs
//
// 도서별 **챕터 난이도 분포**를 `curation_metadata.chapter_v_hist` 에 적재한다.
//
// 왜 필요한가 — 2026-08-30 실측. 발행 316권의 책 단위 난이도는 이렇다:
//   V5(고1) 2권 · V6(고2) 15권 · V7(수능 1-2등급) 92권 · **V8~V9(대학·대학원) 187권(59%)**
// 우리 타겟인 고등학생에게 서가는 사실상 대학원용으로 보인다.
//
// 그런데 **학습자는 책이 아니라 챕터를 읽는다.** 같은 날 챕터 단위로 다시 재니:
//   V4 83개(32권) · **V5 263개(87권)** · **V6 936개(222권)** · V7 2,520개(285권)
// 고1 수준 챕터가 87권에 흩어져 263개 있었다. 책 라벨은 p75(상위 25% 어휘)라
// **책 안의 쉬운 챕터를 가린다.** 그리고 `chapter_v_level` 을 읽는 화면은
// 리더 안 `ChapterSidebar` 뿐이다 — **책을 열기 전에는 볼 수 없다.**
//
// 그래서 발견 단계(카탈로그)가 쓸 수 있도록 도서별 히스토그램을 만들어 둔다.
//
// ⚠️ **jsonb 에 키만 더한다.** `curation_metadata` 에는 synopsis_ko·genre_norm 등이 이미 있다 —
//    통째로 덮으면 그것들이 조용히 사라진다(CLAUDE.md §🤖).
// ⚠️ 마이그레이션이 필요 없다 — 새 컬럼이 아니라 기존 jsonb 의 키다.
//
// 재실행 안전: 매번 챕터에서 다시 계산해 **같은 값이면 기록하지 않는다**(변경분만 UPDATE).
//    챕터가 바뀌었을 때만 값이 달라지므로 몇 번 돌려도 결과가 같다.
//
// 사용:
//   node scripts/lcp/backfill-chapter-level-histogram.mjs            # dry-run
//   node scripts/lcp/backfill-chapter-level-histogram.mjs --commit

import { makeClient } from '../dict-common.mjs'

const COMMIT = process.argv.includes('--commit')
const PAGE = 1000
const db = makeClient()

/** 페이지네이션 — PostgREST 는 한 응답에 1,000행까지만 준다. */
async function paged(run, label) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1)
    if (error) throw new Error(`${label} 조회 실패: ${error.message}`)
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

const books = await paged(
  (from, to) =>
    db
      .from('library_books')
      .select('id, title, curation_metadata')
      .eq('status', 'published')
      .order('title')
      .range(from, to),
  '발행 도서',
)
console.log(`발행 도서 ${books.length}권`)

const chapters = await paged(
  (from, to) =>
    db
      .from('library_chapters_master')
      .select('library_book_id, chapter_v_level, word_count')
      .not('chapter_v_level', 'is', null)
      .range(from, to),
  '챕터',
)
console.log(`챕터 ${chapters.length}개 (chapter_v_level 보유)`)

// 도서별 히스토그램. 길이가 극단인 챕터는 제외하지 않는다 —
//   "읽을 수 있는가" 판정에 길이를 섞으면 두 축이 한 숫자에 뭉개진다.
//   길이는 화면이 따로 보여 준다(reading_minutes · word_count).
const hist = new Map()
for (const c of chapters) {
  const m = hist.get(c.library_book_id) ?? {}
  const k = String(c.chapter_v_level)
  m[k] = (m[k] ?? 0) + 1
  hist.set(c.library_book_id, m)
}

const sameHist = (a, b) => {
  if (!a || !b) return false
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k])
}

let written = 0
let unchanged = 0
let noChapters = 0
let failed = 0
const levelBooks = new Map() // v → 그 수준 챕터를 가진 책 수

for (const b of books) {
  const h = hist.get(b.id)
  if (!h) {
    noChapters++
    continue
  }
  for (const k of Object.keys(h)) levelBooks.set(k, (levelBooks.get(k) ?? 0) + 1)

  const existing = b.curation_metadata ?? {}
  if (sameHist(existing.chapter_v_hist, h)) {
    unchanged++
    continue
  }
  if (!COMMIT) {
    written++
    continue
  }
  const { error } = await db
    .from('library_books')
    .update({ curation_metadata: { ...existing, chapter_v_hist: h } })
    .eq('id', b.id)
  if (error) {
    failed++
    console.log(`  ! ${b.title} — 기록 실패: ${error.message}`)
    continue
  }
  written++
}

console.log(`\n기록 ${written} · 이미 최신 ${unchanged} · 챕터 없음 ${noChapters} · 실패 ${failed}`)
console.log(
  '수준별 보유 도서 수: ' +
    [...levelBooks]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([v, n]) => `V${v} ${n}권`)
      .join(' · '),
)
if (!COMMIT) console.log('dry-run — 기록하지 않았다. --commit 으로 실행하면 반영된다.')
