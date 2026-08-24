// apps/web/src/components/layout/__tests__/wayfinding.test.ts
//
// **어느 학습자 화면에 서 있어도 셸이 "지금 어디" 를 말하는가.**
//
// ── 왜 이 테스트가 필요한가 (실측 2026-08-25) ─────────────────────────
// `scripts/ux-bench` 로 학습자 화면을 전수 계측했더니 **52 측정 중 20 이 `aria-current` 없음**
// 이었다. 원인은 화면이 아니라 셸이었다 — 사이드바가 아는 주소는 13개인데 정적 학습자
// 화면은 42개다. 모바일은 사이드바 자체가 없어 하단 탭 4개가 유일한 위치 표시인데,
// 활동 화면(`/arcade`·`/flashcard` …)에서는 그 넷이 전부 꺼져 있었다.
//
// 그래서 `NavItem.owns` · `Surface.owns` 로 소유 관계를 선언했다. 선언은 낡는다 —
// **새 화면을 만들면서 소유자를 안 적으면 그 화면은 다시 "아무 데도 아님" 이 된다.**
// 목록을 손으로 적지 않고 파일 시스템에서 읽어 확인한다(라우트 레지스트리와 같은 방식).
//
// ⚠️ 면제는 좁고 명시적으로. 면제 목록이 자라면 이 테스트는 커버리지가 아니라 알리바이가 된다.

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { SURFACES, SURFACE_ORDER } from '@/lib/framework/axes'

import {
  ASIDE_GROUP,
  FOOTER_ITEMS,
  META_ITEMS,
  NAV_GROUPS,
  type NavItem,
} from '../sidebar-config'

/** `(main)` 아래 정적 학습자 라우트 — 파일 시스템이 정본이다. */
function learnerRoutes(): string[] {
  const base = path.resolve(__dirname, '../../../app/(main)')
  const out: string[] = []
  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      if (name.startsWith('[')) continue // 동적 — 부모가 대표한다
      if (name.startsWith('_') || name.startsWith('(')) {
        walk(full, url)
        continue
      }
      const child = `${url}/${name}`
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }
  walk(base, '')
  return out.sort()
}

/**
 * **오직 다른 곳으로 보내기만 하는 화면** — `redirect(): never` 한 줄이 전부다.
 * 셸을 그리지 않으므로 "여기서 어느 항목이 켜지나" 를 물을 대상이 아니다(목적지에서 묻는다).
 * 소스로 판별한다 — 목록을 손으로 적으면 낡는다(`tests/e2e/utils/learner-routes.ts` 와 같은 판정).
 */
function redirectOnly(routes: string[]): Set<string> {
  const base = path.resolve(__dirname, '../../../app/(main)')
  const out = new Set<string>()
  for (const r of routes) {
    const file = path.join(base, r, 'page.tsx')
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    if (src.includes('redirect(') && src.includes('): never')) out.add(r)
  }
  return out
}

/**
 * 소유자를 요구하지 않는 화면 — **이유가 있는 것만.**
 *
 * `/hub-lab` 은 재설계 실험용이라 학습자 동선이 아니고, `/teacher` 는 교사 표면이다
 * (둘 다 `tests/e2e/utils/learner-routes.ts` 의 `SKIP_ROUTES` 와 같은 이유).
 */
const EXEMPT = new Set(['/hub-lab', '/teacher'])

/**
 * 하단 탭 넷 중 어느 것도 켜지지 않아도 되는 화면 — **학습 표면이 아닌 것만.**
 *
 * `/settings` 는 레일 밖 유틸리티다. 네 표면(Today·Library·Vault·Growth) 중 어디에도
 * 속하지 않고, 억지로 붙이면 그 탭이 거짓말을 한다("Growth 를 보고 있다" 아니다).
 * 데스크톱은 `FOOTER_ITEMS` 가 자기 주소로 갖고 있고, 화면 자신도 세그먼트로 위치를 말한다.
 */
const TABBAR_EXEMPT = new Set(['/settings'])

const allNavItems: NavItem[] = [
  ...META_ITEMS,
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => i.children ?? [])),
  ...ASIDE_GROUP.items,
  ...FOOTER_ITEMS,
]

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** 사이드바가 이 경로에서 켜지는가 (자기 href 또는 owns). */
function sidebarCovers(route: string): boolean {
  return allNavItems.some(
    (i) => under(route, i.href.split('?')[0]) || (i.owns ?? []).some((p) => under(route, p)),
  )
}

/** 하단 탭(모바일)이 이 경로에서 켜지는가. */
function tabBarCovers(route: string): boolean {
  return SURFACE_ORDER.some((id) => {
    const s = SURFACES[id]
    return under(route, s.href) || (s.owns ?? []).some((p) => under(route, p))
  })
}

describe('위치 표시 — 모든 학습자 화면에 소유자가 있다', () => {
  const all = learnerRoutes()
  const shells = redirectOnly(all)
  const routes = all.filter((r) => !EXEMPT.has(r) && !shells.has(r))

  it('라우트를 실제로 찾았다 (0 은 성과가 아니라 측정 실패다)', () => {
    expect(routes.length).toBeGreaterThan(20)
  })

  it('데스크톱 — 사이드바의 어느 항목이 켜진다', () => {
    const orphans = routes.filter((r) => !sidebarCovers(r))
    expect(
      orphans,
      '이 화면들에서는 사이드바 어느 항목에도 aria-current 가 붙지 않는다 — ' +
        'sidebar-config.ts 의 알맞은 항목에 owns 를 더할 것',
    ).toEqual([])
  })

  it('모바일 — 하단 탭 넷 중 하나가 켜진다', () => {
    const orphans = routes.filter((r) => !TABBAR_EXEMPT.has(r) && !tabBarCovers(r))
    expect(
      orphans,
      '이 화면들에서는 하단 탭이 전부 꺼진다(모바일에는 사이드바가 없다) — ' +
        'axes.ts SURFACES 의 알맞은 표면에 owns 를 더할 것',
    ).toEqual([])
  })

  it('사이드바 owns 는 다른 항목의 href 를 가로채지 않는다', () => {
    const hrefs = allNavItems.map((i) => i.href.split('?')[0])
    for (const item of allNavItems) {
      for (const p of item.owns ?? []) {
        const stolen = hrefs.filter((h) => h !== item.href && under(h, p))
        expect(stolen, `${item.label} 의 owns '${p}' 가 ${stolen.join(', ')} 를 삼킨다`).toEqual([])
      }
    }
  })
})
