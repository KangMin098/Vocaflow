// apps/web/tests/e2e/39-library-scale.spec.ts
//
// **카탈로그가 가장 큰 항목에서도 본문이 나오는가** — 라이브러리 계열의 규모 회귀.
//
// ── 왜 이 스펙이 따로 필요한가 (실측 2026-08-30) ────────────────────────
// 이 저장소에는 이미 훑기가 넷 있고(학습자·관리자·공개·접근성) 축도 일곱이다
// (열림 · 조용함 · 연결 · 복귀 · 가로스크롤 · 탭대상 · 요청). 그런데 그 **일곱 개가
// 전부 통과하는 동안** `/library/books/<Clarissa>` 는 본문을 한 글자도 그리지 않았다.
//
//   · HTTP 는 200 이다 — 셸이 먼저 흘러가고 그 뒤에 서버가 던지기 때문이다.
//   · 콘솔도 조용하다 — 오류는 서버에서 났다.
//   · 링크·복귀·가로스크롤·탭대상은 셸에만 물어도 통과한다.
//   · 요청 축도 통과한다 — 실패한 것은 우리 서버가 **아니라** Supabase 호출이다.
//
// 실패가 **카탈로그 규모에 비례**하는 종류였다는 것이 핵심이다. 세트가 100개인 책은
// 멀쩡하고 443개인 책만 깨졌다(질의 URL 이 16KB 를 넘어 요청이 7.7초를 끌다 실패).
// 그래서 "아무 책이나 하나" 를 여는 스펙으로는 영영 안 잡힌다 —
// **가장 큰 것**을 DB 에 물어서 열어야 한다. 카탈로그는 계속 자라므로 목록을 손으로
// 적으면 다음 최대값이 또 분모 밖으로 나간다.
//
// ── 무엇을 묻는가 ──────────────────────────────────────────────────────
//   ① 본문이 실제로 있다 — 셸이 아니라 **그 책의 제목**이 화면에 있다
//   ② 에러/404 화면이 아니다
//   ③ 세트 단어 수가 DB 와 일치한다 (PostgREST 1,000행 상한에 조용히 잘리지 않았다)
//   ④ 서버 응답이 예산 안이다 (dev 서버 기준 — 아래 BUDGET_MS 주석 참조)

import { test, expect } from '@playwright/test'

import { crashKindOf } from './utils/crash-screen'
import { serviceClient } from './utils/db'

/** 비로그인 — 미리보기 화면의 정의된 대상이 그쪽이다(수강자는 /text 로 리다이렉트된다). */
test.use({ storageState: { cookies: [], origins: [] } })

/**
 * 서버 응답 예산.
 *
 * ⚠️ **dev 서버 기준의 회귀 감지선이지 성능 목표가 아니다.** 실측으로 정한다:
 *   고침 전 Clarissa(450세트) 8.0s → 고침 뒤 0.7~2.0s (2026-08-30, `pnpm dev`).
 *   프로덕션 빌드는 이보다 빠르다. 여기서 5초를 넘긴다면 그건 느린 것이 아니라
 *   **무언가 다시 실패하며 재시도/타임아웃을 먹고 있다는** 신호다.
 */
const BUDGET_MS = 5_000

interface BigBook {
  id: string
  title: string
  sets: number
  setWords: number
}

/** 발행 도서 중 **챕터 단어장이 가장 많은** 것들 — 실패가 여기서만 난다. */
async function biggestBooks(limit: number): Promise<BigBook[] | null> {
  const c = serviceClient()
  if (!c) return null

  const { data: books, error } = await c
    .from('library_books')
    .select('id, title')
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .not('published_at', 'is', null)
  if (error || !books) return null

  const ids = new Set((books as { id: string }[]).map((b) => b.id))

  // 세트는 도서보다 많으므로(11,128행) 페이지네이션해서 전부 센다 —
  // 여기서 1,000행에 잘리면 이 스펙이 **틀린 최대값**을 고르게 된다.
  const bySet = new Map<string, { sets: number; words: number }>()
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await c
      .from('shared_word_sets')
      .select('word_count, book_id:curation_query->>book_id')
      .eq('is_published', true)
      .eq('category', 'library_book')
      .range(from, from + 999)
    if (e || !data || data.length === 0) break
    for (const r of data as { word_count: number | null; book_id: string | null }[]) {
      if (!r.book_id || !ids.has(r.book_id)) continue
      const cur = bySet.get(r.book_id) ?? { sets: 0, words: 0 }
      cur.sets += 1
      cur.words += r.word_count ?? 0
      bySet.set(r.book_id, cur)
    }
    if (data.length < 1000) break
  }

  return (books as { id: string; title: string }[])
    .map((b) => ({
      id: b.id,
      title: b.title,
      sets: bySet.get(b.id)?.sets ?? 0,
      setWords: bySet.get(b.id)?.words ?? 0,
    }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, limit)
}

/**
 * **`group_label` 이 하나도 없으면서 장이 가장 많은** 발행 도서.
 *
 * 목차가 벽이 되는 것은 정확히 이 조건에서다 — 라벨이 있으면 그룹이 접히므로 애초에 작다.
 * 조건을 런타임 화면이 아니라 **DB 로** 고른다: 화면에서 "그룹이 몇 개인가" 로 고르면
 * 고침이 만든 그룹까지 조건에 걸려, 고침을 되돌려도 통과하는 스펙이 된다.
 */
async function flattestLongBook(): Promise<{ id: string; chapters: number } | null> {
  const c = serviceClient()
  if (!c) return null

  const { data: books } = await c
    .from('library_books')
    .select('id')
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .not('published_at', 'is', null)
  if (!books) return null
  const published = new Set((books as { id: string }[]).map((b) => b.id))

  const byBook = new Map<string, { total: number; labeled: number }>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c
      .from('library_chapters_master')
      .select('library_book_id, group_label')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    for (const r of data as { library_book_id: string; group_label: string | null }[]) {
      if (!published.has(r.library_book_id)) continue
      const cur = byBook.get(r.library_book_id) ?? { total: 0, labeled: 0 }
      cur.total += 1
      if (r.group_label != null) cur.labeled += 1
      byBook.set(r.library_book_id, cur)
    }
    if (data.length < 1000) break
  }

  const best = [...byBook.entries()]
    .filter(([, v]) => v.labeled === 0 && v.total > 60)
    .sort((a, b) => b[1].total - a[1].total)[0]
  return best ? { id: best[0], chapters: best[1].total } : null
}

test.describe('라이브러리 규모 회귀 — 가장 큰 항목에서도 본문이 나온다', () => {
  test('발행 도서 상세 상위 3권이 셸이 아니라 본문을 그린다', async ({ page }) => {
    const targets = await biggestBooks(3)
    // 조용히 통과시키지 않는다 — 키가 없으면 이 스펙은 아무것도 검증하지 못한다.
    test.skip(
      targets === null,
      'SUPABASE_SERVICE_ROLE_KEY 가 없어 최대 도서를 고를 수 없다 (.env.local)',
    )
    expect(targets!.length, '발행 도서를 하나도 못 찾았다').toBeGreaterThan(0)

    const failures: string[] = []

    for (const b of targets!) {
      const started = Date.now()
      await page.goto(`/library/books/${b.id}`, { waitUntil: 'domcontentloaded' })
      const elapsed = Date.now() - started

      const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
      const crash = crashKindOf(bodyText)
      if (crash) {
        failures.push(`${b.title}(${b.sets}세트): ${crash} 이 떴다`)
        continue
      }

      // ① 본문이 실제로 있다. 셸(탭·사이드바)만 있는 화면과 가르는 유일한 증거는
      //    **그 책의 제목**이다 — 셸에는 어떤 책 제목도 없다.
      if (!bodyText.includes(b.title)) {
        failures.push(
          `${b.title}(${b.sets}세트): 본문에 책 제목이 없다 — 셸만 그려졌다 (본문 ${bodyText.length}자)`,
        )
        continue
      }

      if (elapsed > BUDGET_MS) {
        failures.push(`${b.title}(${b.sets}세트): ${elapsed}ms — 예산 ${BUDGET_MS}ms 초과`)
      }
    }

    expect(failures.join('\n'), '큰 도서 상세가 본문을 못 그린다').toBe('')
  })

  test('챕터 단어장 합계가 DB 와 같다 — 1,000행 상한에 잘리지 않는다', async ({ page }) => {
    const targets = await biggestBooks(1)
    test.skip(targets === null, 'SUPABASE_SERVICE_ROLE_KEY 가 없다 (.env.local)')

    const b = targets![0]!
    expect(b.sets, '이 검사는 세트가 여럿인 책이라야 뜻이 있다').toBeGreaterThan(100)

    await page.goto(`/library/books/${b.id}`, { waitUntil: 'domcontentloaded' })
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ')

    // 화면이 파는 문구: "443 챕터 · 1,792 단어 · V 8"
    const m = bodyText.match(/([\d,]+)\s*챕터\s*·\s*([\d,]+)\s*단어/)
    expect(m, `단어장 요약 문구를 못 찾았다 — 본문: ${bodyText.slice(0, 300)}`).not.toBeNull()

    const shownSets = Number(m![1]!.replace(/,/g, ''))
    const shownWords = Number(m![2]!.replace(/,/g, ''))

    expect(shownSets, `챕터 세트 수가 DB(${b.sets})와 다르다`).toBe(b.sets)
    // 단어 수는 세트별 실측 집계의 합이다. DB 캐시(word_count) 합과 어긋나면
    // 둘 중 하나가 틀린 것이고, 어느 쪽이든 학습자에게 틀린 숫자를 판 것이다.
    expect(shownWords, `단어 합계가 DB(${b.setWords})와 다르다 — 응답이 잘렸을 수 있다`).toBe(
      b.setWords,
    )
  })
})

test.describe('도서 상세 목차 — 장이 많아도 벽이 되지 않는다', () => {
  /**
   * ── 왜 (실측 2026-08-30 · 4배 CPU 감속 · 390px) ──────────────────────────
   * `group_label` 이 있는 책은 그룹이 접혀 DOM 이 작다(Le Morte d'Arthur 502장 → 842 노드).
   * 라벨이 하나도 없는 책은 접을 단위가 없어 전 장이 그려졌다 —
   * Clarissa(528장)가 **5,695 노드 · FCP 4.8초**로, 같은 크기 책의 **7배**였다.
   * 게다가 목차로서도 나빴다: 400번대 장으로 가려면 528줄을 스크롤해야 했다.
   *
   * 그래서 라벨이 없으면 번호 범위(50장)로 스스로 묶는다. 이 스펙이 지키는 것은 둘:
   *   ① 처음부터 전 장을 그리지 않는다 (노드 수)
   *   ② 그래도 뒤쪽 장에 **한 번에** 닿는다 (범위를 눌러 펼친다)
   * ②가 없으면 ①은 기능을 지운 것이지 개선이 아니다.
   */
  test('장이 많은 평면 목차가 범위로 묶이고, 뒤쪽 장에 한 번에 닿는다', async ({ page }) => {
    // ⚠️ **평면(라벨 없는) 책을 콕 집어 연다.** 처음에는 세트가 많은 책들을 훑어
    //    "그룹이 2개 이상인 첫 책" 을 골랐는데, 그러면 **라벨 있는 책**이 뽑힌다 —
    //    그쪽은 원래도 접히므로 고침을 되돌려도 스펙이 통과했다(공허한 초록이었다).
    //    문제는 라벨이 **하나도 없는** 긴 책에서만 난다. 그 조건으로 직접 고른다.
    const flat = await flattestLongBook()
    test.skip(flat === null, 'SUPABASE_SERVICE_ROLE_KEY 가 없거나 평면 장편 도서가 없다')

    await page.goto(`/library/books/${flat!.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const nav = page.locator('nav[aria-label="장 목록"]')
    await expect(nav, '목차가 안 뜬다').toBeVisible({ timeout: 15_000 })

    // ① 처음부터 전부 그리지 않는다. 한 범위는 50장이므로 넉넉히 잡아도 120을 넘지 않는다.
    const shown = await nav.locator('li.relative').count()
    expect(shown, `목차가 처음부터 ${shown}장을 전부 그린다 — 묶임이 풀렸다`).toBeLessThan(120)

    // ② 접힌 범위를 누르면 그 장들이 실제로 나온다.
    const collapsed = nav.getByRole('button', { expanded: false })
    const n = await collapsed.count()
    expect(n, '접힌 범위가 하나도 없다 — 묶임이 동작하지 않는다').toBeGreaterThan(0)

    // 가장 뒤 범위를 연다 — "뒤쪽 장에 한 번에 닿는가" 가 요점이다.
    await collapsed.nth(n - 1).click()
    await expect
      .poll(async () => nav.locator('li.relative').count(), {
        message: '범위를 눌렀는데 장이 나오지 않는다',
        timeout: 10_000,
      })
      .toBeGreaterThan(shown)
  })
})
