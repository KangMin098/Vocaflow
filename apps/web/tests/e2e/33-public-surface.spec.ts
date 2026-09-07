// apps/web/tests/e2e/33-public-surface.spec.ts
//
// **검색으로 들어오는 사람이 처음 보는 화면**을 비로그인 상태로 검사한다.
//
// 왜 따로 필요한가:
//   `10-a11y-sweep` 은 `learnerRoutes()` 를 훑는데 그 함수는 **동적 라우트를 건너뛴다**
//   (`[bookId]` 등 — "시나리오 스펙의 몫"). 합리적인 설계지만, 그 결과
//   **공개 콘텐츠 상세 278개가 통째로 검사 밖**이었다. 하필 그것들이 sitemap 이
//   검색엔진에 알리는 바로 그 주소들이고, 방문자가 이 제품에서 처음 보는 화면이다.
//   게다가 스윕은 로그인 상태로 돈다 — 검색 방문자는 로그인하지 않았다.
//
// 대상을 **sitemap 에서 뽑는다.** 손으로 목록을 적으면 sitemap 과 갈라지고,
// 그러면 "검색에 알렸지만 아무도 안 본 화면" 이 다시 생긴다.
// sitemap 이 공개 표면의 정의이므로 그것이 곧 검사 대상이다.
//
// 무엇을 보는가 — 검색 착지점이 지켜야 할 최소:
//   · 200 으로 열린다 (sitemap 이 404 를 광고하지 않는다)
//   · h1 이 하나 있다 (무엇에 관한 페이지인지 기계와 사람 모두에게)
//   · 가로로 넘치지 않는다 (390px — 검색 트래픽 다수가 폰이다)
//   · 44px 미만 터치 타겟이 없다
//   · 콘솔 에러가 없다

import { test, expect, type Page } from '@playwright/test'

/** 비로그인 — 검색 방문자와 같은 상태. */
test.use({ storageState: { cookies: [], origins: [] } })

const MOBILE = { width: 390, height: 844 }

/**
 * **오늘부터의 악화만 막는다** — 이미 있던 44px 위반은 여기 적어 두고 통과시킨다.
 *
 * 이 스펙이 처음 돌았을 때(2026-08-26) 공개 표면에서 44px 미만이 여러 화면에 있었다.
 * 그중 새로 만든 화면(랜딩·글 상세)은 바로 고쳤지만, 아래 셋은 **기존 학습자 UI** 라
 * 손대면 이 사이클의 범위를 넘는다. 그렇다고 스펙을 안 만들면 **다음 것도 안 보인다** —
 * 실제로 도서 상세는 동적 라우트라 `10-a11y-sweep` 이 한 번도 보지 못했고,
 * 그래서 h1 이 없는 것조차 아무도 몰랐다.
 *
 * 베이스라인은 **줄어들기만 해야 한다.** 항목을 지울 일은 있어도 더할 일은 없어야 한다.
 * (같은 방식을 `10-a11y-sweep` 의 `OVERFLOW_BASELINE` 이 이미 쓰고 있다.)
 */
const TOUCH_BASELINE: ReadonlyArray<{ path: string; why: string }> = [
  { path: '/fit', why: '공개 진단 화면의 헤더·푸터 링크 (기존)' },
  { path: '/library/books', why: '카탈로그 카드의 레벨 배지 (기존)' },
  { path: '/library/books/', why: '도서 리더 UI — 토글·챕터 목록·페이지 버튼 (기존)' },
]

function touchExempt(path: string): boolean {
  return TOUCH_BASELINE.some((b) =>
    b.path.endsWith('/') ? path.startsWith(b.path) : path === b.path,
  )
}

/** sitemap 에서 유형별 대표를 하나씩 뽑는다(전수는 278개라 스펙이 감당할 크기가 아니다). */
async function pickTargets(page: Page): Promise<string[]> {
  const res = await page.request.get('/sitemap.xml')
  expect(res.ok(), 'sitemap.xml 을 못 읽었다').toBe(true)

  const xml = await res.text()
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => (m[1] ?? '').replace(/^https?:\/\/[^/]+/, ''))
    .filter(Boolean)

  expect(paths.length, 'sitemap 이 비어 있다').toBeGreaterThan(10)

  const first = (prefix: string) =>
    paths.find((p) => p.startsWith(prefix) && p !== prefix.replace(/\/$/, ''))

  const targets = [
    '/', // 랜딩 — 검색의 정문
    '/fit', // 가입 전 가치 증명(교사 채널의 전제)
    '/library/books', // 카탈로그
    first('/library/books/'), // 도서 상세
    first('/comics/restored/'), // 만화 상세
    first('/library/scripts/'), // 짧은 글 상세
  ].filter((p): p is string => typeof p === 'string')

  // 유형이 하나라도 빠지면 그 유형은 영원히 안 보게 된다.
  expect(targets.length, `대표를 못 고른 유형이 있다: ${targets.join(', ')}`).toBe(6)
  return targets
}

test.describe('공개 표면 — 비로그인 검색 착지점', () => {
  test('sitemap 대표 화면이 열리고 폰에서 깨지지 않는다', async ({ page }) => {
    await page.setViewportSize(MOBILE)

    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })

    const targets = await pickTargets(page)
    const problems: string[] = []

    for (const path of targets) {
      errors.length = 0

      const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
      const status = res?.status() ?? 0
      if (status !== 200) {
        problems.push(`${path} — status ${status} (sitemap 이 광고하는 주소다)`)
        continue
      }

      // 로그인으로 튕기면 그 화면은 공개가 아니다 — sitemap 에 있으면 안 된다.
      if (/\/login(\?|$)/.test(page.url())) {
        problems.push(`${path} — 로그인으로 리다이렉트됐다`)
        continue
      }

      const h1 = await page.locator('h1').count()
      if (h1 === 0) problems.push(`${path} — h1 이 없다`)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      if (overflow > 1) problems.push(`${path} — 가로 ${overflow}px 넘침`)

      const small = await page.evaluate(() => {
        const out: string[] = []
        const sel = 'a[href], button, [role="button"], input, select, textarea'

        for (const el of Array.from(document.querySelectorAll(sel))) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue // 숨김
          if (r.width >= 44 && r.height >= 44) continue

          const cs = getComputedStyle(el)

          // 건너뛰기 링크 — 평소 `sr-only`(1×1)이고 **포커스될 때** 커진다.
          // 크기로 재면 항상 걸리지만 그건 이 링크의 존재 이유(Calm UI)와 반대다.
          if (r.width <= 2 && r.height <= 2 && cs.position === 'absolute') continue

          // **문장 속 인라인 링크**는 대상이 아니다 — 출처 표기·본문 링크를 44px 로 키우면
          // 문단이 깨진다. WCAG 2.5.8 도 "inline in a sentence" 를 예외로 둔다.
          // 판정은 표시 방식으로 한다(부모 태그로 하면 래핑에 따라 오락가락한다).
          if (el.tagName === 'A' && cs.display.startsWith('inline')) continue

          const label = (el.textContent ?? '').trim().slice(0, 24) || el.tagName
          out.push(`${label} ${Math.round(r.width)}×${Math.round(r.height)}`)
        }
        return out.slice(0, 5)
      })
      if (small.length > 0 && !touchExempt(path)) {
        problems.push(`${path} — 44px 미만: ${small.join(' · ')}`)
      }

      const real = errors.filter(
        (e) =>
          !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError|Download the React DevTools/.test(
            e,
          ),
      )
      if (real.length > 0) problems.push(`${path} — 콘솔 에러: ${real[0]}`)
    }

    expect(problems, `공개 표면 문제:\n${problems.join('\n')}`).toEqual([])
  })
})


/**
 * **고아 페이지 금지** — sitemap 이 알리는 주소를 사이트 안에서 링크로 닿을 수 있어야 한다.
 *
 * 2026-08-26 실측. `/library/scripts` 를 익명으로 받으면 글 제목 160개가 다 들어 있는데
 * **상세로 가는 `<a>` 가 0개**였다. `/library/books` 는 13권 전부 그랬다. 원인 둘:
 * 카드가 `<button onClick>` 이라 주소가 없었고, 시리즈 드릴다운이 `useState` 였다.
 * 화면에서는 잘 동작하니 아무도 몰랐다.
 *
 * 그 상태의 대가는 조용하다: 크롤러는 sitemap 으로 주소를 알아도 그 페이지가 무엇에
 * 속하는지 모르고(내부 링크가 곧 문맥이다), 비로그인 방문자는 목록에서 콘텐츠로 갈 수 없다.
 *
 * **두 집합을 맞춘다**: sitemap 의 상세 주소 ⊆ 링크로 닿는 주소.
 * 손으로 센 숫자를 쓰지 않는다 — 콘텐츠가 늘면 두 집합이 함께 늘어야 하고, 한쪽만 늘면 회귀다.
 */
interface Shelf {
  label: string
  /** 서가 진입면. 여기서 1홉, 그 안의 `?…` 링크에서 2홉까지 따라간다. */
  index: string
  /** 이 서가의 상세 주소 모양. */
  detail: RegExp
  /**
   * 허용 고아 수 — **줄어들기만 해야 한다** (`TOUCH_BASELINE` 과 같은 규칙).
   * 0 이 아닌 값에는 반드시 이유와 해소 조건을 적는다.
   */
  allowOrphans: number
  why?: string
}

const SHELVES: readonly Shelf[] = [
  { label: '글', index: '/library/scripts', detail: /^\/library\/scripts\/[^/]+$/, allowOrphans: 0 },
  { label: '도서', index: '/library/books', detail: /^\/library\/books\/[^/]+$/, allowOrphans: 0 },
  { label: '각색 만화', index: '/comics/adapted', detail: /^\/comics\/adapted\/[^/]+$/, allowOrphans: 0 },
  {
    label: '복원 만화',
    index: '/comics/restored',
    detail: /^\/comics\/restored\/[^/]+$/,
    // `Atomic War!` 1~4호가 IA 식별자만 다른 중복 행으로 각각 2~3벌 발행돼 있다(9행 · 숨는 5행).
    // `list_pd_comics` 는 `distinct on (series_key, issue_no)` 로 한 벌만 내보내는데,
    // 동점 처리가 `panels_total desc, created_at` 이고 **그 두 값이 9행 모두 같다.**
    // 그래서 어느 행이 이기는지가 실행 계획에 달렸고, sitemap 과 화면이 **같은 만화에
    // 서로 다른 주소**를 쓴다. 마이그레이션(`_pending_pd_comic_pick_stable.sql`)이 적용되면 0 이 된다.
    allowOrphans: 4,
    why: 'Atomic War! 중복 행의 동점 처리가 비결정적 — 미적용 마이그레이션 대기',
  },
]

test.describe('공개 콘텐츠에 링크로 닿는다', () => {
  for (const shelf of SHELVES) {
    test(`${shelf.label} — sitemap 이 알린 주소가 링크로 닿는다`, async ({ page }) => {
      const res = await page.request.get('/sitemap.xml')
      expect(res.ok(), 'sitemap.xml 을 못 읽었다').toBe(true)
      const xml = await res.text()
      const advertised = [
        ...new Set(
          [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
            .map((m) => new URL(m[1] as string).pathname)
            .filter((p) => shelf.detail.test(p)),
        ),
      ]
      // 0건이면 아래 비교가 조용히 통과한다 — sitemap 이 비면 그것부터 회귀다.
      expect(advertised.length, `sitemap 에 ${shelf.label} 상세가 없다`).toBeGreaterThan(0)

      const reachable = new Set<string>()
      /** 이 페이지의 링크를 거둬 상세는 모으고, 같은 서가의 필터 주소는 돌려준다(2홉). */
      const harvest = async (url: string): Promise<string[]> => {
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        const all = await page
          .locator('a[href]')
          .evaluateAll((els) =>
            els.map((e) => {
              const u = new URL((e as HTMLAnchorElement).href)
              return u.pathname + u.search
            }),
          )
        all.filter((p) => shelf.detail.test(p)).forEach((p) => reachable.add(p))
        return [...new Set(all.filter((p) => p.startsWith(`${shelf.index}?`)))]
      }

      for (const next of await harvest(shelf.index)) await harvest(next)

      const orphans = advertised.filter((p) => !reachable.has(p))
      expect(
        orphans.length,
        `검색에 알렸지만 사이트 안에서 닿을 수 없는 ${shelf.label} ${orphans.length}개` +
          `${shelf.why ? ` (허용 ${shelf.allowOrphans} — ${shelf.why})` : ''}` +
          `: ${orphans.slice(0, 5).join(', ')}`,
      ).toBeLessThanOrEqual(shelf.allowOrphans)
    })
  }
})
