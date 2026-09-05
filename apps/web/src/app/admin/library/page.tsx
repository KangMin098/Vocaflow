// apps/web/src/app/admin/library/page.tsx
// 콘텐츠 관리 — 실제 카탈로그가 있는 화면으로 보내는 관문
//
// v06.35 이전 이 화면은 KPI 4개("총 콘텐츠 89" · "주간 학습자 432")와 카드 6장
// (The Great Gatsby · 1984 · Harry Potter …)을 전부 코드 상수로 그렸다. 저장소 어디에도
// 그런 카탈로그는 없다 — 실제 콘텐츠는 library_books 401 · library_articles 75,222 처럼
// 자릿수가 다르고, 그것들은 LCP·ACP·PDCP 화면이 각자 실측으로 그린다.
//
// 문제는 사이드바의 「콘텐츠」가 이 화면을 가리킨다는 점이다. 관리자는 콘텐츠를 보러 와서
// 상수 6건을 보고 "카탈로그가 6권" 이라고 읽는다. 그래서 이 화면은 숫자를 만들지 않고,
// 실측이 있는 곳으로 **눈에 띄게** 보내는 역할만 한다.
//
// 지운 것: KPI 4개 상수 · 카드 6장 · 검색/필터 칩(6건 위에서만 돌던 것) ·
//          핸들러 없는 「스크립트 추가」 · 카드별 「수정 · AI 재분석 · 삭제」 · 「⋯ 더보기」.

import {
  BookImage,
  BookMarked,
  Brain,
  Eye,
  Library,
  Newspaper,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { MockDataBanner } from '@/components/admin/MockDataBanner'

export const metadata = {
  title: '콘텐츠 관리 — Vocaflow Admin',
  description: '실측 카탈로그 화면으로 가는 관문',
}

const KPIS: AdminKpi[] = [
  {
    label: '총 콘텐츠',
    value: '—',
    icon: Library,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '이 화면은 카탈로그를 읽지 않습니다 — 아래 실측 화면에서 확인',
  },
  {
    label: '공식 큐레이션',
    value: '—',
    icon: Star,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '큐레이션 상태는 LCP 화면이 실측합니다',
  },
  {
    label: '검토 대기',
    value: '—',
    icon: Eye,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '검수 대기는 대시보드가 파이프라인별로 실측합니다',
  },
  {
    label: '주간 학습자',
    value: '—',
    icon: Users,
    accent: 'var(--t2)',
    bg: 'var(--bg3)',
    hint: '집계할 곳이 없습니다 — 주간 활성 집계 미구현',
  },
]

interface RealScreen {
  href: string
  label: string
  detail: string
  Icon: LucideIcon
}

/** 실제로 카탈로그를 실측으로 그리는 화면들. 이 화면의 존재 이유가 이 목록이다. */
const REAL_SCREENS: RealScreen[] = [
  {
    href: '/admin/curation',
    label: 'LCP · 도서 큐레이션',
    detail: 'library_books — 시드 · 처리 중 · 검수 대기 · 공개 · 실패를 상태별로 실측합니다.',
    Icon: BookMarked,
  },
  {
    href: '/admin/articles',
    label: 'ACP · 짧은 글',
    detail: 'library_articles — arXiv · NASA · NIH · VOA 4 피드의 큐를 실측합니다.',
    Icon: Newspaper,
  },
  {
    href: '/admin/pd-comics',
    label: 'PDCP · 퍼블릭도메인 만화',
    detail: 'pd_comic_issues — 취득부터 현대화까지 호 단위 상태를 실측합니다.',
    Icon: BookImage,
  },
  {
    href: '/admin/vocabulary',
    label: '사전 DB',
    detail: 'shared_dictionary — 단어 단위로 분류(V-Level · CEFR · Track)를 열어 봅니다.',
    Icon: Brain,
  },
]

export default function AdminLibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-8">
      <AdminPageHeader
        icon={Library}
        title="콘텐츠 관리"
        description="실제 카탈로그는 파이프라인별 화면에 있습니다"
      />

      <MockDataBanner
        className="mb-6"
        what="KPI 4개가 모두 값이 아니라 — 이고, 콘텐츠 목록도 비어 있습니다."
        // 지운 가짜 제목을 설명문에 다시 적지 않는다 — 화면에 남는 순간 그 문자열은
        // 다시 "카탈로그에 있는 책" 처럼 읽힌다(회귀 테스트가 바로 이걸 잡았다).
        why="이 화면은 DB 를 한 번도 읽지 않습니다. 여기 있던 KPI 4개와 콘텐츠 카드 6장은 저장소 어디에도 없는 시중 베스트셀러 제목을 박아 둔 코드 상수였습니다. 실제 카탈로그는 파이프라인별 화면이 각자 실측으로 그립니다."
        instead={[
          { label: '도서 큐레이션 (LCP)', href: '/admin/curation' },
          { label: '짧은 글 (ACP)', href: '/admin/articles' },
          { label: '파이프라인 실측 대시보드', href: '/admin' },
        ]}
        plan="통합 카탈로그 화면을 만들 계획은 아직 없습니다 — 파이프라인별 화면이 정본입니다."
      />

      <AdminScreenHelp screen="library" className="-mt-3 mb-6" />

      <AdminKpiGrid kpis={KPIS} />

      <section aria-label="실제 콘텐츠 현황 화면">
        <h2 className="mb-3 font-display text-[14px] font-[700] text-[var(--t1)]">
          실제 콘텐츠 현황은 여기서 봅니다
        </h2>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {REAL_SCREENS.map((s) => {
            const Icon = s.Icon
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="flex min-h-[44px] items-start gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                >
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
                    aria-hidden
                  >
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
                      {s.label}
                    </p>
                    <p className="mt-1 break-keep font-body text-[12px] leading-[1.7] text-[var(--t2)]">
                      {s.detail}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
