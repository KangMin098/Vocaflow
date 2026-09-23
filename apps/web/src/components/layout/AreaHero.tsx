// apps/web/src/components/layout/AreaHero.tsx
//
// 앱 구역 머리(DD-68 · tines-mapping §8 · §13 · §24) — 참조 도서관 머리(「What will you build?」)를 앱 안 크기로:
// **진한 면 둥근 판** 한 장 안에 왼쪽 눈썹 · 큰 제목 · 부제 · 수치 알약, 오른쪽 타일, 그리고 판 **아랫변에 붙은
// 폴더 탭**(참조 Featured · All stories 1213). 고른 탭은 화면 바탕색(--bg2 · `Screen background="bg2"`)이라 판 밖 본문과 이어져 보인다.
// 판 색은 구역의 범주 색(`tint` → `DEEP_OF`)을 따른다 — 같은 자료는 어느 화면에서나 같은 색.
// 서버 컴포넌트 — 삽화는 장식(alt="")이고, 제목·수치는 서버 HTML 에 남는다.
//
// ⚠️ **390px 에서는 타일을 숨긴다.** 참조는 모바일에서도 큰 그림을 싣지만 우리 서가는 매대다 —
//    실측 2026-09-01(단어장 390px): 머리가 309px 을 먹어 첫 상품이 y=913(1.08화면)이라 첫 화면 상품이 0개였다
//    (같은 자로 잰 시중 단어장 앱은 0.29화면 · 3개). 그림은 sm 이상에서만 선다.

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'

import { DEEP_CLASS, type Deep, type Tint } from '@/lib/design/tone'

/** 면 색 — 구역의 범주 색(`lib/design/tone.ts` MATERIAL_TONE · MODULE_TONE)을 넘긴다. */
export type AreaTint = Tint

export type AreaStat = { label: string; value: string }

/** 판 아랫변 폴더 탭 — 같은 화면의 보기 전환(링크). 고른 탭은 `active`. */
export type AreaTab = { href: string; label: string; count?: string; active?: boolean }

/** 옅은 범주 색 → 같은 계열 진한 판(참조 도서관 머리는 진한 면이다). */
const DEEP_OF: Record<Tint, Deep> = {
  lavender: 'purple',
  green: 'green',
  peach: 'orange',
  yellow: 'orange',
  pink: 'magenta',
  teal: 'charcoal',
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-deep)]'

export function AreaHero({
  kicker,
  title,
  sub,
  stats,
  tile,
  tint = 'lavender',
  deep,
  tabs,
  children,
}: {
  kicker: string
  title: React.ReactNode
  sub: React.ReactNode
  stats?: AreaStat[]
  /**
   * `/illustrations/tines/<tile>.webp` — 1328² 진한 면 타일(바탕이 그림의 일부).
   * 참조 히어로 그림은 오른쪽(43%) · 대부분 진한 단색 정사각 타일이다(tines-mapping §13-2).
   */
  tile: string
  /** 구역의 범주 색 — 판 색은 이 계열의 진한 면 */
  tint?: AreaTint
  /** 판 색을 직접 고를 때(기본은 `tint` 의 진한 계열) */
  deep?: Deep
  /** 판 아랫변 폴더 탭 */
  tabs?: AreaTab[]
  /** 수치 아래 자리(알약 CTA 등) */
  children?: React.ReactNode
}) {
  const hasTabs = !!tabs && tabs.length > 0
  return (
    <header className={`${DEEP_CLASS[deep ?? DEEP_OF[tint]]} relative overflow-hidden rounded-[var(--r-2xl)] px-6 pt-8 text-[var(--t1)] md:px-12 md:pt-10 ${hasTabs ? '' : 'pb-8 md:pb-10'}`}>
      <div className="grid items-center gap-6 md:grid-cols-[1fr_auto] md:gap-10">
        <div className="flex flex-col justify-center py-2">
          {/* 모노는 한글이 없어 공백만 모노 폭이 된다(pill.ts) — 눈썹은 산세리프 굵게 */}
          <p className="font-display text-[13px] font-[700] uppercase tracking-[0.05em]">{kicker}</p>
          <h1 className="mt-3 break-keep font-display text-[28px] font-[500] leading-[1.04] tracking-[-0.03em] sm:text-[38px] md:text-[52px]">{title}</h1>
          <p className="mt-3 max-w-[40ch] break-keep font-display text-[15.5px] font-[500] leading-[1.45] md:text-[17px]">{sub}</p>
          {stats && stats.length > 0 && (
            <dl className="mt-6 flex flex-wrap gap-2">
              {stats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-2 rounded-[50px] bg-[color-mix(in_srgb,var(--on-deep)_14%,transparent)] px-4 py-2">
                  <dt className="font-display text-[13px] font-[600]">{s.label}</dt>
                  <dd className="font-mono text-[15px] font-[700] tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {children && <div className="mt-6">{children}</div>}
        </div>
        {/* 구역 타일이 숨을 쉰다(globals.css §4.5 `.vf-float` · tines-mapping §29).
            판 자체는 가만히 둔다 — 제목·수치를 읽는 면이라 움직이면 읽기를 방해한다. */}
        <Image
          src={`/illustrations/tines/${tile}.webp`}
          alt=""
          width={1328}
          height={1328}
          priority
          sizes="(min-width: 768px) 240px, 50vw"
          className="vf-float hidden w-[50%] max-w-[240px] select-none justify-self-end rounded-[var(--r-xl)] sm:block md:w-[210px] lg:w-[240px]"
          style={{ '--float-dur': '5s', '--float-y': '5%' } as CSSProperties}
        />
      </div>
      {hasTabs && (
        <nav aria-label="보기" className="mt-6 flex flex-wrap items-end gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? 'page' : undefined}
              data-shape="keep"
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-t-[10px] px-5 font-display text-[14px] font-[600] transition-colors duration-[var(--dur-quick)] ${FOCUS} ${
                t.active
                  ? 'bg-[var(--bg2)] text-[var(--on-ju)]'
                  : 'bg-[color-mix(in_srgb,var(--on-deep)_16%,transparent)] hover:bg-[color-mix(in_srgb,var(--on-deep)_26%,transparent)]'
              }`}
            >
              {t.label}
              {t.count && (
                <span className={`rounded-full px-2 py-0.5 font-mono text-[11.5px] font-[700] tabular-nums ${t.active ? 'bg-[color-mix(in_srgb,var(--on-ju)_12%,transparent)]' : 'bg-[color-mix(in_srgb,var(--on-deep)_20%,transparent)]'}`}>
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
