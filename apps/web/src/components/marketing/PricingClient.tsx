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
// 이 파일은 클라이언트 컴포넌트가 아니다 — 월간/연간 토글(`useState`)이 사라지면서 훅이
// 0개가 됐다. 가입 전 첫인상 화면을 이유 없이 클라이언트 번들에 실을 이유가 없다.

import { Check, Heart, Mail, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'

import { DIFFERENTIATORS } from '@/lib/marketing/differentiators'
import type { TrustSignal } from '@/lib/marketing/trust-signals'

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

/**
 * @param signals 서버가 DB 에서 읽은 신뢰 지표. null 이면 **섹션을 통째로 숨긴다** —
 *   낡거나 0 인 숫자를 공개 화면에 거는 것보다 안 보여주는 편이 낫다.
 */
export function PricingClient({ signals }: { signals: TrustSignal[] | null }) {
  return (
    <div className="bg-[var(--bg)]">
      {/* ── Hero ── */}
      <section className="border-b border-[var(--bd)] bg-gradient-to-br from-[var(--bg2)] to-[var(--bg)]">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--bg)] px-4 py-2 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)] shadow-[var(--sh-xs)]">
            <Sparkles size={12} className="text-[var(--p)]" aria-hidden />
            요금제
          </span>
          <h1 className="mt-6 break-keep font-display text-[36px] font-[800] leading-[1.15] tracking-tight text-[var(--t1)] md:text-[48px]">
            지금은 전부 무료입니다
          </h1>
          <p className="mx-auto mt-4 max-w-xl break-keep font-body text-[15px] leading-relaxed text-[var(--t2)]">
            유료 플랜을 아직 만들지 않았습니다. 결제 수단을 받는 화면도 없어요. 지금 있는 기능은
            제한 없이 쓰시면 됩니다.
          </p>
        </div>
      </section>

      {/* ── Trust signals — 서버가 읽어 준 것만. 못 읽었으면 섹션 자체가 없다. ── */}
      {signals && signals.length > 0 && (
        <section aria-label="신뢰 지표" className="border-b border-[var(--bd)] bg-[var(--bg)]">
          <div className="mx-auto max-w-4xl px-6 py-8">
            <ul className="grid grid-cols-3 divide-x divide-[var(--bd)]">
              {signals.map((s) => (
                <li key={s.label} className="px-4 text-center first:pl-0 last:pr-0">
                  <p className="font-display text-[24px] font-[800] tabular-nums tracking-tight text-[var(--t1)] md:text-[28px]">
                    {s.value}
                  </p>
                  <p className="mt-0.5 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                    {s.label}
                  </p>
                  <p className="mt-0.5 break-keep font-body text-[11px] text-[var(--t2)]">{s.sub}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── 지금 / 준비 중 / 학교 ── */}
      <section className="bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* ① 지금 — 유일하게 "지금 할 수 있는" 카드 */}
            <li className="relative flex flex-col rounded-[var(--r-2xl)] border border-[var(--p)] bg-[var(--bg)] p-6 shadow-[var(--sh-lg)] transition-all duration-[var(--dur-normal)] md:-translate-y-2 md:p-7">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] bg-[var(--p-light)] text-[var(--p)]"
                aria-hidden
              >
                <Heart size={18} strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 break-keep font-display text-[22px] font-[800] text-[var(--t1)]">
                지금 쓰실 수 있는 것
              </h2>
              <p className="mt-1 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
                계정만 만들면 아래가 전부 열립니다.
              </p>

              <p className="mt-6 font-display text-[40px] font-[800] leading-none tracking-tight text-[var(--t1)] md:text-[44px]">
                무료
              </p>
              <p className="mt-2 break-keep font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t2)]">
                결제 수단을 받지 않습니다
              </p>

              <Link
                href="/signup"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] hover:shadow-[var(--sh-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97]"
              >
                무료로 시작하기
              </Link>

              <ul className="mt-6 space-y-3 border-t border-[var(--bd)] pt-6">
                {AVAILABLE_NOW.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]"
                      aria-hidden
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </li>

            {/* ② 준비 중 — 가격도 날짜도 적지 않는다. 적을 근거가 없다. */}
            <li className="relative flex flex-col rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)] md:p-7">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg2)] text-[var(--t2)]"
                aria-hidden
              >
                <Sparkles size={18} strokeWidth={1.75} />
              </span>
              <div className="mt-4 flex items-center gap-2">
                <h2 className="break-keep font-display text-[22px] font-[800] text-[var(--t1)]">
                  유료 플랜
                </h2>
                <span className="rounded-full border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                  준비 중
                </span>
              </div>
              <p className="mt-1 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
                가격도 조건도 아직 정하지 않았습니다.
              </p>

              <p className="mt-6 break-keep font-body text-[14px] leading-[1.7] text-[var(--t2)]">
                정해지기 전에는 이 자리에 숫자를 적지 않습니다. 만들게 되면 시작 전에 안내드리고,
                <strong className="text-[var(--t1)]"> 그 전까지 쓰신 것에는 요금이 붙지 않습니다.</strong>
              </p>

              <a
                href={`mailto:${CONTACT}?subject=${encodeURIComponent('유료 플랜 소식 받기')}`}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] border-2 border-[var(--bd)] bg-[var(--bg)] px-5 font-display text-[14px] font-[700] text-[var(--t1)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97]"
              >
                <Mail size={14} strokeWidth={2.25} aria-hidden />
                정해지면 알려주세요
              </a>

              <ul className="mt-6 space-y-3 border-t border-[var(--bd)] pt-6">
                <li className="break-keep font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                  아직 없는 것
                </li>
                {NOT_YET.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--t3)]"
                      aria-hidden
                    />
                    <span className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </li>

            {/* ③ 학교·학원 — 지금도 무료로 되는 기능이라 "문의" 는 도입 지원이지 견적이 아니다 */}
            <li className="relative flex flex-col rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)] md:p-7">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] bg-[var(--info-light)] text-[var(--info)]"
                aria-hidden
              >
                <Users size={18} strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 break-keep font-display text-[22px] font-[800] text-[var(--t1)]">
                선생님 · 학원
              </h2>
              <p className="mt-1 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
                학급 기능도 지금은 비용이 없습니다.
              </p>

              <p className="mt-6 break-keep font-body text-[14px] leading-[1.7] text-[var(--t2)]">
                학급을 만들고 초대코드를 나눠 주면 학생이 참여하고, 보낸 단어가 학생 단어장으로
                도착합니다. 반이 여러 개거나 도입 지원이 필요하면 메일로 알려 주세요.
              </p>

              {/* ⚠️ `/teacher` 는 보호 라우트다 — 익명 방문자를 그리로 보내면 설명 없이
                  로그인 폼으로 튕긴다. 되튕김을 예고하며 복귀 경로를 실어 보낸다. */}
              <Link
                href="/login?next=%2Fteacher"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] border-2 border-[var(--bd)] bg-[var(--bg)] px-5 font-display text-[14px] font-[700] text-[var(--t1)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97]"
              >
                로그인하고 교사 허브 열기
              </Link>
              <a
                href={`mailto:${CONTACT}?subject=${encodeURIComponent('학교·학원 도입 문의')}`}
                className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] px-5 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
              >
                <Mail size={14} strokeWidth={2.25} aria-hidden />
                {CONTACT}
              </a>
            </li>
          </ul>

          <p className="mx-auto mt-10 max-w-md break-keep text-center font-body text-[13px] italic text-[var(--t2)]">
            카드도 계좌도 받지 않습니다 — 받을 화면 자체가 없어요.
          </p>
        </div>
      </section>

      {/* ── 이 제품만 하는 것 ──
          지어낸 후기가 있던 자리. 후기는 실증자료 없이 게재할 수 없으므로,
          실제 학습자가 생기기 전까지는 **검증 가능한 동작**으로 대신한다. */}
      <section aria-label="다른 점" className="border-t border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <header className="mb-8 max-w-2xl">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
              What&apos;s different
            </p>
            <h2 className="mt-2 break-keep font-display text-[26px] font-[800] tracking-tight text-[var(--t1)]">
              읽기 전에, 이 글이 나에게 맞는지 먼저 알려줍니다
            </h2>
            <p className="mt-3 break-keep font-body text-[14px] leading-[1.7] text-[var(--t2)]">
              교과서 지문이든 선생님이 준 프린트든 붙여넣으면, 지금 내 어휘로 몇 %가 읽히는지
              바로 나옵니다. 그리고 몇 개를 더 익히면 편하게 읽히는지까지.
            </p>
            <Link
              href="/fit"
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[13.5px] font-[600] text-[var(--bg)] transition-all duration-[var(--dur-normal)] hover:brightness-110 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              지금 지문 넣어 보기 — 가입 없이
            </Link>
          </header>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {DIFFERENTIATORS.map((d) => (
              <li
                key={d.title}
                className="flex flex-col rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
              >
                <p className="break-keep font-display text-[14px] font-[700] text-[var(--t1)]">
                  {d.title}
                </p>
                <p className="mt-2 break-keep font-body text-[13px] leading-[1.7] text-[var(--t2)]">
                  {d.body}
                </p>
                <p className="mt-3 break-keep border-t border-[var(--bd)] pt-3 font-mono text-[11px] leading-[1.6] text-[var(--t2)]">
                  {d.basis}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <header className="mb-8 text-center">
            <p className="font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
              FAQ
            </p>
            <h2 className="mt-2 break-keep font-display text-[26px] font-[800] tracking-tight text-[var(--t1)]">
              자주 묻는 질문
            </h2>
          </header>

          <ul className="space-y-3">
            {FAQS.map((faq) => (
              <li
                key={faq.q}
                className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-xs)]"
              >
                <details className="group">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--r-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
                    <span className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
                      {faq.q}
                    </span>
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg2)] text-[var(--t2)] transition-transform duration-[var(--dur-normal)] group-open:rotate-45"
                      aria-hidden
                    >
                      <span className="font-display text-[16px] font-[600]">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 break-keep font-body text-[14px] leading-relaxed text-[var(--t2)]">
                    {faq.a}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-br from-[var(--p)] to-[#6D28D9] text-[var(--ti)]">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h2 className="break-keep font-display text-[26px] font-[800] tracking-tight md:text-[32px]">
            먼저 지문 하나로 확인해 보세요
          </h2>
          <p className="mx-auto mt-3 max-w-md break-keep font-body text-[15px] leading-relaxed opacity-90">
            가입하지 않아도 됩니다. 마음에 들면 그때 계정을 만드세요.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/fit"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--ti)] px-6 font-display text-[14px] font-[700] text-[var(--p)] shadow-[var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ti)] active:scale-[0.97] sm:w-auto"
            >
              지문 진단 해보기
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--ti)] px-6 font-display text-[14px] font-[700] text-[var(--ti)] transition-all duration-[var(--dur-normal)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ti)] active:scale-[0.97] sm:w-auto"
            >
              무료로 시작하기
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
