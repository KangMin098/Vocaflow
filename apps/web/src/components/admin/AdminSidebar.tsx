// apps/web/src/components/admin/AdminSidebar.tsx

'use client'

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookImage,
  BookMarked,
  Brain,
  ChevronRight,
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
  Wand2,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useState } from 'react'

export interface NavItem {
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
   *
   * ⚠️ 하위의 href 가 **부모 밖일 수 있다.** 펼침 판정을 부모 href 만으로 하면 그 항목을
   *   누르는 순간 자기가 속한 메뉴가 통째로 접힌다 — 화면은 멀쩡히 뜨므로 눈으로는 안 잡힌다.
   *   그래서 `inSection()` 이 자식 href 까지 본다.
   *
   *   2026-09-06 현재 그런 항목은 **없다**(「원문 적격」이 `/admin/textbook/sources` 에서
   *   `/admin/csat/sources` 로 옮겨 오면서 마지막 하나가 사라졌다). 그래도 판정은 남긴다 —
   *   이 메뉴는 라우트가 아직 안 옮겨진 화면을 **자리부터** 잡아 주는 일을 반복해 왔고,
   *   다음에 또 그럴 때 조용히 접히는 대신 그냥 동작해야 한다.
   */
  children?: NavItem[]
  /**
   * 오른쪽 끝의 작은 색인 — **라벨이 아니다.**
   *
   * 두 가지를 나른다: 공정 번호(`①`~`⑧`)와 파이프라인 약칭(`LCP`·`VCB`). 둘 다 이름과 같은
   * 무게로 읽히면 안 된다 — 「⓪ 카탈로그」처럼 앞에 달면 눈에 먼저 들어오는 것이 동그라미
   * 숫자 아홉 개가 되고, 「LCP Pipeline」처럼 이름 자리를 차지하면 **한국어 이름이 사라진다**
   * (실측 2026-09-06: 1차 항목 22개 중 7개가 이름 대신 약칭만 달고 있었다).
   *
   * 그래도 지울 수는 없다 — 현황판 도식과 도움말이 「공정 ②」로 부르고, 문서·스크립트가
   * 「LCP」로 부른다. 그래서 **떼어서 오른쪽에 작게** 둔다. 11px 아래로는 내리지 않는다.
   */
  tag?: string
  /**
   * 하위 항목을 다시 묶는 머리글 — 값이 바뀌는 지점에서 묶음이 갈린다.
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
   *
   * ⚠️ 흐리게 하려고 `opacity` 를 걸지 않는다 — `--t3`(4.77:1) 에 `opacity-60` 을 곱하면
   *   실효 대비가 **2.31:1** 로 떨어져 AA 를 깬다. 흐림은 색으로 표현하고 투명도는 안 건드린다.
   */
  pendingNote?: string
}

export interface NavGroup {
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

/**
 * 메뉴 정본.
 *
 * ── 왜 묶음을 쪼갰나 (2026-09-06) ────────────────────────────────────
 * 「사용자 & 콘텐츠」 한 묶음에 1차 항목이 **13개** 있었다. 머리글 없이 열세 줄이 이어지면
 * 눈이 한 번에 못 훑어서, 찾는 화면이 있어도 **목록을 처음부터 다시 읽는다.** 게다가 그중
 * 일곱이 이름 대신 약칭(`LCP Pipeline`·`VCB Pipeline`…)을 달고 있어서, 무엇을 만드는
 * 파이프라인인지 라벨이 말하지 않았다.
 *
 * 그래서 두 가지를 했다:
 *   · 묶음을 **만드는 것 기준**으로 쪼갰다 — 교재 / 콘텐츠 공급 / 어휘 / 운영 / 품질·시스템.
 *     가장 큰 묶음이 13 → 7 이 됐다.
 *   · 라벨을 **한국어 이름**으로 바꾸고 약칭은 오른쪽 색인(`tag`)으로 내렸다.
 *
 * 「교재」를 맨 위로 올린 것은 순서가 곧 쓰는 빈도이기 때문이다.
 */
function buildNavGroups(reportsBadge: number | null): NavGroup[] {
  return [
    {
      label: null,
      color: null,
      items: [{ href: '/admin', label: '대시보드', Icon: LayoutDashboard }],
    },
    {
      label: '교재',
      color: '#8B5CF6',
      items: [
        // 교재 공장 — 시중 제작 공정(기획→설계→소재→집필→해설→검수→조판)을 8칸으로 세운 라인.
        {
          href: '/admin/csat',
          label: '교재 공장',
          Icon: Factory,
          children: [
            // 「만들기」가 맨 위다 — 이 파이프라인에 오는 이유의 대부분이 **한 권을 내는 것**이고,
            // 나머지 칸은 전부 "그 한 권을 무엇으로/어떻게" 다. 순서가 곧 관리자가 묻는 순서다.
            {
              href: '/admin/csat/new',
              label: '새 교재 만들기',
              Icon: Wand2,
              group: '만들기',
            },
            { href: '/admin/csat/catalog', label: '카탈로그', Icon: LayoutGrid },
            {
              href: '/admin/csat/evidence',
              label: '기출 원천',
              tag: '①',
              Icon: Scale,
              group: '재료',
            },
            // 「원문 적격」 — 재고가 아니라 **자격**을 본다: 재고가 있어도 판정을 통과 못 하면 못 싣는다.
            // 라우트도 2026-09-06 에 `/admin/textbook/sources` → 여기로 옮겼다. 메뉴에서는 교재
            // 공장 안인데 URL 은 다른 파이프라인이면, 주소창과 메뉴가 서로 다른 말을 한다.
            { href: '/admin/csat/sources', label: '원문 적격', Icon: BookMarked },
            { href: '/admin/csat/strategy', label: '기획', tag: '②', Icon: Target, group: '공정' },
            { href: '/admin/csat/blueprint', label: '설계', tag: '③', Icon: Grid3x3 },
            { href: '/admin/csat/sourcing', label: '소재', tag: '④', Icon: FileText },
            { href: '/admin/csat/authoring', label: '집필', tag: '⑤', Icon: PenLine },
            {
              href: '/admin/csat',
              label: '해설',
              tag: '⑥',
              Icon: MessageSquareText,
              pendingNote:
                '전용 화면을 **안 만든다** — 답이 이미 두 곳에 있다. 전체 보유율은 현황판 ⑥ 눈금, 어느 권이 해설 때문에 막혔는지는 카탈로그의 「해설 모자람」 칸이다. 화면을 더 만들면 같은 값을 세 곳에서 세게 된다',
            },
            { href: '/admin/csat/review', label: '검수', tag: '⑦', Icon: ClipboardCheck },
            {
              href: '/admin/csat/press',
              label: '조판·발행',
              tag: '⑧',
              Icon: Printer,
              group: '출고',
            },
          ],
        },
      ],
    },
    {
      label: '콘텐츠 공급',
      color: '#8B5CF6',
      items: [
        { href: '/admin/library', label: '콘텐츠', Icon: Library },
        { href: '/admin/curation', label: '도서 수집', tag: 'LCP', Icon: Workflow },
        { href: '/admin/articles', label: '짧은 글', tag: 'ACP', Icon: Newspaper },
        // ACP §20 — 사실 재저작. ACP(수집·발행)와 다른 파이프라인이라 항목을 나눈다:
        //   ACP 는 남의 본문을 가져오고, Compose 는 사실만 가져와 우리가 쓴다.
        { href: '/admin/compose', label: '사실 재저작', tag: 'Compose', Icon: PenLine },
        { href: '/admin/comic', label: '만화', tag: 'CCP', Icon: BookImage },
        // PDCP — 퍼블릭도메인 스캔 만화. CCP(위)와 단계·QC·법적 게이트가 전부 달라 별도 메뉴.
        { href: '/admin/pd-comics', label: '스캔 만화', tag: 'PDCP', Icon: ScanLine },
        { href: '/admin/topic-corpus', label: '주제 코퍼스', tag: 'TCP', Icon: Workflow },
      ],
    },
    {
      label: '어휘',
      color: '#8B5CF6',
      items: [
        { href: '/admin/vocabulary', label: '단어장 마스터', Icon: BookMarked },
        { href: '/admin/vocab', label: '어휘 빌드', tag: 'VCB', Icon: Sparkles },
        // VRL 은 화면이 7개인데 오래도록 이 둘만 메뉴에 있었다. 나머지 5개(분류 기준표·진단·
        // 사용자 레벨·변경 이력·의심 단어)로 가는 상시 링크는 **한 개도 없었고**, 유일한 통로가
        // 접힌 「화면 도움말」 패널 안의 각주라 3단을 펼쳐야 닿았다.
        {
          href: '/admin/vrl',
          label: '어휘 레벨',
          tag: 'VRL',
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
        { href: '/admin/pending-words', label: '대기 단어', Icon: Database },
      ],
    },
    {
      label: '운영',
      color: 'var(--info)',
      items: [
        { href: '/admin/users', label: '사용자', Icon: Users },
        { href: '/admin/analytics', label: '플랫폼 분석', Icon: BarChart3 },
        {
          href: '/admin/reports',
          label: '신고/문의',
          Icon: Flag,
          badge: reportsBadge ?? undefined,
        },
        { href: '/admin/billing', label: '결제/구독', Icon: CreditCard },
      ],
    },
    {
      label: '품질 · 시스템',
      color: 'var(--active)',
      items: [
        { href: '/admin/quality', label: '품질 지표', Icon: Gauge },
        { href: '/admin/quality/gates', label: '품질 게이트', Icon: ShieldCheck },
        { href: '/admin/quality/judge', label: '추출 판정', Icon: Scale },
        // DB 헬스는 '품질 지표' 와 대상이 다르다 — 저쪽은 콘텐츠, 이쪽은 그것을 담는 DB 자체.
        { href: '/admin/db', label: 'DB 헬스', Icon: Activity },
        { href: '/admin/settings', label: '시스템 설정', Icon: Sliders },
      ],
    },
  ]
}

/** 메뉴 정본 — 뱃지 없는 형태. 회귀가 구조를 이 값으로 읽는다. */
export const SIDEBAR_NAV: NavGroup[] = buildNavGroups(null)

/** 그 경로가 이 항목(또는 그 자식) 안에 있는가. **자식까지 봐야 한다** — 위 `children` 주석 참조. */
function inSection(item: NavItem, pathname: string): boolean {
  const hit = (h: string) => pathname === h || pathname.startsWith(h + '/')
  return hit(item.href) || (item.children ?? []).some((c) => !c.pendingNote && hit(c.href))
}

// ── 접기 / 펴기 ──────────────────────────────────────────────────────────
//
// 하위메뉴는 오래도록 **경로가 정하는 것**이었다 — 그 파이프라인 안에 있으면 펴지고 나가면 접혔다.
// 그 규칙 자체는 맞다(찾는 화면이 대개 지금 있는 곳 근처다). 문제는 관리자가 **그것을 바꿀 수
// 없었다**는 것이다: 교재 공장 밖에서 「조판·발행」으로 바로 가려면 먼저 교재 공장에 들어가
// 하위가 펴지기를 기다려야 했고(두 번 이동), 반대로 하위 11칸이 필요 없는 동안에도 그 11줄이
// 화면을 차지해 아래 묶음 세 개를 스크롤 밖으로 밀어냈다.
//
// 그래서 규칙을 **기본값**으로 격하하고, 관리자의 클릭을 그 위에 얹는다:
//
//   열림 = 관리자가 정한 값(있으면) ?? 경로가 정하는 값
//
// ⚠️ 관리자가 정한 값이 **기본값과 같아지면 지운다.** 안 지우면 「지금 한 번 펴 둔 것」이
//   영구 고정으로 굳어서, 다른 파이프라인에 들어가도 남의 하위 11줄이 계속 따라다닌다.
//   지우면 그 자리에서 경로 규칙으로 되돌아간다 — 접었다 펴면 원래 동작으로 복귀한다.

/** localStorage 키. 값은 `{ [부모 href]: 열림 }` — 기본값과 다른 항목만 담긴다. */
const NAV_OPEN_KEY = 'vocaflow.admin.nav.open'

/** 지금 이 항목이 펴져 있는가. **순수 함수** — 회귀가 DOM 없이 이 규칙을 직접 읽는다. */
export function isOpen(
  item: NavItem,
  pathname: string,
  overrides: Record<string, boolean>
): boolean {
  if (!item.children?.length) return false
  return overrides[item.href] ?? inSection(item, pathname)
}

/**
 * 토글 한 번의 결과. 기본값으로 돌아오는 클릭은 **키를 지운다**(위 ⚠️ 참조).
 * 새 객체를 돌려준다 — 호출부가 그대로 setState 하고 저장한다.
 */
export function toggleOverrides(
  prev: Record<string, boolean>,
  item: NavItem,
  pathname: string
): Record<string, boolean> {
  const next = !isOpen(item, pathname, prev)
  const rest = { ...prev }
  if (next === inSection(item, pathname)) delete rest[item.href]
  else rest[item.href] = next
  return rest
}

/** 저장된 값 읽기 — 없는 브라우저·차단·깨진 JSON 어디서도 던지지 않는다. */
function readNavOpen(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(NAV_OPEN_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

/** aria-controls 로 쓸 패널 id — href 를 그대로 쓰면 슬래시가 들어가 선택자가 깨진다. */
function panelId(href: string): string {
  return `adminnav${href.replace(/[^a-zA-Z0-9]+/g, '-')}`
}

/**
 * 하위 한 줄. **가지(├)를 그린다** — 이게 "하위메뉴처럼 안 보인다" 의 답이다.
 *
 * 예전에는 목록 왼쪽에 세로선 하나(`border-l`)만 있었다. 세로선은 "여기부터 안쪽" 이라고
 * 말하지만 **어느 줄이 어디에 걸리는지**는 말하지 않아서, 글자 크기만 1px 작은 형제 목록으로
 * 읽힌다. 줄마다 레일에서 뻗어 나온 가로 가지를 그으면 소속이 한눈에 보인다.
 */
function ChildRow({ child, isActive, last }: { child: NavItem; isActive: boolean; last: boolean }) {
  const body = (
    <>
      <child.Icon
        size={14}
        strokeWidth={1.75}
        aria-hidden="true"
        className={`shrink-0 transition-colors duration-[var(--dur-normal)] ${
          isActive ? 'text-[#8B5CF6]' : 'text-[var(--t3)]'
        }`}
      />
      <span className="flex-1 truncate">{child.label}</span>
      {child.pendingNote ? (
        <span className="shrink-0 rounded bg-[var(--bg3)] px-1.5 py-0.5 font-body text-[11px] text-[var(--t3)]">
          준비 중
        </span>
      ) : null}
      {child.tag ? (
        <span aria-hidden className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--t3)]">
          {child.tag}
        </span>
      ) : null}
    </>
  )
  return (
    <li className="relative pl-6">
      {/* 레일 — 마지막 줄에서는 가지가 걸리는 지점까지만 내려온다(└). */}
      <span
        aria-hidden="true"
        className={`absolute left-[9px] top-0 w-px bg-[var(--bd)] ${last ? 'h-[22px]' : 'bottom-0'}`}
      />
      {/* 가지 */}
      <span
        aria-hidden="true"
        className="absolute left-[9px] top-[22px] h-px w-[9px] bg-[var(--bd)]"
      />
      {child.pendingNote ? (
        // 아직 화면이 없는 칸 — 링크가 아니라 글자. 눌러 보고 "고장" 이라고 판단하는 것보다
        // 없다고 보이는 편이 낫다. 흐림은 **색**이지 투명도가 아니다(AA 유지).
        <span
          title={child.pendingNote}
          className="flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] px-2 font-display text-[13px] font-[500] text-[var(--t3)]"
        >
          {body}
        </span>
      ) : (
        <Link
          href={child.href}
          aria-current={isActive ? 'page' : undefined}
          className={`flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] px-2 font-display text-[13px] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
            isActive
              ? 'bg-[var(--bg)] font-[600] text-[var(--t1)] shadow-[var(--sh-sm)] ring-1 ring-[#8B5CF6]/35'
              : 'font-[500] text-[var(--t2)] hover:bg-[var(--bg)] hover:text-[var(--t1)] active:bg-[var(--bd)]'
          }`}
        >
          {body}
        </Link>
      )}
    </li>
  )
}

export function AdminSidebar({ reportsBadge = null }: AdminSidebarProps = {}) {
  const pathname = usePathname() ?? ''
  const NAV_GROUPS = buildNavGroups(reportsBadge)

  // 관리자가 직접 정한 접기/펴기. **서버 렌더는 항상 기본값(경로 규칙)으로 그린다** —
  // 첫 렌더에서 localStorage 를 읽으면 서버와 다른 HTML 이 나와 하이드레이션이 깨진다.
  // 그래서 저장값은 마운트 뒤에 얹는다.
  const [navOpen, setNavOpen] = useState<Record<string, boolean>>({})
  useEffect(() => {
    setNavOpen(readNavOpen())
  }, [])

  const toggleNav = (item: NavItem) => {
    setNavOpen((prev) => {
      const next = toggleOverrides(prev, item, pathname)
      try {
        window.localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next))
      } catch {
        // 저장이 막힌 브라우저(프라이빗 모드·사이트 데이터 차단). 이번 세션 동안만 유지되고
        // 기능 자체는 그대로 돈다 — 여기서 던지면 메뉴 클릭이 통째로 죽는다.
      }
      return next
    })
  }

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
          <span className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
            Admin
          </span>
        </div>
      </Link>

      {/* ── Mode 알림 ── */}
      <div className="bg-[#8B5CF6]/8 mx-3 mb-2 mt-4 rounded-[var(--r-md)] border border-[#8B5CF6]/30 px-3 py-2">
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
          <div key={idx} className={idx > 0 ? 'mt-5' : 'mt-2'}>
            {group.label && (
              <h3 className="mb-2 flex items-center gap-2.5 px-3">
                {group.color && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
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
                // 하위를 가진 항목이 **지금 경로를 품고 있는가** — 접기/펴기의 기본값이자,
                // 접혀 있을 때 "여기 안에 있다" 를 알리는 근거다(아래 왼쪽 세로 막대).
                const inside = Boolean(item.children?.length) && inSection(item, pathname)
                const open = isOpen(item, pathname, navOpen)
                // 이름·아이콘을 진하게 쓸 조건. 접어 둔 채로 그 안에 있을 때도 진해야 한다 —
                // 안 그러면 하위가 안 보이는 동안 **자기 위치가 메뉴에서 사라진다.**
                const lit = isActive || open || inside
                const openable = item.children?.filter((c) => !c.pendingNote).length ?? 0
                return (
                  <li key={item.href}>
                    {/*
                      한 줄이 **두 개의 조작**이다 — 이름을 누르면 이동하고, 화살표를 누르면
                      접거나 편다. 그래서 링크 안에 버튼을 넣을 수 없다(중첩 인터랙티브는
                      키보드로 도달할 수 없는 버튼을 만든다). 면과 테두리는 이 감싸개가 갖고,
                      링크와 버튼은 그 위에 나란히 눕는다.
                    */}
                    <div
                      className={`group relative flex items-stretch transition-all duration-[var(--dur-normal)] ease-[var(--ease)] ${
                        // 펼쳐진 부모는 아래 패널과 **한 덩어리로** 보여야 한다 — 아래쪽 모서리를
                        // 펴서 패널과 맞물린다. 이게 없으면 부모와 하위가 서로 남남으로 읽힌다.
                        open ? 'rounded-t-[var(--r-md)]' : 'rounded-[var(--r-md)]'
                      } ${
                        isActive
                          ? 'bg-[var(--bg)] shadow-[var(--sh-sm)] ring-1 ring-[var(--bd)]'
                          : open
                            ? 'bg-[var(--bg2)]'
                            : 'hover:bg-[var(--bg2)] hover:shadow-[inset_0_0_0_1px_var(--bd)]'
                      } `}
                    >
                      {/* 접어 둔 채 그 안에 있을 때도 막대를 세운다 — 그것이 유일한 단서다. */}
                      {isActive || (inside && !open) ? (
                        <span
                          className="absolute bottom-1.5 left-0 top-1.5 w-[2.5px] rounded-r-full bg-[#A78BFA]"
                          aria-hidden="true"
                        />
                      ) : null}
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-[var(--r-md)] py-2 pl-3 ${
                          openable > 0 ? 'pr-1' : 'pr-2'
                        } font-display text-[14px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
                          lit
                            ? 'font-[600] text-[var(--t1)]'
                            : 'font-[500] text-[var(--t2)] group-hover:text-[var(--t1)]'
                        } `}
                      >
                        <span
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] transition-colors duration-[var(--dur-normal)] ${
                            lit ? 'bg-[#8B5CF6]/12' : 'bg-[var(--bg2)] group-hover:bg-[var(--bg3)]'
                          } `}
                        >
                          <item.Icon
                            size={15}
                            strokeWidth={1.75}
                            aria-hidden="true"
                            className={`transition-colors duration-[var(--dur-normal)] ${
                              lit ? 'text-[#8B5CF6]' : 'text-[var(--t3)] group-hover:text-[var(--t2)]'
                            } `}
                          />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.tag ? (
                          <span
                            aria-hidden
                            className="shrink-0 font-mono text-[11px] font-[600] tracking-tight text-[var(--t3)]"
                          >
                            {item.tag}
                          </span>
                        ) : null}
                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className="inline-flex shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[var(--error)] px-2 py-1 font-display text-[11px] font-[700] text-white"
                            aria-label={`미처리 ${item.badge}개`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                      {openable > 0 ? (
                        // 화살표는 **회전한다** — 접힘(▶)과 펼침(▼)에 서로 다른 아이콘을 쓰면
                        // 두 그림 사이를 오갈 뿐이라 "무엇이 무엇으로 바뀌었는지" 가 안 남는다.
                        // 90° 회전은 transform 이라 모션 예산 안이고, 방향 자체가 상태를 말한다.
                        <button
                          type="button"
                          onClick={() => toggleNav(item)}
                          aria-expanded={open}
                          aria-controls={panelId(item.href)}
                          aria-label={`${item.label} 하위 ${openable}개 ${open ? '접기' : '펼치기'}`}
                          className="flex min-h-[44px] w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 active:bg-[var(--bd)]"
                        >
                          <ChevronRight
                            size={15}
                            strokeWidth={2}
                            aria-hidden="true"
                            className={`transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] ${
                              open ? 'rotate-90' : ''
                            } `}
                          />
                        </button>
                      ) : null}
                    </div>
                    {open ? (
                      // 하위는 **자기 면을 가진 패널**이다. 부모와 색·테두리로 이어 붙여 놓으면
                      // "이 안쪽" 이라는 사실이 글자 크기가 아니라 **면**으로 읽힌다.
                      // ⚠️ `role="group"` 은 **감싸는 `<div>`** 에 건다. `<ul>` 에 직접 걸면
                      //   목록 역할이 덮여서 스크린리더가 "항목 11개" 를 못 읽는다 — 하위가
                      //   몇 개인지가 이 메뉴에서 가장 먼저 필요한 정보인데 그것을 잃는다.
                      <div
                        id={panelId(item.href)}
                        role="group"
                        aria-label={`${item.label} 하위 메뉴`}
                        className="rounded-b-[var(--r-md)] border border-t-0 border-[var(--bd)] bg-[var(--bg2)] px-1.5 pb-2 pt-1"
                      >
                        <ul className="flex flex-col gap-0.5">
                          {item.children!.map((child, ci) => {
                            const kids = item.children!
                            const nextGroupAt = kids.findIndex((k, i) => i > ci && Boolean(k.group))
                            // 「마지막」은 목록의 끝이 아니라 **그 묶음의 끝**이다 — 다음 머리글
                            // 직전에서 레일을 끊어야 └ 가 제자리에 온다.
                            const last =
                              nextGroupAt === -1 ? ci === kids.length - 1 : ci === nextGroupAt - 1
                            return (
                              <Fragment key={`${child.href}|${child.label}`}>
                                {child.group ? (
                                  // 머리글은 자기 `<li>` 다 — `<ul>` 바로 아래에 `<div>`/`<p>` 를 두면
                                  // 마크업이 깨진다(브라우저가 위치를 고쳐 레일이 어긋난다).
                                  <li
                                    role="presentation"
                                    className="mb-1 mt-2.5 px-1.5 font-display text-[11px] font-[700] tracking-[0.06em] text-[var(--t2)] first:mt-0.5"
                                  >
                                    {child.group}
                                  </li>
                                ) : null}
                                <ChildRow
                                  child={child}
                                  isActive={child.href === activeHref && !child.pendingNote}
                                  last={last}
                                />
                              </Fragment>
                            )
                          })}
                        </ul>
                      </div>
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
          className="group flex min-h-[44px] items-center gap-3 rounded-[var(--r-md)] px-3 py-2 transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg)] hover:shadow-[var(--sh-sm)] hover:ring-1 hover:ring-[var(--bd)]"
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
