// apps/web/src/components/layout/Sidebar.tsx

'use client'

import {
  BarChart3,
  BookMarked,
  Flame,
  HelpCircle,
  Home,
  Layers,
  Library,
  Plus,
  Settings,
  Type,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  Icon: LucideIcon
}

interface NavGroup {
  label: string | null
  color: string | null
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    color: null,
    items: [{ href: '/hub', label: 'Hub', Icon: Home }],
  },
  {
    label: '입력',
    color: 'var(--p)',
    items: [
      { href: '/library', label: '라이브러리', Icon: Library },
      { href: '/text', label: '직접 입력', Icon: Plus },
    ],
  },
  {
    label: '학습',
    color: '#8B5CF6',
    items: [
      { href: '/wordvault', label: '단어장', Icon: BookMarked },
      { href: '/flashcard', label: '플래시카드', Icon: Layers },
    ],
  },
  {
    label: '게임',
    color: 'var(--active)',
    items: [
      { href: '/spellforge', label: 'SpellForge', Icon: Type },
      { href: '/wordblitz', label: 'WordBlitz', Icon: Zap },
      { href: '/scriptquiz', label: 'ScriptQuiz', Icon: HelpCircle },
    ],
  },
  {
    label: '분석',
    color: 'var(--info)',
    items: [{ href: '/dashboard', label: '통계', Icon: BarChart3 }],
  },
]

interface SidebarProps {
  userName: string
  streak: number
  todayCount: number
}

export function Sidebar({ userName, streak, todayCount }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      aria-label="주 메뉴"
      className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-[var(--bd)] bg-gradient-to-b from-[var(--bg)] via-[var(--bg)] to-[var(--bg2)] md:flex"
    >
      {/* ── 로고 ── */}
      <Link
        href="/hub"
        className="flex h-[64px] shrink-0 items-center gap-2.5 border-b border-[var(--bd)] px-5 transition-opacity duration-[var(--dur-normal)] hover:opacity-90"
      >
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[var(--p)] to-[var(--p-dark)] font-display text-[15px] font-[800] text-[var(--ti)] shadow-[0_2px_8px_rgba(59,130,246,0.25)]"
          aria-hidden="true"
        >
          V
        </span>
        <span className="font-display text-[18px] font-[800] tracking-tight text-[var(--t1)]">
          Vocaflow
        </span>
      </Link>

      {/* ── Streak 미니 카드 ── */}
      <div className="mx-3 mb-2 mt-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg2)] to-[var(--bg3)] px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame size={13} strokeWidth={2} className="text-[var(--active)]" aria-hidden="true" />
            <span className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
              Streak
            </span>
          </div>
          <span className="font-display text-[16px] font-[800] tabular-nums text-[var(--t1)]">
            {streak}일
          </span>
        </div>
      </div>

      {/* ── 네비게이션 ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {NAV_GROUPS.map((group, idx) => (
          <div key={idx} className={idx > 0 ? 'mt-6' : 'mt-2'}>
            {group.label && (
              <h3 className="mb-2.5 flex items-center gap-2.5 px-3">
                {group.color && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="font-display text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t3)]">
                  {group.label}
                </span>
                <span
                  className="h-px flex-1 bg-gradient-to-r from-[var(--bd)] to-transparent"
                  aria-hidden="true"
                />
              </h3>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-[var(--r-md)] py-1.5 pl-3 pr-2 font-display text-[14px] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 ${
                        isActive
                          ? `bg-[var(--bg)] font-[600] text-[var(--t1)] shadow-[var(--sh-sm)] ring-1 ring-[var(--bd)]`
                          : `font-[500] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] hover:shadow-[inset_0_0_0_1px_var(--bd)]`
                      } `}
                    >
                      {/* 활성 인디케이터 + glow */}
                      {isActive && (
                        <span
                          className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full bg-[var(--p)] shadow-[2px_0_8px_-2px_var(--p)]"
                          aria-hidden="true"
                        />
                      )}

                      {/* 아이콘 컨테이너 */}
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] transition-colors duration-[var(--dur-normal)] ${
                          isActive
                            ? 'bg-[var(--p-light)]'
                            : 'bg-[var(--bg2)] group-hover:bg-[var(--bg3)]'
                        } `}
                      >
                        <item.Icon
                          size={15}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className={`transition-colors duration-[var(--dur-normal)] ${
                            isActive
                              ? 'text-[var(--p)]'
                              : 'text-[var(--t3)] group-hover:text-[var(--t2)]'
                          } `}
                        />
                      </span>

                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── 사용자 영역 ── */}
      <div className="shrink-0 border-t border-[var(--bd)] bg-gradient-to-b from-transparent to-[var(--bg2)] p-3">
        <Link
          href="/settings"
          className="group flex items-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-2 transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg)] hover:shadow-[var(--sh-sm)] hover:ring-1 hover:ring-[var(--bd)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          aria-label="설정으로 이동"
        >
          {/* 아바타 */}
          <span
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-full)] bg-gradient-to-br from-[var(--p)] to-[var(--p-dark)] font-display text-[14px] font-[800] text-[var(--ti)] shadow-[0_2px_6px_rgba(59,130,246,0.25)] ring-2 ring-[var(--bg)]"
            aria-hidden="true"
          >
            {userName.slice(0, 1)}
            {/* 온라인 점 */}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--bg)]" />
          </span>

          {/* 이름 + 미니 stat */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13px] font-[600] text-[var(--t1)]">
              {userName}
            </p>
            <p className="truncate font-body text-[11px] text-[var(--t3)]">
              오늘 {todayCount}단어 학습
            </p>
          </div>

          <Settings
            size={15}
            strokeWidth={1.75}
            className="shrink-0 text-[var(--t3)] opacity-0 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100"
            aria-hidden="true"
          />
        </Link>
      </div>
    </aside>
  )
}
