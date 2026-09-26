// apps/web/src/components/marketing/PricingClient.tsx
// 요금제 화면 — **팔 수 있는 것만 말한다.**
//
// ── 2026-09-05 정정 (이 파일의 존재 이유) ──────────────────────────────
// 이 화면은 Pro ₩9,900/월 · Team ₩29,900/월 카드를 세우고 1차 CTA 로 `14일 무료 체험` 을,
// FAQ 로 `결제 후 14일 이내 사유 무관 전액 환불` 을 약속하고 있었다.
// **그 약속을 받아 줄 곳이 코드에 없다** (실측 2026-09-05):
//   - 학습자 표면(`app/(main)`)에 결제·구독·업그레이드 라우트 **0개**
//     (`billing` 은 `app/admin/billing` 관리자 화면 하나뿐)
//   - `plan=pro` · `subscription_tier` 문자열 **0건**, 체험 시작·만료를 기록하는 코드 0건
//   - Free 에 적혀 있던 제한("월 5개 스크립트 · 단어 100개")을 **강제하는 코드도 없다** —
//     즉 무료/유료 구분 자체가 아직 존재하지 않는다
// 목적지가 없는 CTA 는 화면에서 즉시 내린다 (CLAUDE.md §4️⃣ — 공개 라우트의 목업/허위
// 표시는 순서 규칙의 유일한 예외, 표시광고법 리스크). 같은 이유로 2026-08-29 에
// "없는 AI 기능" 을 한 번 정정했고, 그때 가격표만 남겨 둔 것이 이번 결함이다.
//
// 지금 이 화면이 하는 말은 셋뿐이다:
//   ① 지금은 전부 무료다 (결제 기능이 없어서다 — 마케팅 혜택이 아니다)
//   ② 나중에 유료 플랜을 만들 수 있다. 가격·조건은 정해지지 않았다
//   ③ 정해지면 미리 알린다 — 지금 쓴 것에 소급해 청구하지 않는다
//
// ⚠️ 신뢰 지표는 **여기서 정하지 않는다.** 서버(page.tsx)가 DB 에서 읽어 넘긴다 —
//    상수로 적어 두면 반드시 낡는다(2026-08-26 에 세 수치가 9일 만에 전부 어긋나 있었다).
//    lib/marketing/trust-signals.ts 참조.
//
// 모양(DD-68 · tines-mapping §23): 참조 요금제 화면 — 폭 전체 보라 띠에 가운데 제목(양옆 소품 + 떠 있는 색 막대) ·
// 윗변 이름표 카드 3(옅은 초록 · 진한 보라 · 살구, 버튼을 가로지르는 구분선 · 오른쪽 아래 소품) · 출처 흐름 띠 ·
// 접힌 모서리 약속 카드 → 차별점 → 영상 → FAQ 펼침.
// 끝 CTA 는 레이아웃(`MarketingTail`)이 맡는다. **문구·데이터는 모양 바꿈과 무관하게 그대로다.**
//
// 이 파일은 클라이언트 컴포넌트가 아니다 — 월간/연간 토글(`useState`)이 사라지면서 훅이
// 0개가 됐다. 가입 전 첫인상 화면을 이유 없이 클라이언트 번들에 실을 이유가 없다.

import { Check, Mail } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { SourceMarquee } from '@/components/marketing/signature'
import { ComponentVideo } from '@/components/video/ComponentVideo'
import { curriculumVideo, videosByKind } from '@/lib/video/catalog'
import { DIFFERENTIATORS } from '@/lib/marketing/differentiators'
import { CONTENT_SOURCES } from '@/lib/marketing/sources'
import type { TrustSignal } from '@/lib/marketing/trust-signals'
import { Illustration } from '@/components/illustrations/Illustration'
import { ILLO_07_COVERAGE } from '@/components/illustrations/generated/illo-07-coverage'

import { PILL } from './pill'
import { Faq, Frame, Kicker, SectionHead, WRAP } from './sections'

/** 문의 주소 — 유료 플랜·학교 도입 모두 지금은 사람이 받는다. */
const CONTACT = 'hello@vocaflow.app'

/**
 * 지금 실제로 되는 것.
 *
 * 각 줄은 라우트나 모듈로 확인 가능한 것만 적는다 — "무제한" 같은 말은 제한을 거는 코드가
 * 없다는 사실의 다른 표현이라 쓰지 않는다(제한이 생기는 날 이 문구가 거짓이 된다).
 */
const AVAILABLE_NOW: readonly string[] = [
  '지문 진단 — 가입하지 않아도 바로',
  '내 어휘 기준 커버리지 · 남은 단어 수 계산',
  '단어장 + FSRS 간격 복습 (Flashcard)',
  'SpellForge · WordBlitz · PairFlip · EchoMatch · ScriptQuiz',
  '공개 도서·글 카탈로그에서 챕터 단어장 받기',
  '학급 만들기 · 초대코드로 학생 참여 · 단어 보내기',
] as const

/** 아직 없는 것 — 있는 척하지 않는다. 물어보는 사람이 반드시 있으므로 먼저 적는다. */
const NOT_YET: readonly string[] = [
  '결제 · 구독 · 유료 플랜',
  '소셜 로그인 (Google 등)',
  '모바일 앱 (웹 브라우저로 이용)',
] as const

interface FAQ {
  q: string
  a: string
}

const FAQS: readonly FAQ[] = [
  {
    q: '정말 지금은 전부 무료인가요?',
    a: '네. 결제 기능 자체가 아직 없어서 받을 방법이 없습니다. 결제 수단을 입력받는 화면도 없습니다.',
  },
  {
    q: '나중에 유료로 바뀌면 지금 쓴 것에 요금이 붙나요?',
    a: '아니요. 소급 청구는 하지 않습니다. 유료 플랜을 만들면 시작 전에 안내드리고, 그때 쓰실지 정하시면 됩니다.',
  },
  {
    q: '유료 플랜은 언제, 얼마인가요?',
    a: '정해지지 않았습니다. 가격·조건이 정해지기 전에는 이 화면에 숫자를 적지 않습니다. 정해지면 알려드릴 수 있게 아래 주소로 메일 주세요.',
  },
  {
    // 2026-08-29 정정 — 원래 "GPT-4o-mini 기본 · Pro 는 GPT-4o · TTS 는 OpenAI TTS-1" 이라고 답하고 있었다.
    // 실측하면 그런 경로가 없다: API 라우트의 런타임 LLM 호출 0건이고, 음성은 브라우저
    // speechSynthesis 다. 회귀 락: components/marketing/__tests__/no-unbuilt-claims.test.ts
    q: '학습 화면이 외부 AI 를 호출하나요?',
    a: '아니요. 지문 판정과 레벨 산출은 자체 어휘 데이터로 하는 결정적 계산이라, 학습 중에는 외부 모델을 호출하지 않습니다. 음성도 기기 내장 음성을 씁니다. AI 는 콘텐츠와 사전을 만드는 단계에서만 쓰며, 그 범위는 개인정보처리방침에 적어 두었습니다.',
  },
  {
    q: '학교·학원에서 반 단위로 쓸 수 있나요?',
    a: '지금도 학급을 만들고 초대코드로 학생을 받고 단어를 보낼 수 있습니다. 비용은 없습니다. 인원이 많거나 별도 지원이 필요하면 메일로 문의해 주세요.',
  },
  {
    q: '데이터는 안전한가요?',
    a: 'Supabase RLS(Row-Level Security)로 사용자별 데이터를 격리합니다. 자세한 내용은 개인정보처리방침을 참고하세요.',
  },
] as const

/** 제목 둘레 떠 있는 색 막대(참조 요금제 머리) — 위치는 장식 영역(1180×300) 기준 고정값. */
const BARS: readonly { x: string; y: number; w: number; c: string }[] = [
  { x: '14%', y: 18, w: 34, c: 'bg-[var(--tint-green)]' },
  { x: '3%', y: 120, w: 20, c: 'bg-[var(--tint-lavender)]' },
  { x: '20%', y: 210, w: 26, c: 'bg-[var(--tint-peach)]' },
  { x: '8%', y: 250, w: 18, c: 'bg-[var(--tint-pink)]' },
  { x: '80%', y: 22, w: 34, c: 'bg-[var(--tint-pink)]' },
  { x: '95%', y: 130, w: 22, c: 'bg-[var(--tint-lavender)]' },
  { x: '76%', y: 240, w: 20, c: 'bg-[var(--tint-green)]' },
  { x: '88%', y: 262, w: 24, c: 'bg-[var(--tint-peach)]' },
]

/**
 * 요금 카드 — 참조 EXPLORE/DEPLOY 카드: 윗변 가운데 이름표 · 가운데 정렬 머리 · 버튼을 가로지르는 구분선(`CardAction`) ·
 * 아래 목록 · 오른쪽 아래 소품. 면 색은 `.tone-*` 가 글자·버튼 색까지 함께 바꾼다.
 */
function PlanCard({ tone, tab, spot, children }: { tone: string; tab: string; spot: string; children: React.ReactNode }) {
  return (
    <li className={`${tone} relative flex flex-col items-center overflow-hidden rounded-[14px] border border-[var(--bd)] px-7 pb-24 pt-14 text-center text-[var(--t1)]`}>
      <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-b-[8px] bg-[color-mix(in_srgb,var(--ju)_16%,transparent)] px-4 py-1.5 font-display text-[12.5px] font-[700] tracking-[0.04em]">
        {tab}
      </span>
      {children}
      <Image src={`/illustrations/tines/${spot}.webp`} alt="" width={1328} height={1328} className="pointer-events-none absolute bottom-4 right-4 w-[72px] select-none" />
    </li>
  )
}

/** 버튼 줄 — 카드 폭 전체 구분선이 버튼 한가운데를 지난다(참조). */
function CardAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-6 flex w-full justify-center">
      <span aria-hidden className="absolute -inset-x-7 top-1/2 h-px bg-[var(--bd)]" />
      {children}
    </div>
  )
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

/**
 * @param signals 서버가 DB 에서 읽은 신뢰 지표. null 이면 **섹션을 통째로 숨긴다** —
 *   낡거나 0 인 숫자를 공개 화면에 거는 것보다 안 보여주는 편이 낫다.
 */
export function PricingClient({ signals }: { signals: TrustSignal[] | null }) {
  const curriculum = curriculumVideo()
  const seriesVideos = videosByKind().series

  return (
    <div className="bg-[var(--bg)]">
      {/* ── 보라 띠 — 가운데 제목 · 실측 지표 · 이름표 카드 3 · 출처 흐름 · 약속 카드 (참조 요금제 상단) ── */}
      <section aria-labelledby="pricing-title" className="relative overflow-hidden bg-[var(--ju)] pb-24 pt-14 text-[var(--on-ju)] md:pt-20">
        {/* 참조 제목 양옆 기계 소품 + 흩어진 색 막대 — 장식 */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-[300px] max-w-[1180px] select-none lg:block">
          <Image src="/illustrations/tines/spot-dashboard.webp" alt="" width={1328} height={1328} className="absolute left-[4%] top-8 w-[150px]" />
          <Image src="/illustrations/tines/spot-quiz.webp" alt="" width={1328} height={1328} className="absolute right-[4%] top-10 w-[140px]" />
          {BARS.map((b, i) => (
            <span key={i} className={`absolute h-2 rounded-[2px] ${b.c}`} style={{ left: b.x, top: b.y, width: b.w }} />
          ))}
        </div>

        <div className={`${WRAP} relative text-center`}>
          <Kicker>요금제</Kicker>
          <h1 id="pricing-title" className="mt-4 break-keep font-display text-[44px] font-[400] leading-[1.04] tracking-[-0.03em] md:text-[72px]">
            지금은 전부 무료입니다.
          </h1>
          <p className="mx-auto mt-5 max-w-[40ch] break-keep font-serif text-[19px] leading-[1.4] md:text-[22px]">
            유료 플랜을 아직 만들지 않았습니다. 결제 수단을 받는 화면도 없어요. 지금 있는 기능은
            제한 없이 쓰시면 됩니다.
          </p>

          {/* 신뢰 지표 — 서버가 읽어 준 것만. 못 읽었으면 줄 자체가 없다. */}
          {signals && signals.length > 0 && (
            <ul aria-label="신뢰 지표" className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-3">
              {signals.map((s) => (
                <li key={s.label} className="flex items-baseline gap-2.5">
                  <span className="font-display text-[26px] font-[600] tabular-nums tracking-[-0.02em]">{s.value}</span>
                  <span className="break-keep font-body text-[13.5px]">{s.label} · {s.sub}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ul className={`${WRAP} relative mt-14 grid gap-4 md:grid-cols-3`}>
          {/* ① 지금 — 유일하게 "지금 할 수 있는" 카드 */}
          <PlanCard tone="tone-green" tab="지금" spot="spot-welcome">
            <h2 className="break-keep font-serif text-[24px] font-[700]">지금 쓰실 수 있는 것</h2>
            <p className="mt-1 break-keep font-body text-[14px]">계정만 만들면 아래가 전부 열립니다.</p>
            <p className="mt-5 font-display text-[52px] font-[400] leading-none tracking-[-0.03em]">무료</p>
            <p className="mt-2 break-keep font-body text-[13px]">결제 수단을 받지 않습니다</p>
            <CardAction>
              <Link href="/signup" className={`${PILL} relative bg-[var(--ju)] text-[var(--on-ju)] hover:brightness-110`}>무료로 시작하기</Link>
            </CardAction>
            <ul className="space-y-2.5 text-left">
              {AVAILABLE_NOW.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check size={16} strokeWidth={2.5} aria-hidden className="mt-0.5 shrink-0" />
                  <span className="break-keep font-body text-[14px] leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </PlanCard>

          {/* ② 준비 중 — 가격도 날짜도 적지 않는다. 적을 근거가 없다. */}
          <PlanCard tone="tone-deep-purple [--deep-purple:color-mix(in_srgb,var(--p)_70%,var(--deep-ink))]" tab="준비 중" spot="spot-locked">
            <h2 className="break-keep font-serif text-[24px] font-[700]">유료 플랜</h2>
            <p className="mt-1 break-keep font-body text-[14px]">가격도 조건도 아직 정하지 않았습니다.</p>
            <p className="mt-5 break-keep font-body text-[15px] leading-[1.7]">
              정해지기 전에는 이 자리에 숫자를 적지 않습니다. 만들게 되면 시작 전에 안내드리고,
              <strong> 그 전까지 쓰신 것에는 요금이 붙지 않습니다.</strong>
            </p>
            <CardAction>
              <a
                href={`mailto:${CONTACT}?subject=${encodeURIComponent('유료 플랜 소식 받기')}`}
                className={`${PILL} relative gap-2 bg-[var(--ju)] text-[var(--on-ju)] hover:brightness-95`}
              >
                <Mail size={14} strokeWidth={2.25} aria-hidden />
                정해지면 알려주세요
              </a>
            </CardAction>
            <ul className="space-y-2.5 text-left">
              <li className="break-keep font-display text-[13px] font-[700] tracking-[0.04em]">아직 없는 것</li>
              {NOT_YET.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ju)]" aria-hidden />
                  <span className="break-keep font-body text-[14px] leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </PlanCard>

          {/* ③ 학교·학원 — 지금도 무료로 되는 기능이라 "문의" 는 도입 지원이지 견적이 아니다 */}
          <PlanCard tone="tone-peach" tab="선생님 · 학원" spot="spot-teacher">
            <h2 className="break-keep font-serif text-[24px] font-[700]">학급 기능</h2>
            <p className="mt-1 break-keep font-body text-[14px]">학급 기능도 지금은 비용이 없습니다.</p>
            <p className="mt-5 break-keep font-body text-[15px] leading-[1.7]">
              학급을 만들고 초대코드를 나눠 주면 학생이 참여하고, 보낸 단어가 학생 단어장으로
              도착합니다. 반이 여러 개거나 도입 지원이 필요하면 메일로 알려 주세요.
            </p>
            {/* ⚠️ `/teacher` 는 보호 라우트다 — 익명 방문자를 그리로 보내면 설명 없이
                로그인 폼으로 튕긴다. 되튕김을 예고하며 복귀 경로를 실어 보낸다. */}
            <CardAction>
              <Link href="/login?next=%2Fteacher" className={`${PILL} relative bg-[var(--ju)] text-[var(--on-ju)] hover:brightness-110`}>
                로그인하고 교사 허브 열기
              </Link>
            </CardAction>
            <a
              href={`mailto:${CONTACT}?subject=${encodeURIComponent('학교·학원 도입 문의')}`}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-full font-display text-[14px] font-[600] underline-offset-4 hover:underline ${FOCUS}`}
            >
              <Mail size={14} strokeWidth={2.25} aria-hidden />
              {CONTACT}
            </a>
          </PlanCard>
        </ul>

        {/* 참조 고객 로고 흐름 자리 — 실제 콘텐츠 출처 이름. 보라 띠 위라 글자는 크림(--on-ju). */}
        <div className="mt-8 [--ju:var(--on-ju)]">
          <SourceMarquee label="읽을거리를 가져오는 곳" names={CONTENT_SOURCES} />
        </div>

        {/* 참조 접힌 모서리 인용 카드 자리 — 지어낸 추천사 대신 이 화면이 지키는 약속 */}
        <figure className={`${WRAP} relative mt-20`}>
          <div className="relative mx-auto max-w-[940px]">
            <span aria-hidden className="absolute -left-[5%] -top-6 bottom-6 w-[30%] rounded-[12px] bg-[color-mix(in_srgb,var(--p)_45%,var(--ju))] [clip-path:polygon(0_0,55%_0,100%_18px,100%_100%,0_100%)]" />
            <div className="relative rounded-[12px] border border-[color-mix(in_srgb,var(--on-ju)_20%,transparent)] bg-[color-mix(in_srgb,var(--p)_70%,var(--deep-ink))] px-8 py-10 text-[var(--on-deep)] md:px-12 md:py-12">
              <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] font-serif text-[22px]">&ldquo;</span>
              <blockquote className="mt-6 break-keep font-serif text-[24px] leading-[1.4] md:text-[32px]">
                카드도 계좌도 받지 않습니다 — 받을 화면 자체가 없어요. 유료 플랜을 만들게 되면 시작 전에 알리고, 그 전까지 쓰신 것에는 요금을 붙이지 않습니다.
              </blockquote>
              <figcaption className="mt-6 font-display text-[13.5px] font-[700]">Vocaflow 요금 약속</figcaption>
            </div>
          </div>
        </figure>
      </section>

      {/* ── 이 제품만 하는 것 ──
          지어낸 후기가 있던 자리. 후기는 실증자료 없이 게재할 수 없으므로,
          실제 학습자가 생기기 전까지는 **검증 가능한 동작**으로 대신한다. */}
      <section aria-label="다른 점" className={`${WRAP} py-24`}>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHead
              kicker="다른 점"
              title="읽기 전에, 이 글이 나에게 맞는지 먼저 알려줍니다."
              sub="교과서 지문이든 선생님이 준 프린트든 붙여넣으면, 지금 내 어휘로 몇 %가 읽히는지 바로 나옵니다. 그리고 몇 개를 더 익히면 편하게 읽히는지까지."
            />
            <Link href="/fit" className={`${PILL} mt-8 bg-[var(--ju)] text-[var(--on-ju)] hover:bg-[var(--p)]`}>
              지금 지문 넣어 보기 — 가입 없이
            </Link>
          </div>
          {/* 삽화(사전 #7 · 골든 S) */}
          <Frame>
            <div className="p-6">
              <Illustration asset={ILLO_07_COVERAGE} />
            </div>
          </Frame>
        </div>
        <ul className="mt-12 grid gap-3 md:grid-cols-3">
          {DIFFERENTIATORS.map((d) => (
            <li key={d.title} className="flex flex-col rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg2)] p-6 text-[var(--ju)]">
              <p className="break-keep font-serif text-[22px] font-[700]">{d.title}</p>
              <p className="mt-2 break-keep font-body text-[15px] leading-[1.6]">{d.body}</p>
              <p className="mt-auto break-keep border-t border-[var(--bd)] pt-3 font-body text-[12.5px] leading-[1.6]">{d.basis}</p>
            </li>
          ))}
        </ul>
      </section>

      {/*
        ── 무엇이 들어 있나 ──

        요금 화면의 질문은 "얼마인가" 다음에 곧바로 **"무엇을 사는가"** 다. 그 답이 여기까지
        전부 산문이었다 — 시리즈 이름과 학년 계단은 보여 줘야 잡힌다.
        커리큘럼 한 편 + 시리즈 세 편. 발행 전이면 이 절이 통째로 안 그려진다.
      */}
      {(curriculum || seriesVideos.length > 0) && (
        <section aria-label="무엇이 들어 있나" className={`${WRAP} pb-24`}>
          <SectionHead
            kicker="무엇이 들어 있나"
            title="무엇이 들어 있는지 60초로 봅니다."
            sub="학년을 잇는 7단 계단과 시리즈 셋. 화면에 나오는 재고 수치는 모두 실측이고 출처가 함께 나옵니다."
          />
          {curriculum && (
            <div className="mt-10 max-w-3xl">
              <Frame>
                <ComponentVideo video={curriculum} />
              </Frame>
            </div>
          )}
          {seriesVideos.length > 0 && (
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {seriesVideos.map((v) => (
                <article key={v.id}>
                  <Frame>
                    <ComponentVideo video={v} />
                  </Frame>
                  <h3 className="mt-3 break-keep font-serif text-[20px] font-[700]">
                    <Link href={`/video/${v.id}`} className="text-[var(--ju)] underline-offset-4 hover:underline">
                      {v.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── FAQ ── */}
      <section className={`${WRAP} pb-8`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <SectionHead kicker="FAQ" title="자주 묻는 질문." />
          <Faq items={FAQS.map((f) => ({ q: f.q, a: f.a }))} />
        </div>
      </section>
    </div>
  )
}
