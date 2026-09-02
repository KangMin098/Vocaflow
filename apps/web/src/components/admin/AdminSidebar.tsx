// apps/web/src/components/admin/AdminSidebar.tsx

'use client'

import {
  ArrowLeft,
  BarChart3,
  BookImage,
  BookMarked,
  Brain,
  CreditCard,
  Database,
  Flag,
  Gauge,
  LayoutDashboard,
  Library,
  Newspaper,
  PenLine,
  Scale,
  ScanLine,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  Icon: LucideIcon
  badge?: number
}

interface NavGroup {
  label: string | null
  color: string | null
  items: NavItem[]
}

interface AdminSidebarProps {
  /** 미처리 신고 건수 — 0 또는 미지정 시 뱃지 숨김. layout.tsx에서 reports COUNT 주입. */
  reportsBadge?: number
}

function buildNavGroups(reportsBadge: number): NavGroup[] {
  return [
  {
    label: null,
    color: null,
    items: [{ href: '/admin', label: '대시보드', Icon: LayoutDashboard }],
  },
  {
    label: '사용자 & 콘텐츠',
    color: '#8B5CF6',
    items: [
      { href: '/admin/users', label: '사용자', Icon: Users },
      { href: '/admin/library', label: '콘텐츠', Icon: Library },
      { href: '/admin/curation', label: 'LCP Pipeline', Icon: Workflow },
      { href: '/admin/articles', label: 'ACP Pipeline', Icon: Newspaper },
      // ACP §20 — 사실 재저작. ACP(수집·발행)와 다른 파이프라인이라 항목을 나눈다:
      //   ACP 는 남의 본문을 가져오고, Compose 는 사실만 가져와 우리가 쓴다.
      { href: '/admin/compose', label: 'Compose Pipeline', Icon: PenLine },
      { href: '/admin/vocabulary', label: '단어장 마스터', Icon: BookMarked },
      { href: '/admin/vocab', label: 'VCB Pipeline', Icon: Sparkles },
      { href: '/admin/vrl', label: 'VRL Pipeline', Icon: Brain },
      { href: '/admin/vrl/automation', label: 'VRL Automation', Icon: Workflow },
      { href: '/admin/comic', label: 'Comic Pipeline', Icon: BookImage },
      // PDCP — 퍼블릭도메인 스캔 만화. CCP(위)와 단계·QC·법적 게이트가 전부 달라 별도 메뉴.
      { href: '/admin/pd-comics', label: 'PD Comic Pipeline', Icon: ScanLine },
      { href: '/admin/topic-corpus', label: 'TCP Pipeline', Icon: Workflow },
      // TBP — 교재. 조작 버튼이 없는 관측 화면이다(생성은 Claude Code 드레인).
      { href: '/admin/textbook', label: 'TBP Pipeline', Icon: BookMarked },
      // CSAT — 평가원 기출 분석. 조작 버튼 없는 관측 화면(분석·검수는 Claude Code 드레인).
      { href: '/admin/csat', label: 'CSAT Pipeline', Icon: Scale },
      { href: '/admin/pending-words', label: 'Pending Words', Icon: Database },
    ],
  },
  {
    label: '운영',
    color: 'var(--info)',
    items: [
      { href: '/admin/analytics', label: '플랫폼 분석', Icon: BarChart3 },
      { href: '/admin/quality', label: '품질 지표', Icon: Gauge },
      { href: '/admin/quality/gates', label: '품질 게이트', Icon: ShieldCheck },
      { href: '/admin/quality/judge', label: '추출 판정', Icon: Scale },
      { href: '/admin/reports', label: '신고/문의', Icon: Flag, badge: reportsBadge },
      { href: '/admin/billing', label: '결제/구독', Icon: CreditCard },
    ],
  },
  {
    label: '시스템',
    color: 'var(--active)',
    items: [{ href: '/admin/settings', label: '시스템 설정', Icon: Sliders }],
  },
  ]
}

export function AdminSidebar({ reportsBadge = 0 }: AdminSidebarProps = {}) {
  const pathname = usePathname() ?? ''
  const NAV_GROUPS = buildNavGroups(reportsBadge)

  // 활성 항목 = 현재 경로에 매칭되는 href 중 "가장 구체적(최장)" 1개.
  //   startsWith 경계(+'/')로 /admin/vocab ↔ /admin/vocabulary 오매칭 차단,
  //   최장일치로 /admin/vrl ↔ /admin/vrl/automation 동시 하이라이트 차단.
  const activeHref =
    NAV_GROUPS.flatMap((g) => g.items)
      .map((i) => i.href)
      .filter((h) => pathname === h || (h !== '/admin' && pathname.startsWith(h + '/')))
      .sort((a, b) => b.length - a.length)[0] ?? null

  return (
    <aside
      aria-label="관리자 메뉴"
      className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-[var(--bd)] bg-gradient-to-b from-[var(--bg)] via-[var(--bg)] to-[var(--bg2)] md:flex"
    >
      {/* ── 로고 ── */}
      <Link
        href="/admin"
        className="flex h-[64px] shrink-0 items-center gap-3 border-b border-[var(--bd)] px-5 transition-opacity duration-[var(--dur-normal)] hover:opacity-90"
      >
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6] font-display text-[15px] font-[800] text-[var(--ti)] shadow-[0_1px_4px_rgba(139,92,246,0.18)]"
          aria-hidden="true"
        >
          <ShieldCheck size={16} strokeWidth={2.25} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[14px] font-[800] tracking-tight text-[var(--t1)]">
            Vocaflow
          </span>
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
            Admin
          </span>
        </div>
      </Link>

      {/* ── Mode 알림 ── */}
      <div className="mx-3 mb-2 mt-4 rounded-[var(--r-md)] border border-[#8B5CF6]/30 bg-[#8B5CF6]/8 px-3 py-2">
        <div className="flex items-start gap-2">
          <ShieldCheck
            size={13}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-[#8B5CF6]"
            aria-hidden="true"
          />
          <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
            <span className="font-display font-[700] text-[#8B5CF6]">관리자 모드</span> · 시스템
            데이터에 접근 중
          </p>
        </div>
      </div>

      {/* ── 네비게이션 ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {NAV_GROUPS.map((group, idx) => (
          <div key={idx} className={idx > 0 ? 'mt-6' : 'mt-2'}>
            {group.label && (
              <h3 className="mb-2.5 flex items-center gap-3 px-3">
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
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = item.href === activeHref
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative flex items-center gap-3 rounded-[var(--r-md)] py-2 pl-3 pr-2 font-display text-[14px] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
                        isActive
                          ? 'bg-[var(--bg)] font-[600] text-[var(--t1)] shadow-[var(--sh-sm)] ring-1 ring-[var(--bd)]'
                          : 'font-[500] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] hover:shadow-[inset_0_0_0_1px_var(--bd)]'
                      } `}
                    >
                      {isActive && (
                        <span
                          className="absolute bottom-1.5 left-0 top-1.5 w-[2.5px] rounded-r-full bg-[#A78BFA]"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] transition-colors duration-[var(--dur-normal)] ${
                          isActive
                            ? 'bg-[#8B5CF6]/12'
                            : 'bg-[var(--bg2)] group-hover:bg-[var(--bg3)]'
                        } `}
                      >
                        <item.Icon
                          size={15}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className={`transition-colors duration-[var(--dur-normal)] ${
                            isActive
                              ? 'text-[#8B5CF6]'
                              : 'text-[var(--t3)] group-hover:text-[var(--t2)]'
                          } `}
                        />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className="inline-flex shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[var(--error)] px-2 py-1 font-display text-[10px] font-[700] text-white"
                          aria-label={`미처리 ${item.badge}개`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── 사용자 앱으로 돌아가기 ── */}
      <div className="shrink-0 border-t border-[var(--bd)] bg-gradient-to-b from-transparent to-[var(--bg2)] p-3">
        <Link
          href="/hub"
          className="group flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2 transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg)] hover:shadow-[var(--sh-sm)] hover:ring-1 hover:ring-[var(--bd)]"
        >
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg2)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[var(--p-light)] group-hover:text-[var(--p)]"
            aria-hidden="true"
          >
            <ArrowLeft size={15} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13px] font-[600] text-[var(--t1)]">
              사용자 앱으로
            </p>
            <p className="truncate font-body text-[11px] text-[var(--t3)]">/hub</p>
          </div>
          <Database
            size={13}
            strokeWidth={1.75}
            className="shrink-0 text-[var(--t3)] opacity-0 transition-opacity duration-[var(--dur-normal)] group-hover:opacity-100"
            aria-hidden="true"
          />
        </Link>
      </div>
    </aside>
  )
}
