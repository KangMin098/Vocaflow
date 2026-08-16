// apps/web/src/components/layout/Sidebar.tsx
//
// 5 그룹 IA — sidebar-config.ts 기반 (CLAUDE.md §17.10 IA 정합).
// 구성: [Header(로고+토글)] [META] [divider] [NAV_GROUPS] [divider] [FOOTER]
// 햄버거로 240px ↔ 72px 축소/확대, localStorage 유지.
//
// v06.36 (ADR 0006 D2) — Streak 미니카드 제거. streak 은 StatusRibbon 하나가 그린다.
//   이전에는 같은 값이 Sidebar·FlowNav·HubHero 세 곳에 있었다.
//
// v08.4 — 펼침 하위 메뉴(`NavItem.children`). 지금은 Library 하나만 갖는다.
//   기본은 접힘, 그 구역 안에 있으면 자동 펼침, 셰브런으로 어디서나 수동 토글(세션 한정 —
//   localStorage 에 남기면 "왜 열려 있지" 가 되고, 이 화면의 기본값은 조용함이다).
//   축소(72px)에서는 렌더하지 않는다 — 자리가 없고, 부모 툴팁이 이미 그 일을 한다.

'use client'

import { ChevronDown, Menu, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

import {
  FOOTER_ITEMS,
  META_ITEMS,
  NAV_GROUPS,
  type NavGroup,
  type NavItem,
} from './sidebar-config'

const STORAGE_KEY = 'vocaflow-sidebar-collapsed'

/**
 * 현재 위치가 그 항목(또는 하위)인가.
 *
 * 두 종류의 href 를 함께 다룬다:
 *   · 라우트   `/library/vocab` — 하위 라우트까지 활성 (`/wordvault/study` 에서 Vault 유지)
 *   · 쿼리 뷰  `/text?view=vocab` — `/text` 한 화면의 탭이라 **경로가 같다**. 쿼리를 안 보면
 *     세 자식이 동시에 활성이 되어 "지금 어디"가 세 번 말해진다.
 */
function matchesRoute(
  pathname: string,
  href: string,
  search?: ReadonlyURLSearchParams | null,
): boolean {
  const [path = '', query] = href.split('?')
  if (!query) return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))
  if (pathname !== path) return false
  // 쿼리가 없는 `/text` 진입은 어느 자식도 활성이 아니다 — 화면이 자기 기본 면을 고르고,
  // 그 선택을 사이드바가 아는 척하지 않는다.
  const want = new URLSearchParams(query)
  for (const [k, v] of want.entries()) {
    if (search?.get(k) !== v) return false
  }
  return true
}

/** 펼침 패널 id — 셰브런의 `aria-controls` 가 가리킨다. */
function panelId(href: string): string {
  return `sidebar-sub-${href.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export function Sidebar() {
  const pathname = usePathname()
  // `/text?view=` 자식의 활성 판정용. (main) 세그먼트는 레이아웃이 쿠키를 읽어 전부 동적이라
  // 정적 프리렌더 Suspense 요건에 걸리지 않는다.
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  /**
   * 하위 메뉴 수동 토글 — href → 열림. **없으면 "그 구역에 있는가"가 기본값**이다.
   * 값을 미리 채우지 않는 이유: 채우면 경로가 바뀌어도 옛 판단이 남아, 다른 구역에 가 있는데
   * 열려 있거나 그 반대가 된다. 사용자가 만진 항목만 기억한다.
   */
  const [openSub, setOpenSub] = useState<Record<string, boolean>>({})

  const toggleSub = (href: string) =>
    setOpenSub((prev) => ({
      ...prev,
      [href]: !(prev[href] ?? matchesRoute(pathname ?? '', href)),
    }))

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === '1') setCollapsed(true)
    setMounted(true)
  }, [])

  // 현재 사이드바 폭을 CSS 변수로 노출 — fixed 오버레이(워크스페이스 하단 player 등)가
  //   `md:left-[var(--sidebar-w)]` 로 사이드바를 침범하지 않게. 풀스크린/모바일(hidden)은 0.
  useEffect(() => {
    const w = isFullScreenRoute(pathname) ? '0px' : collapsed ? '72px' : '240px'
    document.documentElement.style.setProperty('--sidebar-w', w)
  }, [collapsed, pathname])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  // 학습 세션 (게임 play / dictate session) 중에는 풀스크린 — 사이드바 숨김.
  // FlowNav 와 동일 로직 (lib/layout/full-screen-routes.ts) 공유.
  if (isFullScreenRoute(pathname)) {
    return null
  }

  return (
    <aside
      aria-label="주 메뉴"
      data-collapsed={collapsed ? 'true' : 'false'}
      className={`sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--bd)] bg-gradient-to-b from-[var(--bg)] via-[var(--bg)] to-[var(--bg2)] md:flex ${
        mounted ? 'transition-[width,opacity] duration-[var(--dur-normal)] ease-[var(--ease)]' : ''
      } ${collapsed ? 'w-[72px]' : 'w-[240px]'}`}
    >
      {/* ── Header — 로고 + 햄버거 토글 ── */}
      <div
        className={`flex h-[64px] shrink-0 items-center border-b border-[var(--bd)] ${
          collapsed ? 'justify-center px-2' : 'justify-between px-3'
        }`}
      >
        {!collapsed && (
          <Link
            href="/hub"
            className="flex min-h-11 items-center gap-2.5 transition-opacity duration-[var(--dur-normal)] hover:opacity-90"
            aria-label="Vocaflow 홈"
          >
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[var(--p-light)] to-[var(--p)] font-display text-[15px] font-[800] text-[var(--ti)] shadow-[0_1px_4px_rgba(59,130,246,0.16)]"
              aria-hidden="true"
            >
              V
            </span>
            <span className="font-display text-[18px] font-[800] tracking-tight text-[var(--t1)]">
              Vocaflow
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          aria-expanded={!collapsed}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <Menu size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* ── 네비게이션 ── */}
      <nav className={`flex-1 overflow-y-auto pb-4 pt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* META — Hub · Dashboard */}
        <ul className="mt-2 flex flex-col gap-0.5">
          {META_ITEMS.map((item) => (
            <NavLinkItem
              key={item.href}
              item={item}
              pathname={pathname}
              search={searchParams}
              collapsed={collapsed}
              openSub={openSub}
              onToggleSub={toggleSub}
            />
          ))}
        </ul>

        {/* divider */}
        <div className="my-4 border-t border-[var(--bd)]" aria-hidden="true" />

        {/* NAV_GROUPS — 학습 흐름 5그룹 + Comics(Scripts 아래 별도 메뉴) */}
        <div className="space-y-6">
          {NAV_GROUPS.map((group) => (
            <NavGroupBlock
              // flowStage 는 더 이상 고유하지 않다 — Comics 그룹이 Scripts 와 같은
              // 'script' 단계를 공유한다(읽기 단계이되 별도 메뉴). 라벨이 고유 키다.
              key={group.label}
              group={group}
              pathname={pathname}
              search={searchParams}
              collapsed={collapsed}
              openSub={openSub}
              onToggleSub={toggleSub}
            />
          ))}
        </div>

        {/* divider */}
        <div className="my-5 border-t border-[var(--bd)]" aria-hidden="true" />

        {/* FOOTER — Settings */}
        <ul className="flex flex-col gap-0.5">
          {FOOTER_ITEMS.map((item) => (
            <NavLinkItem
              key={item.href}
              item={item}
              pathname={pathname}
              search={searchParams}
              collapsed={collapsed}
              openSub={openSub}
              onToggleSub={toggleSub}
            />
          ))}
        </ul>
      </nav>
    </aside>
  )
}

// ── Group block — 라벨 + dot + 항목들 ──
interface NavGroupBlockProps {
  group: NavGroup
  pathname: string
  search: ReadonlyURLSearchParams | null
  collapsed: boolean
  openSub: Record<string, boolean>
  onToggleSub: (href: string) => void
}

function NavGroupBlock({
  group,
  pathname,
  search,
  collapsed,
  openSub,
  onToggleSub,
}: NavGroupBlockProps) {
  return (
    <div>
      {!collapsed ? (
        <h3 className="mb-2.5 flex items-center gap-2.5 px-3">
          <span
            className="h-1 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: group.accent }}
            aria-hidden="true"
          />
          <span className="font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
            {group.label}
          </span>
          <span
            className="h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
            aria-hidden="true"
          />
        </h3>
      ) : (
        <div className="mb-1.5 flex justify-center" aria-hidden="true">
          <span
            className="h-1 w-1 rounded-full opacity-70"
            style={{ backgroundColor: group.accent }}
          />
        </div>
      )}
      <ul className="flex flex-col gap-1">
        {group.items.map((item) => (
          <NavLinkItem
            key={item.href}
            item={item}
            pathname={pathname}
            search={search}
            collapsed={collapsed}
            accent={group.accent}
            openSub={openSub}
            onToggleSub={onToggleSub}
          />
        ))}
      </ul>
    </div>
  )
}

// ── 개별 nav 링크 ──
interface NavLinkItemProps {
  item: NavItem
  pathname: string
  /** 쿼리 뷰 자식(`/text?view=`)의 활성 판정용 */
  search?: ReadonlyURLSearchParams | null
  collapsed: boolean
  /** 활성 시 좌측 인디케이터 + 아이콘 컨테이너 색 — 그룹 accent (META/FOOTER 미지정) */
  accent?: string
  /** href → 수동 토글 결과. 키가 없으면 "그 구역에 있는가" 가 기본값. */
  openSub?: Record<string, boolean>
  onToggleSub?: (href: string) => void
}

function NavLinkItem({
  item,
  pathname,
  search,
  collapsed,
  accent,
  openSub,
  onToggleSub,
}: NavLinkItemProps) {
  // 하위 라우트(/wordvault/study·review 등)에서도 부모 항목 활성 유지.
  const isActive = matchesRoute(pathname, item.href)
  const Icon: LucideIcon = item.icon
  const accentColor = accent ?? 'var(--p)'

  // 활성 배경 — accent 8% mix (Calm UI: 색 자체가 약하게)
  const activeBg = `color-mix(in srgb, ${accentColor} 8%, transparent)`

  // 하위 메뉴 — 축소 모드에서는 자리가 없어 아예 렌더하지 않는다(부모 title 툴팁이 대신).
  const children = item.children ?? []
  const hasSub = children.length > 0 && !collapsed
  const open = hasSub ? (openSub?.[item.href] ?? isActive) : false
  const activeChild = children.find((c) => matchesRoute(pathname, c.href, search))

  // 부모와 자식이 동시에 강조되면 "지금 어디" 가 두 번 말해진다.
  // 하위가 **보이는 상태에서** 자식이 활성이면, 활성 표식은 자식이 갖고 부모는 글자만 굵힌다.
  const parentOwnsActive = isActive && !(open && activeChild)
  const subId = panelId(item.href)

  return (
    <li>
      <div className="relative flex items-center">
        <Link
          href={item.href}
          // 현재 위치 표식은 **정확히 하나**여야 한다. 하위가 보이고 그중 하나가 활성이면 자식이
          // 갖고, 접혀 있거나 축소 모드(자식 미렌더)면 부모가 갖는다 — 안 그러면 축소 상태에서
          // "지금 어디"를 말하는 요소가 하나도 없게 된다.
          aria-current={parentOwnsActive ? 'page' : undefined}
          aria-label={item.ariaLabel ?? item.label}
          title={collapsed ? item.label : undefined}
          // `min-w-0` — flex 항목 기본 min-width:auto 라 긴 라벨이 셰브런을 밀어낸다(truncate 무효화).
          className={`group relative flex min-h-[44px] min-w-0 flex-1 items-center rounded-[var(--r-md)] font-display text-[14px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 ${
            collapsed ? 'justify-center px-1' : 'gap-2.5 pl-3 pr-2'
          } ${
            isActive
              ? 'font-[600] text-[var(--t1)]'
              : 'font-[500] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
          }`}
          style={parentOwnsActive ? { backgroundColor: activeBg } : undefined}
        >
          {/* 활성 좌측 인디케이터 (3px · accent · 확장 모드) */}
          {parentOwnsActive && !collapsed && (
            <span
              className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full"
              style={{ backgroundColor: accentColor }}
              aria-hidden="true"
            />
          )}

          {/* 아이콘 컨테이너 */}
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] transition-colors duration-[var(--dur-normal)] ${
              isActive ? '' : 'bg-[var(--bg2)] group-hover:bg-[var(--bg3)]'
            }`}
            style={
              isActive
                ? { backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)` }
                : undefined
            }
          >
            <Icon
              size={15}
              strokeWidth={1.75}
              aria-hidden="true"
              className={`transition-colors duration-[var(--dur-normal)] ${
                isActive ? '' : 'text-[var(--t2)] group-hover:text-[var(--t2)]'
              }`}
              style={isActive ? { color: accentColor } : undefined}
            />
          </span>

          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        </Link>

        {/* 펼침 토글 — 링크와 **분리된** 버튼. 링크 안에 넣으면 부모로 가는 길이 사라진다.
            44px 하한(프로젝트 절대 규칙)을 지키되 폭을 먹으므로 라벨은 truncate 로 보호된다. */}
        {hasSub && onToggleSub && (
          <button
            type="button"
            onClick={() => onToggleSub(item.href)}
            aria-expanded={open}
            aria-controls={subId}
            aria-label={`${item.label} 하위 메뉴 ${open ? '접기' : '펼치기'}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <ChevronDown
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              className={`transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}
      </div>

      {/* 하위 항목 — 좌측 레일(border-l)이 소속을 그린다. 아이콘 컨테이너는 두지 않는다
          (같은 크기의 상자를 한 단계 더 쌓으면 층위가 안 읽힌다 — 깊이는 들여쓰기가 말한다). */}
      {hasSub && open && (
        <ul
          id={subId}
          className="ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-[var(--bd)] pl-1.5"
        >
          {children.map((child) => {
            const childActive = matchesRoute(pathname, child.href, search)
            const ChildIcon: LucideIcon = child.icon
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={childActive ? 'page' : undefined}
                  aria-label={child.ariaLabel ?? child.label}
                  className={`flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-2 font-display text-[13px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 ${
                    childActive
                      ? 'font-[600] text-[var(--t1)]'
                      : 'font-[500] text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
                  }`}
                  style={childActive ? { backgroundColor: activeBg } : undefined}
                >
                  <ChildIcon
                    size={14}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="shrink-0"
                    style={childActive ? { color: accentColor } : undefined}
                  />
                  <span className="flex-1 truncate">{child.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
