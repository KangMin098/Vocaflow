// apps/web/src/components/layout/nav-match.ts
//
// 「지금 어디」 판정 — 셸 내비가 공유하는 한 벌(이전에는 `Sidebar.tsx` 안에 있었다).
//
// 상단 메뉴로 바뀌면서 판정이 두 겹이 됐다: 막대의 항목과 **열리는 패널 안의 링크**가
// 같은 경로를 동시에 대표할 수 있다(`/library` 항목과 `/library/books` 카드). 사이드바
// 시절에는 "부모가 열려 있으면 자식이 표식을 갖는다" 로 손으로 갈랐지만, 패널이 셋이
// 되면 그 규칙이 곳곳에 흩어진다. 그래서 **구체성 점수**로 한 번에 고른다 —
// 렌더된 모든 후보 중 가장 구체적인 하나만 `aria-current="page"` 를 갖는다.
//
// ⚠️ 표식이 둘이면 스크린리더는 "현재 페이지" 를 두 번 말하고, 하나도 없으면
//    WCAG 2.4.8(Location)이 빈다 — 실측 2026-08-25 에 52 측정 중 20 이 그 상태였다.

import type { ReadonlyURLSearchParams } from 'next/navigation'

import type { NavItem } from './sidebar-config'

/**
 * 현재 위치가 그 주소(또는 하위)인가.
 *
 * 두 종류의 href 를 함께 다룬다:
 *   · 라우트   `/library/vocab` — 하위 라우트까지 활성 (`/wordvault/study` 에서 Vault 유지)
 *   · 쿼리 뷰  `/text?view=vocab` — `/text` 한 화면의 탭이라 **경로가 같다**. 쿼리를 안 보면
 *     세 자식이 동시에 활성이 되어 "지금 어디"가 세 번 말해진다.
 */
export function matchesRoute(
  pathname: string,
  href: string,
  search?: ReadonlyURLSearchParams | null,
): boolean {
  const [path = '', query] = href.split('?')
  if (!query) return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))
  if (pathname !== path) return false
  // 쿼리가 없는 `/text` 진입은 어느 자식도 활성이 아니다 — 화면이 자기 기본 면을 고르고,
  // 그 선택을 내비가 아는 척하지 않는다.
  const want = new URLSearchParams(query)
  for (const [k, v] of want.entries()) {
    if (search?.get(k) !== v) return false
  }
  return true
}

/**
 * 현재 위치를 그 항목이 **대표하는가** — 자기 주소이거나, `owns` 로 떠맡은 주소이거나.
 *
 * 내비가 아는 주소는 스무 남짓인데 학습자 정적 화면은 마흔이 넘는다. `owns` 는 그
 * 빈자리를 메우는 소유 선언이다(`sidebar-config.ts` 머리 주석 · `__tests__/wayfinding.test.ts`).
 */
export function matchesItem(
  pathname: string,
  item: Pick<NavItem, 'href' | 'owns'>,
  search?: ReadonlyURLSearchParams | null,
): boolean {
  if (matchesRoute(pathname, item.href, search)) return true
  return (item.owns ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * 후보가 현재 위치를 얼마나 **구체적으로** 대표하는가 — 큰 쪽이 이긴다. 0 이면 무관.
 *   3 = 주소가 정확히 같다(쿼리 뷰 포함)   2 = 하위 라우트   1 = `owns` 로 떠맡았다
 * 같은 점수면 더 긴 주소가 이긴다(`/library/books` > `/library`).
 */
function score(
  pathname: string,
  item: Pick<NavItem, 'href' | 'owns'>,
  search?: ReadonlyURLSearchParams | null,
): number {
  const [path = '', query] = item.href.split('?')
  if (query) return matchesRoute(pathname, item.href, search) ? 3 : 0
  if (pathname === path) return 3
  if (path !== '/' && pathname.startsWith(`${path}/`)) return 2
  if ((item.owns ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))) return 1
  return 0
}

/**
 * 렌더된 후보 중 **현재 위치를 말할 하나**의 href 를 고른다. 없으면 null.
 * 호출부는 이 값과 자기 href 를 비교해 `aria-current="page"` 를 붙인다 — 그래서 표식은
 * 화면 전체에 정확히 하나다(막대 · 패널 · 서랍이 각자 붙이지 않는다).
 */
export function pickCurrent(
  pathname: string,
  candidates: readonly Pick<NavItem, 'href' | 'owns'>[],
  search?: ReadonlyURLSearchParams | null,
): string | null {
  let best: { href: string; s: number } | null = null
  for (const c of candidates) {
    const s = score(pathname, c, search)
    if (s === 0) continue
    if (!best || s > best.s || (s === best.s && c.href.length > best.href.length)) {
      best = { href: c.href, s }
    }
  }
  return best?.href ?? null
}
