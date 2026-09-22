// apps/web/src/app/page.tsx
// @form: 채색 지문 — 레벨 슬라이더를 움직이면 지문의 단어 면 색이 200ms 에 바뀐다 (CoverageHero)
//
// 랜딩 — 검색과 공유가 도착하는 곳.
//
// ── 골격 (DD-68 「가장 닮음」) ──────────────────────────────────────
// 참조 사이트 홈의 띠 순서를 그대로 따른다 — 왼쪽 정렬 큰 제목 · 알약 CTA · 한 줄 증거 띠 ·
// 폭 전체 삽화 위로 겹치는 제품 액자 · 가운데 선언문 · 보라 통판 · 색면 탭 다섯 · 보라 카드 · 마지막 CTA.
// 색·서체·모서리는 스킨 토큰(`skins/tines.css`)에서 오고, 이 파일에는 자리와 크기만 있다.
// 삽화는 우리 소재를 같은 화풍으로 새로 그린 것이다(`scripts/design/illo-tines-gen.mjs`).
//
// ── 무엇을 말하고 무엇을 말하지 않는가 ──────────────────────────────
// **지어낸 것을 쓰지 않는다.** 참조 사이트의 고객 로고 줄 자리에는 로고가 아니라 **DB 실측 지표**가
// 선다(`lib/marketing/trust-signals.ts` — 못 읽으면 그 줄이 없다). 후기·이용자 수·평점·도입 기관은 없다
// (2026-08-16 진단: `/pricing` 이 "학습자 12,000+ / 평점 4.8 / 학교 34곳" 을 걸고 있었고 실측은 3/0/0).
//
// ── 첫 CTA 가 가입이 아닌 이유 ──────────────────────────────────────
// `/fit` 은 **로그인 없이** 지문 난이도를 재 준다. 가입 전에 가치를 보여주는 유일한 화면이다.

import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { CoverageHero } from '@/components/marketing/CoverageHero'
import { LandingCta } from '@/components/marketing/LandingCta'
import { PILL } from '@/components/marketing/pill'
import { FrameBar, MonitorCluster, PatternWord, Ribbon, SourceMarquee } from '@/components/marketing/signature'
import { BTN } from '@/components/ui/tines-kit'
import { ToneTabs } from '@/components/ui/ToneTabs'
import { DEEP_CLASS, MATERIAL_TONE, MODULE_TONE } from '@/lib/design/tone'
import { SiteFooter } from '@/components/marketing/site/SiteFooter'
import { SiteHeader } from '@/components/marketing/site/SiteHeader'
import { SectionBeacon } from '@/components/marketing/SectionBeacon'
import { DIFFERENTIATORS } from '@/lib/marketing/differentiators'
import { buildHeroDemo } from '@/lib/marketing/hero-demo'
import { fetchTrustSignals } from '@/lib/marketing/trust-signals'
import { CONTENT_SOURCES } from '@/lib/marketing/sources'

export const metadata: Metadata = {
  // ⚠️ `absolute` — 루트 `title.template`("%s | Vocaflow")을 **거친다.**
  //    그냥 문자열로 두면 "Vocaflow — … | Vocaflow" 로 브랜드가 두 번 나온다.
  title: { absolute: 'Vocaflow — 내가 아는 비율로 읽기를 설계합니다' },
  description:
    '글의 난이도가 아니라 "내가 아는 비율"을 잽니다. 이 글이 편하게 읽히기까지 몇 단어가 남았는지 계산해 드려요. 로그인 없이 먼저 재 보세요.',
  alternates: { canonical: '/' },
}

/** 신뢰 지표는 매 요청 세지 않는다 — 하루 한 번이면 충분하다. */
export const revalidate = 86400

const ILLO = '/illustrations/tines'

/**
 * 학습 모듈 다섯 — 참조 홈 「팀 탭」(`HomeUseCasesSection`) 자리. 탭마다 모듈 범주 색(`MODULE_TONE`)의 진한 면이고,
 * 고른 탭의 색이 아래 패널로 이어진다(`ToneTabs`). 패널은 그 모듈 타일 + 설명 + 들어가는 길.
 */
const MODULES = [
  { id: 'read', name: '읽기', body: '지문을 읽다가 모르는 단어를 그 자리에서 담습니다. 뜻은 문맥과 함께 남아요.', tone: MODULE_TONE.read.deep, spot: 'spot-reading', tile: 'tile-read', href: '/library/books', cta: '서가 둘러보기' },
  { id: 'vault', name: '단어 보관함', body: '담은 단어를 기억 상태 네 색으로 봅니다. 지금 흔들리는 단어가 먼저 보여요.', tone: MODULE_TONE.wordvault.deep, spot: 'spot-vault', tile: 'tile-vault', href: '/wordvault', cta: '보관함 열기' },
  { id: 'review', name: '간격 복습', body: '잊을 때쯤 다시 꺼냅니다. 복습 간격은 FSRS 가 단어마다 계산해요.', tone: MODULE_TONE.flashcard.deep, spot: 'spot-memory', tile: 'tile-flashcard', href: '/flashcard', cta: '복습 시작' },
  { id: 'listen', name: '듣기 · 따라 말하기', body: '받아쓰기로 소리를 잡고, 따라 말한 억양을 원문과 겹쳐 비교합니다.', tone: MODULE_TONE.dictation.deep, spot: 'spot-listening', tile: 'tile-dictation', href: '/dictate', cta: '받아쓰기' },
  { id: 'quiz', name: '지문 퀴즈', body: '읽은 글을 문항으로 다시 확인합니다. 틀린 자리는 다음 복습으로 이어져요.', tone: MODULE_TONE.scriptquiz.deep, spot: 'spot-quiz', tile: 'tile-quiz', href: '/scriptquiz', cta: '퀴즈 풀기' },
] as const

export default async function LandingPage() {
  const [signals, demo] = await Promise.all([fetchTrustSignals(), buildHeroDemo()])

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--t1)]">
      <SiteHeader />

      <main className="flex-1">
        {/* ── 히어로 — 왼쪽 정렬 · 64px 두 줄 · 세리프 부제 ── */}
        <section className="mx-auto max-w-[1360px] px-4 pb-10 pt-6 lg:px-10 lg:pt-4">
          <Link
            href="/fit"
            className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--ju)] text-[14px] text-[var(--ju)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            <span className="border-r border-[var(--ju)] px-3 font-mono text-[12px] font-[700] uppercase tracking-[0.05em]">New</span>
            <span className="inline-flex items-center gap-1.5 px-3 font-[500]">
              로그인 없이 지문 난이도 재기 <ArrowRight size={14} aria-hidden />
            </span>
          </Link>

          <h1 className="mt-7 max-w-[20ch] break-keep font-display text-[40px] font-[400] leading-[1.08] tracking-[-0.03em] text-[var(--t1)] md:text-[64px]">
            글이 어려운 게 아니라
            <br />
            내가 아는 비율이 다른 겁니다.
          </h1>
          <p className="mt-6 max-w-[52ch] break-keep font-serif text-[20px] leading-[1.35] text-[var(--ju)] md:text-[26px]">
            이 글이 편하게 읽히기까지 몇 단어가 남았는지 계산해 드려요.
          </p>

          <div className="mt-8">
            <LandingCta />
          </div>

          {/* 이름 흐름 띠 — 참조 고객 로고 줄 자리. 로고를 지어내지 않고 **실제로 읽을거리를 가져오는 곳**의 이름만. */}
          <SourceMarquee label="읽을거리를 가져오는 곳" names={CONTENT_SOURCES} />

          {/* 증거 띠 — 참조의 고객 로고 줄 자리. 로고 대신 DB 실측(못 읽으면 줄이 없다). */}
          {signals && signals.length > 0 && (
            <ul aria-label="플랫폼 규모" className="mt-14 flex flex-wrap items-baseline gap-x-14 gap-y-6">
              {signals.map((s) => (
                <li key={s.label} className="flex items-baseline gap-3">
                  <span className="font-display text-[30px] font-[600] tabular-nums tracking-[-0.02em] text-[var(--ju)]">{s.value}</span>
                  <span className="font-body text-[14px] text-[var(--ju)]">
                    {s.label} <span className="opacity-90">· {s.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── 폭 전체 삽화 + 겹치는 제품 액자(조작 가능한 증명) ── */}
        <section aria-label="직접 재 보기" className="relative">
          <SectionBeacon section="demo" />
          {/* 참조 「100×」 — 꽃무늬로 채운 거대한 글자 + 걸친 리본. 글자는 제목이 아니라 장식이라 aria-hidden */}
          <div aria-hidden className="relative mx-auto max-w-[1360px] overflow-hidden px-2 pt-6 text-center">
            <PatternWord image="hero-book-field" className="block select-none font-display text-[26vw] font-[800] leading-[0.82] tracking-[-0.06em] lg:text-[300px]">
              아는 비율
            </PatternWord>
            <Ribbon tone="green" className="absolute left-[12%] top-[26%] -rotate-[5deg]">로그인 없이</Ribbon>
            <Ribbon tone="orange" className="absolute right-[14%] top-[14%] rotate-[4deg]">문맥 그대로</Ribbon>
            <Ribbon tone="magenta" className="absolute right-[6%] top-[52%] rotate-[6deg]">간격 복습 FSRS</Ribbon>
          </div>
          {demo && (
            <div className="relative z-10 mx-auto -mt-[5vw] max-w-[1360px] px-4 lg:-mt-[70px] lg:px-10">
              <FrameBar tab="이 글, 지금 재 보는 중" />
              <div className="rounded-[var(--r-2xl)] border-2 border-[var(--bd)] bg-[var(--bg2)] p-2 md:p-3">
                <div className="rounded-[18px] border border-[var(--bd)] bg-[var(--bg)] px-4 py-6 md:px-10 md:py-8">
                  <CoverageHero demo={demo} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 선언문 — 모노 눈썹 · 굵은 세리프 · 가운데 ── */}
        <section className="relative mx-auto max-w-[1360px] px-4 py-24 lg:px-10 lg:py-36">
          <MonitorCluster side="left" />
          <MonitorCluster side="right" />
          <div className="mx-auto max-w-[36rem] text-center">
            <p className="font-mono text-[13px] font-[700] uppercase tracking-[0.06em] text-[var(--ju)]">읽기가 막히는 진짜 이유</p>
            {/* 참조 선언 제목 — 같은 세리프로 앞 문장은 가늘게, 뒷 문장은 굵게 */}
            <h2 className="mt-6 break-keep font-serif text-[36px] leading-[1.12] tracking-[-0.02em] text-[var(--t1)] md:text-[56px]">
              <span className="font-[300]">단어장은 길어지는데</span>
              <br />
              <span className="font-[800]">글은 여전히 어렵다.</span>
            </h2>
            <Image src={`${ILLO}/spot-topic-talk.webp`} alt="" width={1328} height={1328} className="mx-auto mt-8 w-[96px] select-none" />
            <p className="mt-8 break-keep font-serif text-[18px] leading-[1.6] text-[var(--ju)] md:text-[20px]">
              같은 글도 읽는 사람마다 모르는 단어가 다릅니다. 그래서 글의 &lsquo;난이도&rsquo;는 한 숫자로 정해지지 않아요.
            </p>
            <p className="mt-4 break-keep font-serif text-[18px] leading-[1.6] text-[var(--ju)] md:text-[20px]">
              Vocaflow 는 이 글에서 내가 이미 아는 비율을 재고, 편하게 읽히기까지 남은 단어만 골라 줍니다.
            </p>
          </div>
        </section>

        {/* ── 보라 통판 — 흰 제목 · 오른쪽 항목 · 아래 꽃밭 ── */}
        <section aria-label="다른 점" className="mx-auto max-w-[1360px] px-4 lg:px-10">
          <SectionBeacon section="differentiators" />
          <div className="relative overflow-hidden rounded-[var(--r-2xl)] bg-[var(--ju)] text-[var(--on-ju)] lg:min-h-[800px]">
            <div className="relative z-10 grid gap-12 px-6 pb-[34vw] pt-12 md:px-14 md:pt-14 lg:grid-cols-[1fr_1.1fr] lg:pb-16">
              <div>
                <p className="font-display text-[14px] font-[700] tracking-[0.04em]">Vocaflow 가 재는 것</p>
                <h2 className="mt-8 break-keep font-display text-[36px] font-[400] leading-[1.1] tracking-[-0.03em] md:text-[52px]">
                  모르는 단어가 아니라,
                  <br />
                  아는 비율을 잽니다.
                </h2>
              </div>
              <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
                {DIFFERENTIATORS.map((d) => (
                  <article key={d.title}>
                    <h3 className="break-keep font-serif text-[24px] font-[700] leading-[1.15] tracking-[-0.01em]">{d.title}</h3>
                    <p className="mt-3 break-keep font-body text-[15px] leading-[1.6]">{d.body}</p>
                    <p className="mt-3 font-body text-[12.5px] leading-snug opacity-90">{d.basis}</p>
                  </article>
                ))}
                <div className="flex items-end">
                  <Link href="/library/books" className={`${PILL} bg-[var(--on-ju)] text-[var(--ju)] hover:bg-[var(--bg3)]`}>
                    서가 둘러보기
                  </Link>
                </div>
              </div>
            </div>
            <Image
              src={`${ILLO}/bed-flowers.webp`}
              alt=""
              width={1664}
              height={928}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="pointer-events-none absolute bottom-0 left-0 w-full select-none [mask-image:linear-gradient(to_right,black_78%,transparent)] lg:w-[52%]"
            />
          </div>
        </section>

        {/* ── 모듈 다섯 — 참조의 색면 탭 자리 ── */}
        <section className="mx-auto max-w-[1360px] px-4 py-24 lg:px-10 lg:py-32">
          <p className="font-display text-[14px] font-[700] tracking-[0.04em] text-[var(--ju)]">한 글로 이어지는 학습</p>
          <h2 className="mt-6 max-w-[22ch] break-keep font-display text-[36px] font-[400] leading-[1.08] tracking-[-0.03em] text-[var(--t1)] md:text-[56px]">
            읽은 글이 그대로 단어장이 되고, 복습이 됩니다.
          </h2>
          <p className="mt-6 max-w-[48ch] break-keep font-serif text-[20px] leading-[1.4] text-[var(--ju)] md:text-[26px]">
            지문에서 담은 단어가 다섯 가지 연습으로 이어집니다. 새 단어장을 따로 만들 필요가 없어요.
          </p>
          <div className="mt-12">
            <ToneTabs
              label="학습 모듈"
              items={MODULES.map((m) => ({
                id: m.id,
                label: m.name,
                summary: m.body.split('.')[0] + '.',
                tone: m.tone,
                spot: m.spot,
                panel: (
                  <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
                    <div>
                      <h3 className="break-keep font-display text-[30px] font-[400] leading-[1.1] tracking-[-0.02em] md:text-[40px]">{m.name}</h3>
                      <p className="mt-4 max-w-[46ch] break-keep font-serif text-[19px] leading-[1.5] md:text-[22px]">{m.body}</p>
                      <Link href={m.href} className={`${BTN.onDeep} mt-8`}>
                        {m.cta}
                      </Link>
                    </div>
                    <Image src={`${ILLO}/${m.tile}.webp`} alt="" width={1328} height={1328} className="w-[220px] select-none justify-self-center rounded-[14px] md:w-[300px]" />
                  </div>
                ),
              }))}
            />
          </div>
        </section>

        {/* ── 두 갈래 문 — 참조의 보라 카드 줄 ── */}
        <section className="mx-auto max-w-[1360px] px-4 pb-24 lg:px-10">
          <SectionBeacon section="doors" />
          <div className="grid gap-6 md:grid-cols-2">
            <DoorCard
              href="/library/books"
              title="무엇을 읽나요."
              body="퍼블릭 도메인 고전과 복원 만화를 챕터별 어휘와 함께 읽습니다. 로그인 없이 둘러볼 수 있어요."
              cta="서가 둘러보기"
              illo="tile-books"
              tone={DEEP_CLASS[MATERIAL_TONE.book.deep]}
            />
            <DoorCard
              href="/teacher"
              title="가르치시나요."
              body="학급을 만들고 초대코드를 나눠 주면 학생들의 어휘 진행을 한 화면에서 봅니다."
              cta="교사 허브"
              illo="tile-teacher"
              tone={DEEP_CLASS.charcoal}
            />
          </div>
        </section>

        {/* ── 마지막 CTA ── */}
        <section className="mx-auto max-w-[1360px] px-4 pb-28 lg:px-10">
          <div className="flex flex-col items-center text-center">
            {/* 참조 「Start today」 — 보라 모자이크로 채운 거대 글자 */}
            <h2 className="break-keep font-display text-[64px] font-[800] leading-[0.95] tracking-[-0.05em] md:text-[150px]">
              <PatternWord image="pattern-kaleido-1">오늘 읽을 글부터.</PatternWord>
            </h2>
            <div className="mt-10">
              <LandingCta align="center" trackView={false} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

/** 문 카드 — 참조 사례 카드처럼 범주 색의 진한 면(도서 초록 · 교사 청록), 구석에 타일. */
function DoorCard({ href, title, body, cta, illo, tone }: { href: string; title: string; body: string; cta: string; illo: string; tone: string }) {
  return (
    <Link
      href={href}
      className={`${tone} group relative flex min-h-[380px] flex-col overflow-hidden rounded-[var(--r-2xl)] p-8 text-[var(--t1)] transition-[filter] duration-[var(--dur-quick)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] md:p-10`}
    >
      <h2 className="break-keep font-serif text-[30px] font-[700] leading-[1.15]">{title}</h2>
      <p className="mt-3 max-w-[30ch] break-keep font-serif text-[20px] leading-[1.45]">{body}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 font-display text-[14px] font-[700] tracking-[0.02em]">
        {cta} <ArrowRight size={14} aria-hidden />
      </span>
      <Image src={`/illustrations/tines/${illo}.webp`} alt="" width={1328} height={1328} className="absolute bottom-6 right-6 w-[170px] rounded-[14px]" />
    </Link>
  )
}
