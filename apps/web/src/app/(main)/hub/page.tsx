// apps/web/src/app/(main)/hub/page.tsx
// @form: 배너 — 영역마다 한 장, 진한 범주 색 면이 7초마다 넘어간다 (PortalHero)
//
// 플랫폼 메인 — 2026-09-22 재설계(사용자 요청: 「다른 사이트처럼 여러 플랫폼 홍보로 구성하는 메인」).
//
// ── 무엇이 바뀌었나 ──────────────────────────────────────────────────
//   이전(v06.200): 「오늘의 무대」 한 장 — 오늘 되찾을 단어 + 처방 흐름 + 읽을 글 3편.
//     학습을 이미 시작한 사람에게는 맞았지만, 이 플랫폼에 **무엇이 있는지**는 한 곳도 말하지 않았다.
//     서가 · 만화 · 기출 · 아케이드 · 교사 · 단어장은 사이드바 이름으로만 존재했다.
//   지금: 포털 메인의 문법 — 배너 + 개인 패널 → 바로 가기 → 새로 들어온 것 → 홍보 격자 → 읽을거리
//     → 아케이드 띠 → 단어장 컬렉션 → 서가 규모.
//
// ── 유지한 것 ────────────────────────────────────────────────────────
//   · 「오늘」 정본은 셸 나침반 모델(`buildWayfinder`) 하나다. 배너 옆 패널은 그것을 **같은 모델로**
//     다시 보여줄 뿐 새 할 일 표면을 만들지 않는다(v06.108 META Opt A · e2e 22-H).
//   · 홍보 면의 수치 · 표지 · 제목은 전부 발행 게이트를 지난 DB 실물이다(I5 · `hub-portal-query`).
//
// 회고(backward)는 여전히 /dashboard 단독.

import { Screen } from '@/components/ui/ios'
import { PortalHero, type HeroSlide } from '@/components/hub/portal/PortalHero'
import {
  ArcadeBand,
  MyTodayPanel,
  NewBooksShelf,
  PromoBento,
  QuickMenu,
  ReadingSection,
  ScaleBand,
  SectionHead,
  VocabCollections,
} from '@/components/hub/portal/sections'
import { DEEP_CLASS, MATERIAL_TONE } from '@/lib/design/tone'
import { fetchHubPortal, type HubPortal } from '@/lib/learner/hub-portal-query'
import { buildWayfinder } from '@/lib/learner/wayfinder'
import { fetchWayfinder } from '@/lib/learner/wayfinder-query'

export const metadata = {
  title: '홈',
  description: '고전 서가 · 만화 · 수능 기출 · 단어 게임 — 내가 아는 비율로 읽기를 설계하는 영어 학습 플랫폼',
}

const fmt = (n: number) => n.toLocaleString('ko-KR')

/** 배너 — 영역마다 한 장. 수치는 센 것만, 못 셌으면 문장에서 뺀다. */
function heroSlides(p: HubPortal, diagnosed: boolean): HeroSlide[] {
  const slides: HeroSlide[] = [
    {
      id: 'books',
      label: '서가',
      title: p.facts.books ? `고전 ${fmt(p.facts.books)}권,\n내 수준에서 펼치기` : '퍼블릭 도메인 고전,\n내 수준에서 펼치기',
      body: '챕터마다 어휘가 미리 뽑혀 있어요. 읽다가 모르는 단어는 그 자리에서 보관함에 담깁니다.',
      cta: '서가 둘러보기',
      href: '/library/books',
      tone: DEEP_CLASS[MATERIAL_TONE.book.deep],
      illo: 'tile-books',
      fact: p.newBooks[0] ? `NEW · ${p.newBooks[0].title}` : null,
    },
    {
      id: 'csat',
      label: '수능 기출',
      title: '평가원 기출을\n유형별로 해부',
      body: '출제자가 왜 그 선택지를 만들었는지까지 — 문항마다 근거를 지문 위에서 따라 읽습니다.',
      cta: '기출 시작',
      href: '/csat',
      tone: DEEP_CLASS.purple,
      illo: 'tile-csat',
    },
    {
      id: 'arcade',
      label: '아케이드',
      title: '담은 단어로\n게임 한 판',
      body: '워드블리츠 · 페어플립 · 스펠포지 — 내 보관함의 단어가 그대로 문제가 됩니다.',
      cta: '아케이드 입장',
      href: '/arcade',
      tone: DEEP_CLASS.magenta,
      illo: 'tile-wordblitz',
    },
    {
      id: 'teacher',
      label: '교사',
      title: '학급의 어휘를\n한 화면에서',
      body: '학급을 만들고 초대코드를 나눠 주면 학생들의 어휘 진행을 한곳에서 봅니다.',
      cta: '교사 허브',
      href: '/teacher',
      tone: DEEP_CLASS.charcoal,
      illo: 'tile-teacher',
    },
  ]

  if (p.comics.length > 0) {
    slides.splice(1, 0, {
      id: 'comics',
      label: '만화',
      title: '같은 책을\n그림으로 먼저',
      body: '줄거리를 그림으로 먼저 알고 나면 원문이 훨씬 가벼워집니다.',
      cta: '만화 보기',
      href: '/comics',
      tone: DEEP_CLASS[MATERIAL_TONE.comic.deep],
      illo: 'tile-comics',
      fact: p.facts.comics ? `${fmt(p.facts.comics)}편` : null,
    })
  }

  // 진단 전인 사람에게는 진단이 가장 큰 문이다 — 맨 앞에 세운다.
  if (!diagnosed) {
    slides.unshift({
      id: 'diagnostic',
      label: '5분 진단',
      title: '내가 아는 비율부터\n재고 시작합니다',
      body: '몇 개의 단어를 아는지만 확인하면, 지금 읽을 수 있는 책과 오늘 만날 단어가 정해져요.',
      cta: '진단 시작',
      href: '/diagnostic',
      tone: DEEP_CLASS.ink,
      illo: 'tile-hub',
    })
  }
  return slides
}

export default async function HubPage() {
  const [portal, wayfinder] = await Promise.all([fetchHubPortal(), fetchWayfinder()])
  const model = wayfinder ? buildWayfinder({ ...wayfinder, pathname: '/hub' }) : null

  return (
    <Screen width="full" background="bg" padX="none">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-16 px-4 py-6 md:gap-24 md:py-8 lg:px-10">
        {/* 배너 + 나의 오늘 */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <PortalHero slides={heroSlides(portal, wayfinder?.isDiagnosed ?? false)} />
          <MyTodayPanel model={model} />
        </div>

        <div className="-mt-8 md:-mt-14">
          <QuickMenu />
        </div>

        {portal.newBooks.length > 0 && (
          <section aria-label="새로 들어온 고전">
            <SectionHead eyebrow="New arrivals" title="새로 들어온 고전" href="/library/books" cta="서가 전체" slot="shelf" index={99} />
            <NewBooksShelf books={portal.newBooks} />
          </section>
        )}

        <section aria-label="Vocaflow 에서 할 수 있는 것">
          <SectionHead eyebrow="Explore" title="읽고, 듣고, 풀고, 가르치고." />
          <PromoBento comics={portal.comics} comicTotal={portal.facts.comics} />
        </section>

        <section aria-label="읽을거리">
          <SectionHead eyebrow="Read today" title="짧은 글로 매일 한 편" href="/library/scripts" cta="글 전체" slot="reading" index={99} />
          <ReadingSection portal={portal} />
        </section>

        <section aria-label="아케이드">
          <ArcadeBand />
        </section>

        {portal.setCategories.length > 0 && (
          <section aria-label="단어장 컬렉션">
            <SectionHead eyebrow="Word sets" title="목적별 단어장" href="/library/vocab" cta="단어장 전체" slot="vocab" index={99} />
            <VocabCollections categories={portal.setCategories} />
          </section>
        )}

        <section aria-label="서가 규모" className="pb-8">
          <ScaleBand facts={portal.facts} />
        </section>
      </div>
    </Screen>
  )
}
