// apps/web/src/components/marketing/sections/index.tsx
//
// 공개 화면 구간 부품(DD-68 · docs/design/tines-mapping.md §3 패턴). 참조 사이트의 구간 골격을 한 번만
// 만들고 소개 · 요금제 · 진단 · 서가가 같이 쓴다. 색·서체·모서리는 스킨 토큰에서 온다.
//   P2 Hero2Col · P4/P13 SectionHead · P5 PurplePanel · P6 ToneCards · P8 Bento · P9 Faq
// 전부 서버 컴포넌트다(펼침은 <details> — 스크립트 없이 열리고 초기 HTML 에 답이 남는다).

import Image from 'next/image'
import Link from 'next/link'

import { TINT_CLASS, TINT_ROTATION } from '@/lib/design/tone'

import { PILL } from '../pill'

const ILLO = '/illustrations/tines'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export const WRAP = 'mx-auto max-w-[1360px] px-4 lg:px-10'

/** 눈썹 라벨 — 참조는 영문 대문자 모노. 한글은 산세리프 굵게(pill.ts 주석과 같은 이유). */
export function Kicker({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-display text-[14px] font-[700] tracking-[0.04em] ${className}`}>{children}</p>
}

/** P13 · P4 — 눈썹 + 큰 제목 + 세리프 부제. `center` 면 선언문 모양. */
export function SectionHead({
  kicker,
  title,
  sub,
  center = false,
  serifTitle = false,
}: {
  kicker?: string
  title: React.ReactNode
  sub?: React.ReactNode
  center?: boolean
  serifTitle?: boolean
}) {
  return (
    <header className={center ? 'mx-auto max-w-[40rem] text-center' : 'max-w-[46rem]'}>
      {kicker && <Kicker className="text-[var(--ju)]">{kicker}</Kicker>}
      <h2
        className={`mt-5 break-keep text-[var(--t1)] ${
          serifTitle
            ? 'font-serif text-[34px] font-[700] leading-[1.12] tracking-[-0.02em] md:text-[48px]'
            : 'font-display text-[36px] font-[400] leading-[1.08] tracking-[-0.03em] md:text-[56px]'
        }`}
      >
        {title}
      </h2>
      {sub && <p className="mt-5 break-keep font-serif text-[19px] leading-[1.45] text-[var(--t2)] md:text-[24px]">{sub}</p>}
    </header>
  )
}

/** P2 — 2열 히어로: 왼쪽 눈썹·제목·부제·알약 CTA, 오른쪽 매체(그림·영상). */
export function Hero2Col({
  kicker,
  title,
  sub,
  ctas,
  media,
}: {
  kicker: string
  title: React.ReactNode
  sub: React.ReactNode
  ctas?: { href: string; label: string; primary?: boolean }[]
  media: React.ReactNode
}) {
  return (
    <section className={`${WRAP} grid items-center gap-10 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-12`}>
      <div>
        <Kicker className="text-[var(--ju)]">{kicker}</Kicker>
        <h1 className="mt-5 break-keep font-display text-[40px] font-[400] leading-[1.06] tracking-[-0.03em] text-[var(--t1)] md:text-[64px]">{title}</h1>
        <p className="mt-6 max-w-[40ch] break-keep font-serif text-[20px] leading-[1.4] text-[var(--t2)] md:text-[24px]">{sub}</p>
        {ctas && ctas.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {ctas.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={`${PILL} ${c.primary ? 'bg-[var(--ju)] text-[var(--on-ju)] hover:bg-[var(--p)]' : 'border border-[var(--ju)] text-[var(--ju)] hover:bg-[var(--bg3)]'}`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div>{media}</div>
    </section>
  )
}

/** 참조의 라벤더 이중 테두리 액자 — 영상·제품 화면을 담는다. */
export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-2xl)] border-2 border-[var(--bd)] bg-[var(--bg2)] p-2 md:p-3">
      <div className="overflow-hidden rounded-[18px] border border-[var(--bd)] bg-[var(--bg)] [&_figcaption]:px-4 [&_figcaption]:pb-3">{children}</div>
    </div>
  )
}

/** P5 — 보라 통판: 왼쪽 흰 큰 제목, 오른쪽 2열 세리프 항목, 아래 꽃밭. */
export function PurplePanel({
  kicker,
  title,
  items,
  cta,
}: {
  kicker: string
  title: React.ReactNode
  items: { title: string; body: string; note?: string }[]
  cta?: { href: string; label: string }
}) {
  return (
    <section className={WRAP}>
      <div className="relative overflow-hidden rounded-[var(--r-2xl)] bg-[var(--ju)] text-[var(--on-ju)] lg:min-h-[760px]">
        <div className="relative z-10 grid gap-12 px-6 pb-[34vw] pt-12 md:px-14 md:pt-14 lg:grid-cols-[1fr_1.1fr] lg:pb-16">
          <div>
            <Kicker>{kicker}</Kicker>
            <h2 className="mt-8 break-keep font-display text-[36px] font-[400] leading-[1.1] tracking-[-0.03em] md:text-[52px]">{title}</h2>
          </div>
          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {items.map((d) => (
              <article key={d.title}>
                <h3 className="break-keep font-serif text-[24px] font-[700] leading-[1.15] tracking-[-0.01em]">{d.title}</h3>
                <p className="mt-3 break-keep font-body text-[15px] leading-[1.6]">{d.body}</p>
                {d.note && <p className="mt-3 font-body text-[12.5px] leading-snug opacity-90">{d.note}</p>}
              </article>
            ))}
            {cta && (
              <div className="flex items-end">
                <Link href={cta.href} className={`${PILL} bg-[var(--on-ju)] text-[var(--ju)] hover:bg-[var(--bg3)]`}>{cta.label}</Link>
              </div>
            )}
          </div>
        </div>
        <Image
          src={`${ILLO}/bed-flowers.webp`}
          alt=""
          width={1664}
          height={928}
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="pointer-events-none absolute bottom-0 left-0 w-full select-none [mask-image:linear-gradient(to_right,black_78%,transparent)] lg:w-[52%]"
        />
      </div>
    </section>
  )
}

export type Tone = 'success' | 'ju' | 'info' | 'warning' | 'p'
// 진한 면 톤 — 위 글자는 크림(globals.css `.tone-deep-*`, tines-mapping §13-1)
const TONE_CLASS: Record<Tone, string> = { success: 'tone-deep-green', ju: 'tone-deep-magenta', info: 'tone-deep-ink', warning: 'tone-deep-orange', p: 'tone-deep-purple' }

/** P6 — 색면 카드 줄(참조 팀 탭 자리). 카드마다 제목 · 한 줄 · 구석 소품. 링크면 카드 전체가 누르는 자리. */
export function ToneCards({ items, columns = 5 }: { items: { title: string; body: string; tone: Tone; illo?: string; href?: string }[]; columns?: 3 | 4 | 5 }) {
  const cols = columns === 5 ? 'lg:grid-cols-5' : columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
  return (
    <ul className={`grid overflow-hidden rounded-[var(--r-xl)] sm:grid-cols-2 ${cols}`}>
      {items.map((m) => {
        const body = (
          <>
            <h3 className="break-keep font-serif text-[26px] font-[400] leading-[1.15]">{m.title}</h3>
            <p className="mt-3 break-keep font-body text-[15px] font-[500] leading-[1.45]">{m.body}</p>
            {m.illo && <Image src={`${ILLO}/${m.illo}.webp`} alt="" width={1328} height={1328} className="mt-auto w-[128px] self-end" />}
          </>
        )
        return (
          <li key={m.title} className={`${TONE_CLASS[m.tone]} flex text-[var(--t1)]`}>
            {m.href ? (
              <Link href={m.href} className={`flex min-h-[320px] w-full flex-col p-7 transition-[filter] duration-[var(--dur-quick)] hover:brightness-110 ${FOCUS}`}>{body}</Link>
            ) : (
              <div className="flex min-h-[320px] w-full flex-col p-7">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** P8 — 벤토: 크기가 다른 칸. `span` 2 = 두 칸 폭. 칸마다 번호 · 제목 · 문장 · (그림). */
/** 칸마다 면 톤을 돌린다(`lib/design/tone.ts` TINT_ROTATION) — 면 안 글자는 그 색상의 짙은 글자가 된다(§13-1). */

export function Bento({ cells }: { cells: { kicker?: string; title: string; body: string; span?: 1 | 2; illo?: string; media?: React.ReactNode }[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cells.map((c, i) => (
        <li
          key={c.title}
          className={`${TINT_CLASS[TINT_ROTATION[i % TINT_ROTATION.length]]} relative flex min-h-[240px] flex-col overflow-hidden rounded-[var(--r-xl)] p-6 text-[var(--t1)] ${c.span === 2 ? 'lg:col-span-2' : ''}`}
        >
          {c.kicker && <p className="font-mono text-[12px] font-[700] uppercase tracking-[0.05em]">{c.kicker}</p>}
          <h3 className="mt-2 break-keep font-serif text-[22px] font-[700] leading-[1.2]">{c.title}</h3>
          <p className="mt-2 max-w-[42ch] break-keep font-body text-[15px] leading-[1.55]">{c.body}</p>
          {c.media && <div className="mt-4">{c.media}</div>}
          {c.illo && <Image src={`${ILLO}/${c.illo}.webp`} alt="" width={1328} height={1328} className="mt-auto w-[112px] self-end" />}
        </li>
      ))}
    </ul>
  )
}

/** P9 — FAQ 펼침. `<details>` 라 스크립트 없이 열리고 답이 초기 HTML 에 남는다. */
export function Faq({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="self-start divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className={`flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-4 font-serif text-[20px] font-[700] text-[var(--ju)] [&::-webkit-details-marker]:hidden ${FOCUS}`}>
            {it.q}
            <span aria-hidden className="text-[26px] font-[400] leading-none transition-transform duration-[var(--dur-quick)] group-open:rotate-45">+</span>
          </summary>
          <div className="max-w-[64ch] break-keep pb-6 font-body text-[16px] leading-[1.65] text-[var(--ju)]">{it.a}</div>
        </details>
      ))}
    </div>
  )
}
