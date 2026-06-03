// apps/web/src/components/layout/Sidebar.tsx
//
// 5 그룹 IA — sidebar-config.ts 기반 (CLAUDE.md §17.10 IA 정합).
// 구성: [Header(로고+토글)] [Streak 미니카드] [META] [divider] [NAV_GROUPS×5] [divider] [FOOTER]
// 햄버거로 240px ↔ 72px 축소/확대, localStorage 유지.

'use client'

import { Flame, Menu, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

interface SidebarProps {
  streak: number
}

export function Sidebar({ streak }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === '1') setCollapsed(true)
    setMounted(true)
  }, [])

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
            className="flex items-center gap-2.5 transition-opacity duration-[var(--dur-normal)] hover:opacity-90"
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <Menu size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* ── Streak 미니 카드 (collapsed 시 아이콘만) ── */}
      {collapsed ? (
        <Link
          href="/dashboard"
          className="mx-auto mb-2 mt-4 inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg2)] to-[var(--bg3)] text-[var(--active)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          aria-label={`연속 학습 ${streak}일`}
          title={`Streak ${streak}일`}
        >
          <Flame size={15} strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : (
        <div className="mx-3 mb-2 mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg2)] to-[var(--bg3)] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame
                size={13}
                strokeWidth={2}
                className="text-[var(--active)]"
                aria-hidden="true"
              />
              <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
                Streak
              </span>
            </div>
            <span className="font-display text-[16px] font-[800] tabular-nums text-[var(--t1)]">
              {streak}일
            </span>
          </div>
        </div>
      )}

      {/* ── 네비게이션 ── */}
      <nav className={`flex-1 overflow-y-auto pb-4 pt-2 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* META — Hub · Dashboard */}
        <ul className="mt-2 flex flex-col gap-0.5">
          {META_ITEMS.map((item) => (
            <NavLinkItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </ul>

        {/* divider */}
        <div className="my-4 border-t border-[var(--bd)]" aria-hidden="true" />

        {/* NAV_GROUPS — 5 그룹 (FlowNav 1:1 매핑) */}
        <div className="space-y-6">
          {NAV_GROUPS.map((group) => (
            <NavGroupBlock
              key={group.flowStage}
              group={group}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* divider */}
        <div className="my-5 border-t border-[var(--bd)]" aria-hidden="true" />

        {/* FOOTER — Settings */}
        <ul className="flex flex-col gap-0.5">
          {FOOTER_ITEMS.map((item) => (
            <NavLinkItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
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
  collapsed: boolean
}

function NavGroupBlock({ group, pathname, collapsed }: NavGroupBlockProps) {
  return (
    <div>
      {!collapsed ? (
        <h3 className="mb-2.5 flex items-center gap-2.5 px-3">
          <span
            className="h-1 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: group.accent }}
            aria-hidden="true"
          />
          <span className="font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
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
            collapsed={collapsed}
            accent={group.accent}
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
  collapsed: boolean
  /** 활성 시 좌측 인디케이터 + 아이콘 컨테이너 색 — 그룹 accent (META/FOOTER 미지정) */
  accent?: string
}

function NavLinkItem({ item, pathname, collapsed, accent }: NavLinkItemProps) {
  const isActive = pathname === item.href
  const Icon: LucideIcon = item.icon
  const accentColor = accent ?? 'var(--p)'

  // 활성 배경 — accent 8% mix (Calm UI: 색 자체가 약하게)
  const activeBg = `color-mix(in srgb, ${accentColor} 8%, transparent)`

  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.ariaLabel ?? item.label}
        title={collapsed ? item.label : undefined}
        className={`group relative flex min-h-[44px] items-center rounded-[var(--r-md)] font-display text-[14px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 ${
          collapsed ? 'justify-center px-1' : 'gap-2.5 pl-3 pr-2'
        } ${
          isActive
            ? 'font-[600] text-[var(--t1)]'
            : 'font-[500] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
        }`}
        style={isActive ? { backgroundColor: activeBg } : undefined}
      >
        {/* 활성 좌측 인디케이터 (3px · accent · 확장 모드) */}
        {isActive && !collapsed && (
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
              isActive ? '' : 'text-[var(--t3)] group-hover:text-[var(--t2)]'
            }`}
            style={isActive ? { color: accentColor } : undefined}
          />
        </span>

        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </Link>
    </li>
  )
}
