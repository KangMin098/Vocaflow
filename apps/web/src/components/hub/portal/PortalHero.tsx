// apps/web/src/components/hub/portal/PortalHero.tsx
//
// 플랫폼 메인 배너 — 영역마다 한 장씩, 진한 범주 색 면 위에 큰 제목 · 알약 CTA · 구석 타일.
//
// 설계:
//   · 장이 바뀌어도 높이가 흔들리지 않게 모든 장을 한 칸에 겹쳐 두고 투명도만 바꾼다.
//   · 자동 넘김의 시계는 **아래 진행 막대의 애니메이션 자체**다(`onAnimationEnd`). setTimeout 을
//     따로 두면 일시정지 뒤 막대와 넘김이 어긋난다 — 막대를 멈추면 넘김도 같이 멈춘다.
//   · 멈춤: 포인터가 올라오거나 포커스가 안에 있으면 멈추고, 멈춤 버튼으로 계속 멈춰 둘 수 있다
//     (WCAG 2.2.2 — 5초 넘게 움직이는 것은 멈출 수 있어야 한다).
//   · `prefers-reduced-motion` — 자동 넘김을 시작하지 않는다. 장 전환은 페이드만 남긴다(낮추기, 끄기 아님).

'use client'

import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { track } from '@/lib/analytics/client'

export interface HeroSlide {
  id: string
  /** 구역 이름 — 아래 장 고르기 단추의 라벨도 된다 */
  label: string
  title: string
  body: string
  cta: string
  href: string
  /** `tone-deep-*` 클래스(글자 그대로 — lib/design/tone.ts DEEP_CLASS) */
  tone: string
  illo: string
  /** DB 에서 센 한 줄(없으면 안 그린다) */
  fact?: string | null
}

const DWELL_MS = 7000
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export function PortalHero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false) // 사용자가 멈춤 단추로 멈췄다
  const [hover, setHover] = useState(false)
  const [focusIn, setFocusIn] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const count = slides.length
  if (count === 0) return null

  const running = !held && !reduced && count > 1
  const paused = !running || hover || focusIn
  const go = (next: number, via?: 'dot' | 'arrow') => {
    const to = (next + count) % count
    setIndex(to)
    if (via) track({ name: 'hub_hero_moved', props: { index: to, via } })
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Vocaflow 둘러보기"
      className="relative flex min-h-[440px] flex-col overflow-hidden rounded-[var(--r-2xl)] md:min-h-[460px]"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocusIn(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(false)
      }}
    >
      <style>{`@keyframes hub-hero-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>

      {/* 장 — 한 칸에 겹친다 */}
      <div className="grid flex-1 [grid-template-areas:'stack']">
        {slides.map((s, i) => {
          const active = i === index
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count} · ${s.label}`}
              aria-hidden={!active}
              className={`${s.tone} relative flex flex-col overflow-hidden px-6 pb-24 pt-7 [grid-area:stack] md:pr-[300px] lg:pr-[340px] transition-opacity duration-[var(--dur-slow,480ms)] ease-[var(--ease-out-quint)] md:px-12 md:pb-24 md:pt-11 ${
                active ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'
              }`}
            >
              <p className="inline-flex h-7 w-fit items-center rounded-full border border-[var(--bd)] px-3 font-mono text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t1)]">
                {String(i + 1).padStart(2, '0')} · {s.label}
              </p>
              <h2 className="mt-6 max-w-[14ch] whitespace-pre-line break-keep font-display text-[36px] font-[400] leading-[1.06] tracking-[-0.03em] text-[var(--t1)] md:max-w-[16ch] md:text-[56px]">
                {s.title}
              </h2>
              <p className="mt-5 max-w-[34ch] break-keep font-serif text-[17px] leading-[1.5] text-[var(--t1)] md:max-w-[40ch] md:text-[20px]">
                {s.body}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href={s.href}
                  tabIndex={active ? 0 : -1}
                  onClick={() => track({ name: 'hub_promo_clicked', props: { slot: 'hero', index: i } })}
                  className={`inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--on-deep)] px-6 font-display text-[15px] font-[700] text-[var(--on-ju)] no-underline transition-opacity duration-[var(--dur-quick)] hover:opacity-90 ${FOCUS}`}
                >
                  {s.cta} <ArrowRight size={16} aria-hidden />
                </Link>
                {s.fact && <span className="font-mono text-[13px] font-[700] tracking-[0.02em] text-[var(--t1)]">{s.fact}</span>}
              </div>
              <Image
                src={`/illustrations/tines/${s.illo}.webp`}
                alt=""
                width={1328}
                height={1328}
                priority={i === 0}
                sizes="280px"
                className="pointer-events-none absolute right-8 top-1/2 hidden w-[240px] -translate-y-[58%] select-none rounded-[18px] md:block lg:w-[280px]"
              />
            </div>
          )
        })}
      </div>

      {/* 장 고르기 — 막대가 차면 다음 장 */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 px-4 pb-4 md:px-10 md:pb-6">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {slides.map((s, i) => {
            const active = i === index
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`${i + 1}번째 · ${s.label}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => go(i, 'dot')}
                className={`group relative flex min-h-[44px] shrink-0 flex-col justify-center rounded-full px-3 text-left ${FOCUS}`}
              >
                <span
                  className={`hidden font-display text-[13px] font-[700] md:block ${
                    active ? 'text-[var(--on-deep)]' : 'text-[color-mix(in_srgb,var(--on-deep)_70%,transparent)] group-hover:text-[var(--on-deep)]'
                  }`}
                >
                  {s.label}
                </span>
                <span className="mt-1 block h-[3px] w-10 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--on-deep)_32%,transparent)] md:w-16">
                  {active && (
                    <span
                      key={`${index}-${running}`}
                      className="block h-full origin-left rounded-full bg-[var(--on-deep)]"
                      style={
                        running
                          ? { animation: `hub-hero-fill ${DWELL_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }
                          : { transform: 'scaleX(1)' }
                      }
                      onAnimationEnd={() => go(index + 1)}
                    />
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {count > 1 && (
          <div className="flex shrink-0 items-center gap-1">
            <HeroButton label="이전 장" onClick={() => go(index - 1, 'arrow')}>
              <ChevronLeft size={18} aria-hidden />
            </HeroButton>
            <HeroButton label={held || reduced ? '자동 넘김 켜기' : '자동 넘김 멈추기'} onClick={() => (reduced ? setReduced(false) : setHeld((h) => !h))}>
              {held || reduced ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
            </HeroButton>
            <HeroButton label="다음 장" onClick={() => go(index + 1, 'arrow')}>
              <ChevronRight size={18} aria-hidden />
            </HeroButton>
          </div>
        )}
      </div>
    </section>
  )
}

function HeroButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--on-deep)_18%,transparent)] text-[var(--on-deep)] transition-colors duration-[var(--dur-quick)] hover:bg-[color-mix(in_srgb,var(--on-deep)_30%,transparent)] ${FOCUS}`}
    >
      {children}
    </button>
  )
}
