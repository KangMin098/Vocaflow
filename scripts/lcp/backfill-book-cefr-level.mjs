// scripts/lcp/backfill-book-cefr-level.mjs
//
// 발행 도서의 `library_books.cefr_level` 결손을 **자기 챕터에서** 채운다.
//
// 왜 필요한가: 2026-08-30 발행 확대(13→316권) 뒤 실측 —
//   `enroll_library_book` 은 첫머리에서 이렇게 막는다:
//     IF v_book.cefr_level IS NULL OR v_book.cefr_level NOT IN ('A1'…'C2')
//       THEN RAISE EXCEPTION 'Book has invalid cefr_level: %'
//   그런데 발행 316권 중 유효한 `cefr_level` 을 가진 것은 **34권**뿐이었다.
//   나머지 **282권은 학습자가 표지와 레벨 배지를 보고 눌러도 등록이 예외로 실패한다** —
//   카탈로그에는 뜨는데 시작할 수 없는, 장식용 도서였다.
//
//   배지가 멀쩡히 보인 이유: 화면은 `cefr_band ?? cefr_level` 을 읽는데
//   `cefr_band` 는 316/316 채워져 있다(`compute_book_cefrj` 산출). 등록 게이트만 다른 컬럼을 본다.
//
// 무엇으로 채우는가 — **그 책의 챕터 최빈값**. 지어내지 않는다.
//   `library_chapters_master.cefr_level` 은 발행 도서 11,080챕터 전부가 유효하다(실측).
//   게다가 `enroll_library_book` 은 텍스트 행을 만들 때 챕터 값이 유효하면 그걸 쓰고
//   책 값은 폴백으로만 쓴다 — 즉 **실제로 학습자에게 적용될 값과 같은 출처**다.
//   `cefr_band`(어휘 기반)로 채우지 않는 이유도 같다: 폴백이 실제로 쓰일 때
//   챕터와 다른 척도가 섞이면 같은 책 안에서 레벨이 어긋난다.
//
// ⚠️ **이미 값이 있는 책은 건드리지 않는다.** 기존 34권은 파이프라인이 신뢰도(`cefr_confidence`)와
//    함께 넣은 값이라 최빈값으로 덮으면 그 근거가 사라진다. NULL/무효만 채운다.
//
// 재실행 안전: 대상 조회 자체가 "NULL 또는 무효" 이고 UPDATE 에도 같은 조건을 건다.
//    2회차 실행 대상은 0 이어야 한다.
//
// 사용:
//   node scripts/lcp/backfill-book-cefr-level.mjs            # dry-run
//   node scripts/lcp/backfill-book-cefr-level.mjs --commit

import { makeClient } from '../dict-common.mjs'

const VALID = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const COMMIT = process.argv.includes('--commit')
const PAGE = 1000

const db = makeClient()

/** 발행 도서 중 cefr_level 이 없거나 무효인 것. */
async function targets() {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('library_books')
      .select('id, title, cefr_level, cefr_band')
      .eq('status', 'published')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`도서 조회 실패: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows.filter((r) => !r.cefr_level || !VALID.includes(r.cefr_level))
}

/** 도서별 챕터 cefr_level 최빈값. 동률이면 CEFR 오름차순으로 낮은 쪽(더 쉬운 쪽)을 택한다. */
async function chapterModes(bookIds) {
  const counts = new Map() // bookId → Map(cefr → n)
  for (let i = 0; i < bookIds.length; i += 50) {
    const chunk = bookIds.slice(i, i + 50)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('library_chapters_master')
        .select('library_book_id, cefr_level')
        .in('library_book_id', chunk)
        .in('cefr_level', VALID)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`챕터 조회 실패: ${error.message}`)
      for (const r of data) {
        const m = counts.get(r.library_book_id) ?? new Map()
        m.set(r.cefr_level, (m.get(r.cefr_level) ?? 0) + 1)
        counts.set(r.library_book_id, m)
      }
      if (data.length < PAGE) break
    }
  }
  const modes = new Map()
  for (const [bookId, m] of counts) {
    const best = [...m].sort((a, b) => b[1] - a[1] || VALID.indexOf(a[0]) - VALID.indexOf(b[0]))[0]
    if (best) modes.set(bookId, best[0])
  }
  return modes
}

const list = await targets()
console.log(`발행 도서 중 cefr_level 결손/무효 ${list.length}권${COMMIT ? ' [COMMIT]' : ' [dry-run]'}`)
if (list.length === 0) {
  console.log('채울 것이 없다 — 발행 도서 전부가 등록 전제조건을 만족한다.')
  process.exit(0)
}

const modes = await chapterModes(list.map((r) => r.id))
const dist = new Map()
let written = 0
let noChapters = 0
let failed = 0

for (const b of list) {
  const mode = modes.get(b.id)
  if (!mode) {
    noChapters++
    console.log(`  ⊘ ${b.title} — 유효한 챕터 cefr_level 이 하나도 없다(채울 근거 없음)`)
    continue
  }
  dist.set(mode, (dist.get(mode) ?? 0) + 1)
  if (!COMMIT) continue

  // 그 사이 다른 세션이 채웠으면 덮지 않는다.
  const { data, error } = await db
    .from('library_books')
    .update({ cefr_level: mode })
    .eq('id', b.id)
    .is('cefr_level', null)
    .select('id')
  if (error) {
    failed++
    console.log(`  ! ${b.title} — 기록 실패: ${error.message}`)
    continue
  }
  if (data?.length) written++
}

console.log(`\n분포: ${[...dist].sort().map(([k, n]) => `${k} ${n}`).join(' · ')}`)
console.log(`기록 ${written} · 근거 없음 ${noChapters} · 실패 ${failed}`)
if (!COMMIT) console.log('dry-run — 기록하지 않았다. --commit 으로 실행하면 반영된다.')
