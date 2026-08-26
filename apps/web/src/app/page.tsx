// apps/web/src/app/page.tsx
//
// 랜딩 — 검색과 공유가 도착하는 곳.
//
// 왜 새로 만들었나 (2026-08-26 실측):
//   이 자리에는 **개발용 화면 인덱스**가 있었다(`'use client'`, 307줄). 그런데 sitemap 은
//   이 경로를 **priority 1.0** 으로, 즉 검색 첫 문으로 광고하고 있었다. 같은 날 콘텐츠 상세
//   123개를 sitemap 에 올렸으니, 문 132개가 전부 개발자용 인덱스를 가리키고 있었던 셈이다.
//   `(marketing)` 그룹에는 about·fit·pricing·terms·privacy 만 있고 **랜딩이 없었다.**
//   → 화면 인덱스는 `/dev` 로 옮기고(robots 가 막는다) 이 자리를 랜딩으로 채운다.
//
// ── 무엇을 말하고 무엇을 말하지 않는가 ──────────────────────────────
// **지어낸 것을 쓰지 않는다.** 후기·이용자 수·평점·도입 기관은 한 줄도 없다 —
// 2026-08-16 진단에서 `/pricing` 이 "학습자 12,000+ / 평점 4.8 / 학교 34곳"(실측 3/0/0)을
// 걸고 있었고, 그건 표시광고법이 정면으로 다루는 항목이다.
// 대신 **검증 가능한 동작**(`lib/marketing/differentiators.ts`)과 **DB 실측**
// (`lib/marketing/trust-signals.ts`)만 말한다. 수치를 못 읽으면 그 자리는 비운다.
//
// ── 첫 CTA 가 가입이 아닌 이유 ──────────────────────────────────────
// `/fit` 은 **로그인 없이** 지문 난이도를 재 준다. 가입 전에 가치를 보여주는 유일한 화면이고,
// 교사 채널(CAC 0)이 성립하려면 이 문이 가장 넓어야 한다(sitemap 이 같은 이유로 0.9 를 준다).
// 그래서 1차 CTA 는 "먼저 재 보기" 이고 가입은 그 다음이다.

import { ArrowRight, BookOpen, GraduationCap, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { DIFFERENTIATORS } from '@/lib/marketing/differentiators'
import { fetchTrustSignals } from '@/lib/marketing/trust-signals'

export const metadata: Metadata = {
  title: 'Vocaflow — 내가 아는 비율로 읽기를 설계합니다',
  description:
    '글의 난이도가 아니라 "내가 아는 비율"을 잽니다. 이 글이 편하게 읽히기까지 몇 단어가 남았는지 계산해 드려요. 로그인 없이 먼저 재 보세요.',
  alternates: { canonical: '/' },
}

/** 신뢰 지표는 매 요청 세지 않는다 — 하루 한 번이면 충분하다. */
export const revalidate = 86400

export default async function LandingPage() {
  const signals = await fetchTrustSignals()

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--t1)]">
      <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between border-b border-[var(--bd)] bg-[var(--bg)]/90 px-4 backdrop-blur lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Vocaflow 홈">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--p)] text-white">
            <Sparkles size={16} aria-hidden />
          </span>
          <span className="font-display text-[17px] font-[800] tracking-tight">Vocaflow</span>
        </Link>
        <nav className="flex items-center gap-1">
          <HeaderLink href="/about">소개</HeaderLink>
          <HeaderLink href="/pricing">요금제</HeaderLink>
          <Link
            href="/login"
            className="ml-1 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-4 font-body text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            로그인
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── Hero — 1차 CTA 는 가입이 아니라 "먼저 재 보기" ── */}
        <section className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
          <h1 className="font-display text-[30px] font-[800] leading-[1.25] tracking-tight text-[var(--t1)] md:text-[42px]">
            글이 어려운 게 아니라
            <br />
            <span className="text-[var(--p)]">내가 아는 비율</span>이 다른 겁니다
          </h1>
          <p className="mx-auto mt-5 max-w-[46ch] font-body text-[15px] leading-relaxed text-[var(--t2)] md:text-[16px]">
            같은 글도 사람마다 다른 숫자가 나옵니다. 이 글이 편하게 읽히기까지 몇 단어가 남았는지
            계산해 드려요.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/fit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 font-body text-[14px] font-[700] text-white transition-opacity duration-[var(--dur-normal)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              지문 난이도 재 보기
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-6 font-body text-[14px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              무료로 시작하기
            </Link>
          </div>
          <p className="mt-3 font-body text-[12px] text-[var(--t3)]">
            난이도 진단은 <strong>로그인 없이</strong> 바로 쓸 수 있어요
          </p>
        </section>

        {/* ── 다른 점 — 후기가 아니라 검증 가능한 동작 ── */}
        <section aria-label="다른 점" className="border-y border-[var(--bd)] bg-[var(--bg2)]">
          <div className="mx-auto grid max-w-5xl gap-5 px-6 py-12 md:grid-cols-3 md:py-16">
            {DIFFERENTIATORS.map((d) => (
              <article key={d.title} className="flex flex-col">
                <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">{d.title}</h2>
                <p className="mt-2 flex-1 font-body text-[13.5px] leading-relaxed text-[var(--t2)]">
                  {d.body}
                </p>
                <p className="mt-3 font-mono text-[10.5px] leading-snug text-[var(--t3)]">
                  {d.basis}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 신뢰 지표 — 서버가 DB 에서 읽은 것만. 못 읽으면 섹션 자체가 없다. ── */}
        {signals && signals.length > 0 && (
          <section aria-label="플랫폼 규모" className="border-b border-[var(--bd)]">
            <div className="mx-auto max-w-4xl px-6 py-8">
              <ul className="grid grid-cols-3 divide-x divide-[var(--bd)]">
                {signals.map((s) => (
                  <li key={s.label} className="px-3 text-center first:pl-0 last:pr-0">
                    <p className="font-display text-[20px] font-[800] tabular-nums tracking-tight text-[var(--t1)] md:text-[26px]">
                      {s.value}
                    </p>
                    <p className="mt-0.5 font-display text-[10.5px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                      {s.label}
                    </p>
                    <p className="mt-0.5 font-body text-[10.5px] text-[var(--t2)]">{s.sub}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── 두 갈래 문 — 읽을 것 / 가르칠 것 ── */}
        <section className="mx-auto max-w-5xl px-6 py-14 md:py-20">
          <div className="grid gap-5 md:grid-cols-2">
            <DoorCard
              href="/library/books"
              icon={<BookOpen size={18} aria-hidden />}
              title="무엇을 읽나요"
              body="퍼블릭 도메인 고전과 복원 만화를 챕터별 어휘와 함께 읽습니다. 로그인 없이 둘러볼 수 있어요."
              cta="서가 둘러보기"
            />
            <DoorCard
              href="/teacher"
              icon={<GraduationCap size={18} aria-hidden />}
              title="가르치시나요"
              body="학급을 만들고 초대코드를 나눠 주면 학생들의 어휘 진행을 한 화면에서 봅니다."
              cta="교사 허브"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--bd)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-[12px] text-[var(--t3)]">
            Vocaflow — 영어 스크립트 기반 어휘 학습
          </p>
          <nav className="flex flex-wrap items-center gap-4">
            <FooterLink href="/about">소개</FooterLink>
            <FooterLink href="/pricing">요금제</FooterLink>
            <FooterLink href="/terms">이용약관</FooterLink>
            <FooterLink href="/privacy">개인정보처리방침</FooterLink>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-3 font-body text-[13px] font-[500] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
    >
      {children}
    </Link>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-body text-[12px] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
    >
      {children}
    </Link>
  )
}

function DoorCard({
  href,
  icon,
  title,
  body,
  cta,
}: {
  href: string
  icon: React.ReactNode
  title: string
  body: string
  cta: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6 transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-[var(--bg2)] text-[var(--p)]">
        {icon}
      </span>
      <h2 className="mt-3 font-display text-[16px] font-[700] text-[var(--t1)]">{title}</h2>
      <p className="mt-1.5 flex-1 font-body text-[13.5px] leading-relaxed text-[var(--t2)]">
        {body}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 font-body text-[13px] font-[600] text-[var(--p)]">
        {cta}
        <ArrowRight
          size={14}
          aria-hidden
          className="transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </span>
    </Link>
  )
}
