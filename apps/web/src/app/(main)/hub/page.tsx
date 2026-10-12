// apps/web/src/app/(main)/hub/page.tsx
// @form: 제품 액자 — 이 학습자의 오늘(흐름 · 기억 4색 · 예보 · 새 고전 표)이 참조 홈의 앱 화면 자리에 선다 (ProductFrame)
//
// 플랫폼 메인 — 2026-09-22 재설계 2회차(사용자 요청: 「tines 스타일을 더 분석해서 더 가깝게」).
//
// ── 골격: 참조 홈의 띠 순서를 그대로 (docs/design/refs/tines · 홈 캡처 8장) ────────────────
//   참조                                   → 우리
//   ThreeBHero(NEW 알약 · 64px 제목 · 세리프 부제 · 알약 둘) → 같은 자리 · 첫 알약 = 셸 나침반의 「지금」 CTA
//   고객 로고 줄(흐름)                      → 발행된 고전 제목 줄(TitleMarquee · 멈춤 단추)
//   ThreeBProductVisual(앱 화면 액자)       → ProductFrame(오늘의 흐름 레일 · KPI · 기억 도넛 · 예보 · 새 고전 표)
//   HomeUseCasesSection(색 탭 5)            → 플랫폼 탭 5(서가 · 만화 · 수능 · 아케이드 · 단어장)
//   HomeSolutionSection(보라 통판 · 48px)   → SolutionSlab(DB 가 센 서가 규모가 제목 · 가치 넷 · 플랫폼 타일)
//   (참조에 없음 — 우리 콘텐츠)              → 읽을거리(새 글 · 주제 시리즈)
//   HomeUSPSection(WHY + 보라 카드 넷)      → UspCards(진단 · 기억 4색 · 듣기 · 학급)
//   「Built by you」 흩어진 물건 띠          → FinalCta(공개 화면 ScatterCta 와 같은 골격)
//   참조 「100×」 무늬 글자 + 리본         → PatternWord 「한 서가」 + 서가 규모 리본(DB 실측 · 못 세면 그 리본 없음)
//   2026-10-12 사용자 지시(「비로그인 화면 품질과 동일 수준」)로 랜딩 전용이던 꽃무늬 글자 · 리본을 여기도 쓴다
//   (tines-mapping §20 의 「랜딩 전용」 은 이 지시로 바뀌었다).
//   1회차의 자동 넘김 배너 · 원형 바로 가기 · 크기 다른 칸 격자는 참조에 없는 포털 문법이라 걷어 냈다.
//
// ── 유지한 것 ────────────────────────────────────────────────────────
//   · 「오늘」 정본은 셸 나침반 모델(`buildWayfinder`) 하나 — 액자 레일은 같은 모델을 그린다(e2e 22-H · 23-②).
//   · 수치 · 표지 · 제목은 발행 게이트를 지난 DB 실물(I5 · `hub-portal-query`). 못 센 수는 문장째 뺀다.

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { CSSProperties } from 'react'

import { Screen } from '@/components/ui/ios'
import { ToneTabs } from '@/components/ui/ToneTabs'
import { BTN } from '@/components/ui/tines-kit'
import { PromoLink } from '@/components/hub/portal/PromoLink'
import { CsatContinueLine } from '@/components/csat/home/CsatContinueLine'
import {
  FinalCta,
  ProductFrame,
  ReadingSection,
  SectionHead,
  SolutionSlab,
  UspCards,
  platformTabs,
} from '@/components/hub/portal/sections'
import { TitleMarquee } from '@/components/hub/portal/TitleMarquee'
import { FrameBar, PatternWord, Ribbon } from '@/components/marketing/signature'
import { fetchHubPortal } from '@/lib/learner/hub-portal-query'
import { buildWayfinder } from '@/lib/learner/wayfinder'
import { fetchWayfinder } from '@/lib/learner/wayfinder-query'

export const metadata = {
  title: '홈',
  description: '고전 서가 · 만화 · 수능 기출 · 단어 게임 — 내가 아는 비율로 읽기를 설계하는 영어 학습 플랫폼',
}

export default async function HubPage() {
  const [portal, wayfinder] = await Promise.all([fetchHubPortal(), fetchWayfinder()])
  const model = wayfinder ? buildWayfinder({ ...wayfinder, pathname: '/hub' }) : null
  const primary = model ? { label: model.now.cta, href: model.now.href } : { label: '5분 진단 시작', href: '/diagnostic' }
  const newest = portal.newBooks[0]

  return (
    <Screen width="full" background="bg" padX="none">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-24 px-4 pb-24 pt-6 md:gap-[156px] md:pt-10 lg:px-10">
        {/* ── 히어로 + 서명 줄 + 제품 액자 (참조 ThreeBHero 세 칸) ── */}
        <div className="flex flex-col gap-10 md:gap-12">
          <section aria-label="오늘">
            {/* 기출 이어서 — 멈춘 세트 · 오늘 복습이 있을 때만 선다(docs/csat/ia-design.md §3) */}
            <CsatContinueLine />
            {newest && (
              <PromoLink
                href={`/library/books/${newest.id}`}
                slot="hero"
                index={0}
                className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--ju)] text-[14px] text-[var(--ju)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--tint-lavender)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
              >
                <span className="border-r border-[var(--ju)] px-3 font-mono text-[12px] font-[700] uppercase tracking-[0.05em]">New</span>
                <span className="inline-flex items-center gap-1.5 px-3 font-display font-[500]">
                  새로 들어온 고전 · {newest.title} <ArrowRight size={14} aria-hidden />
                </span>
              </PromoLink>
            )}
            <h1
              className="vf-rise mt-7 max-w-[22ch] break-keep font-display text-[40px] font-[400] leading-[1.06] tracking-[-0.03em] text-[var(--t1)] md:text-[64px]"
              style={{ '--rise-delay': '50ms' } as CSSProperties}
            >
              읽을 것, 외울 것, <br className="sm:hidden" />
              풀 것이
              <br />
              한 서가에 있습니다.
            </h1>
            <p
              className="vf-rise mt-6 max-w-[56ch] break-keep font-serif text-[20px] leading-[1.35] text-[var(--ju)] md:text-[26px]"
              style={{ '--rise-delay': '100ms' } as CSSProperties}
            >
              {model ? model.now.headline : 'Vocaflow 는 내가 아는 비율을 재고, 지금 읽을 수 있는 것부터 꺼내 줍니다.'}
            </p>
            <div className="vf-rise mt-8 flex flex-wrap gap-3" style={{ '--rise-delay': '150ms' } as CSSProperties}>
              <PromoLink href={primary.href} slot="hero" index={1} className={BTN.primary}>
                {primary.label}
              </PromoLink>
              <Link href="/library/books" className={BTN.secondary}>
                서가 둘러보기
              </Link>
            </div>
          </section>

          <TitleMarquee books={portal.newBooks} />

          {/* 무늬 글자 + 걸친 리본 → 그 위로 겹치는 제품 액자(랜딩 「아는 비율」 구간과 같은 골격).
              글자는 장식이라 aria-hidden — 같은 말은 위 제목이 이미 한다. */}
          <div className="relative">
            <div aria-hidden className="relative overflow-hidden px-2 pt-2 text-center">
              <PatternWord image="hero-book-field" className="block select-none font-display text-[22vw] font-[800] leading-[0.82] tracking-[-0.06em] lg:text-[280px]">
                한 서가
              </PatternWord>
              {ribbons(portal.facts).map((r) => (
                <Ribbon key={r.text} tone={r.tone} className={`absolute ${r.at}`}>
                  {r.text}
                </Ribbon>
              ))}
            </div>
            <div className="relative z-10 -mt-[5vw] lg:-mt-[64px]">
              <FrameBar tab="오늘, 나의 서가" />
              <ProductFrame model={model} books={portal.newBooks} facts={portal.facts} />
            </div>
          </div>
        </div>

        {/* ── 플랫폼 색 탭 (참조 HomeUseCasesSection) ── */}
        <section aria-label="플랫폼">
          <SectionHead
            kicker="Vocaflow platforms"
            title={'한 서가에서, 다섯 갈래로\n이어 배웁니다.'}
            byline="읽기에서 담은 단어가 만화 · 기출 · 게임 · 단어장으로 그대로 이어집니다. 새로 시작할 필요가 없어요."
          />
          <div className="mt-12 md:mt-16">
            <ToneTabs label="Vocaflow 플랫폼" items={platformTabs(portal)} />
          </div>
        </section>

        {/* ── 보라 통판 (참조 HomeSolutionSection) ── */}
        <section aria-label="서가 규모">
          <SolutionSlab facts={portal.facts} />
        </section>

        {/* ── 읽을거리 ── */}
        <section aria-label="읽을거리">
          <SectionHead kicker="Read today" title="짧은 글로 매일 한 편." byline="원어민 낭독 · 쉬운 백과 · 과학 기사 · 논증문 — 지금 수준에서 읽히는 글부터 골라 드려요." />
          <div className="mt-12 md:mt-16">
            <ReadingSection portal={portal} />
          </div>
        </section>

        {/* ── WHY + 보라 카드 (참조 HomeUSPSection) ── */}
        <section aria-label="왜 Vocaflow 인가">
          <SectionHead kicker="Why Vocaflow?" title={'읽은 글이 그대로\n단어장이 됩니다.'} byline="모르는 단어를 따로 적지 않습니다. 글에서 담고, 기억이 흐려질 때쯤 다시 만나고, 같은 글로 확인합니다." />
          <div className="mt-12 md:mt-16">
            <UspCards />
          </div>
        </section>

        {/* ── 마지막 CTA (참조 WildCodeCTASection) ── */}
        <section aria-label="시작하기">
          <FinalCta primary={primary} />
        </section>
      </div>
    </Screen>
  )
}

type RibbonSpec = { text: string; tone: 'green' | 'orange' | 'magenta'; at: string }

/** 리본 셋 — 서가 규모를 DB 가 센 그대로(I5). 못 센 값(null)·0 은 리본째 뺀다. */
function ribbons(facts: { books: number | null; articles: number | null; curatedSets: number | null }): RibbonSpec[] {
  const out: RibbonSpec[] = []
  if (facts.books) out.push({ text: `도서 ${facts.books.toLocaleString('ko-KR')}권`, tone: 'green', at: 'left-[10%] top-[24%] -rotate-[5deg]' })
  if (facts.articles) out.push({ text: `읽을 글 ${facts.articles.toLocaleString('ko-KR')}편`, tone: 'orange', at: 'right-[12%] top-[10%] rotate-[4deg]' })
  if (facts.curatedSets) out.push({ text: `단어장 ${facts.curatedSets.toLocaleString('ko-KR')}`, tone: 'magenta', at: 'right-[5%] top-[50%] rotate-[6deg]' })
  return out
}
