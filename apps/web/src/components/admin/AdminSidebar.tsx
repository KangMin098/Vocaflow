// apps/web/src/components/admin/AdminSidebar.tsx

'use client'

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookImage,
  BookMarked,
  Brain,
  ClipboardCheck,
  CreditCard,
  Database,
  Factory,
  FileText,
  Flag,
  Gauge,
  GraduationCap,
  Grid3x3,
  History,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareText,
  Library,
  Network,
  Newspaper,
  PenLine,
  Scale,
  Printer,
  ScanLine,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
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
  /**
   * 하위 항목 — **부모가 활성일 때만** 펼쳐진다.
   *
   * 파이프라인 하나가 공정 여러 칸으로 갈리면(교재 공장) 그 칸을 전부 1차 메뉴에 세울 수 없다 —
   * 다른 파이프라인 12개가 밀려난다. 그렇다고 안 세우면 그 화면들은 URL 을 아는 사람만 쓴다.
   * 그래서 **들어갔을 때만** 보이게 한다.
   */
  children?: NavItem[]
  /**
   * 하위 항목을 다시 묶는 머리글 — 값이 바뀌는 지점에 작은 구분선이 들어간다.
   *
   * 공정이 여덟이면 하위를 한 줄로 늘어놓아도 **어디서 성격이 바뀌는지** 안 보인다.
   * 교재 공장은 「무엇을 만들지 정하는 구간」과 「정한 대로 찍는 구간」이 나뉘고,
   * 그 경계를 모르면 관리자가 규격을 고쳐야 할 때 재고 화면을 뒤진다.
   */
  group?: string
  /**
   * 아직 화면이 없는 칸 — **링크가 아니라 글자**로 둔다.
   *
   * 빼면 그 공정이 없는 것처럼 보이고(현황판 도식에는 있으므로 메뉴와 어긋난다), 링크로 걸면
   * 눌러 보고 "고장" 이라고 판단한다. 왜 없는지를 title 로 말한다.
   */
  pendingNote?: string
}

interface NavGroup {
  label: string | null
  color: string | null
  items: NavItem[]
}

interface AdminSidebarProps {
  /**
   * 미처리 신고 건수. `null` = 셀 곳이 없음(reports 테이블 미구현) — 0 과 다르다.
   * 0 이나 null 이면 뱃지를 숨긴다. layout.tsx 가 주입.
   */
  reportsBadge?: number | null
}

function buildNavGroups(reportsBadge: number | null): NavGroup[] {
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
      // VRL 은 화면이 7개인데 오래도록 이 둘만 메뉴에 있었다. 나머지 5개(분류 기준표·진단·
      // 사용자 레벨·변경 이력·의심 단어)로 가는 상시 링크는 **한 개도 없었고**, 유일한 통로가
      // 접힌 「화면 도움말」 패널 안의 각주라 3단을 펼쳐야 닿았다. 교재 공장이 쓰는 children
      // 패턴을 그대로 적용한다 — 밖에서는 한 줄, 안에 들어오면 공정 전체가 보인다.
      {
        href: '/admin/vrl',
        label: 'VRL Pipeline',
        Icon: Brain,
        children: [
          { href: '/admin/vrl/taxonomy', label: '분류 기준표', Icon: Network },
          { href: '/admin/vrl/diagnostic', label: '진단', Icon: GraduationCap },
          { href: '/admin/vrl/users', label: '사용자 레벨', Icon: Users },
          { href: '/admin/vrl/concerns', label: '의심 단어', Icon: AlertTriangle },
          { href: '/admin/vrl/snapshots', label: '변경 이력', Icon: History },
          { href: '/admin/vrl/automation', label: '자동화', Icon: Workflow },
        ],
      },
      { href: '/admin/comic', label: 'Comic Pipeline', Icon: BookImage },
      // PDCP — 퍼블릭도메인 스캔 만화. CCP(위)와 단계·QC·법적 게이트가 전부 달라 별도 메뉴.
      { href: '/admin/pd-comics', label: 'PD Comic Pipeline', Icon: ScanLine },
      { href: '/admin/topic-corpus', label: 'TCP Pipeline', Icon: Workflow },
      // TBP — 교재. 조작 버튼이 없는 관측 화면이다(생성은 Claude Code 드레인).
      { href: '/admin/textbook', label: 'TBP Pipeline', Icon: BookMarked },
      // 교재 공장 — 시중 제작 공정(기획→설계→소재→집필→해설→검수→조판)을 8칸으로 세운 라인.
      // 조작 버튼은 없지만 **관측 화면이 아니다** — 칸마다 다음에 돌릴 명령을 들고 있다.
      {
        href: '/admin/csat',
        label: '교재 공장',
        Icon: Factory,
        children: [
          // 레인 둘 — 규격을 정하는 구간과 정한 대로 찍는 구간. 경계를 안 보이게 두면
          // 관리자가 규격을 고쳐야 할 때 재고 화면을 뒤진다.
          // 카탈로그가 맨 위다 — 「뭘 만드나」에 답하는 유일한 화면이고, 나머지는 전부
          // "그것을 어떻게/무엇으로" 다. 순서가 곧 관리자가 묻는 순서여야 한다.
          { href: '/admin/csat/catalog', label: '⓪ 카탈로그', Icon: LayoutGrid, group: '무엇을 만드나' },
          { href: '/admin/csat/evidence', label: '① 기출 원천', Icon: Scale, group: '전략 연구소' },
          { href: '/admin/csat/strategy', label: '② 기획', Icon: Target },
          { href: '/admin/csat/blueprint', label: '③ 설계', Icon: Grid3x3 },
          { href: '/admin/csat/sourcing', label: '④ 소재', Icon: FileText, group: '생산 라인' },
          { href: '/admin/csat/authoring', label: '⑤ 집필', Icon: PenLine },
          {
            href: '/admin/csat',
            label: '⑥ 해설',
            Icon: MessageSquareText,
            pendingNote:
              '전용 화면은 아직 없다 — 해설 보유율은 현황판 ⑥ 눈금에서 본다(2026-09-06 부터 집계표로 실측). 유형·수준별 분포까지 보려면 화면이 필요하다',
          },
          { href: '/admin/csat/review', label: '⑦ 검수', Icon: ClipboardCheck },
          { href: '/admin/csat/press', label: '⑧ 조판·발행', Icon: Printer },
        ],
      },
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
      { href: '/admin/reports', label: '신고/문의', Icon: Flag, badge: reportsBadge ?? undefined },
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

export function AdminSidebar({ reportsBadge = null }: AdminSidebarProps = {}) {
  const pathname = usePathname() ?? ''
  const NAV_GROUPS = buildNavGroups(reportsBadge)

  // 활성 항목 = 현재 경로에 매칭되는 href 중 "가장 구체적(최장)" 1개.
  //   startsWith 경계(+'/')로 /admin/vocab ↔ /admin/vocabulary 오매칭 차단,
  //   최장일치로 /admin/vrl ↔ /admin/vrl/automation 동시 하이라이트 차단.
  // 하위 항목도 후보에 넣는다 — 빼면 '/admin/csat/evidence' 에서 부모만 켜지고
  //   그 화면은 메뉴에서 자기 자리를 못 찾는다.
  const activeHref =
    NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]))
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
                // 하위 메뉴는 그 파이프라인 안에 있을 때만 편다 — 밖에서는 한 줄로 접혀 있다.
                const inSection =
                  pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`min-h-[44px] group relative flex items-center gap-3 rounded-[var(--r-md)] py-2 pl-3 pr-2 font-display text-[14px] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
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
                    {item.children?.length && inSection ? (
                      <ul className="mt-1 flex flex-col gap-1 border-l border-[var(--bd)] pl-3">
                        {item.children.map((child) => {
                          const childActive = child.href === activeHref
                          return (
                            <li key={child.label}>
                              {child.group ? (
                                <p className="mb-1 mt-2 px-2 font-display text-[9.5px] font-[700] uppercase tracking-[0.10em] text-[var(--t3)] first:mt-0">
                                  {child.group}
                                </p>
                              ) : null}
                              {child.pendingNote ? (
                                // 아직 화면이 없는 칸 — 링크가 아니라 글자. 눌러 보고 "고장" 이라고
                                // 판단하는 것보다 없다고 보이는 편이 낫다.
                                <span
                                  title={child.pendingNote}
                                  className="flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-2 font-display text-[13px] font-[500] text-[var(--t3)] opacity-60"
                                >
                                  <child.Icon
                                    size={13}
                                    strokeWidth={1.75}
                                    aria-hidden="true"
                                    className="text-[var(--t3)]"
                                  />
                                  <span className="flex-1 truncate">{child.label}</span>
                                  <span className="shrink-0 rounded bg-[var(--bg2)] px-1 py-0.5 font-body text-[9.5px]">
                                    준비 중
                                  </span>
                                </span>
                              ) : (
                                <Link
                                  href={child.href}
                                  aria-current={childActive ? 'page' : undefined}
                                  className={`flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-2 font-display text-[13px] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
                                    childActive
                                      ? 'bg-[var(--bg)] font-[600] text-[var(--t1)] ring-1 ring-[var(--bd)]'
                                      : 'font-[500] text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] active:bg-[var(--bd)]'
                                  }`}
                                >
                                  <child.Icon
                                    size={13}
                                    strokeWidth={1.75}
                                    aria-hidden="true"
                                    className={childActive ? 'text-[#8B5CF6]' : 'text-[var(--t3)]'}
                                  />
                                  <span className="flex-1 truncate">{child.label}</span>
                                </Link>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
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
          className="min-h-[44px] group flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2 transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg)] hover:shadow-[var(--sh-sm)] hover:ring-1 hover:ring-[var(--bd)]"
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
