// apps/web/src/components/layout/AreaHero.tsx
//
// 앱 구역 머리(DD-68 · tines-mapping §8 · §13) — 참조 도서관 · 솔루션 페이지의 2열 머리를
// 앱 안 크기로 줄였다: 왼쪽 눈썹 · 큰 제목 · 세리프 부제 · 수치 알약, 오른쪽 **진한 면 정사각 타일**.
// 마케팅 `Hero2Col` 과 달리 앱 셸 안(사이드바 옆 폭)에 들어가므로 제목 56px 상한 · 면 높이 고정.
// 서버 컴포넌트 — 삽화는 장식(alt="")이고, 제목·수치는 서버 HTML 에 남는다.

import Image from 'next/image'


import { TINT_CLASS, type Tint } from '@/lib/design/tone'

/** 면 색 — 구역의 범주 색(`lib/design/tone.ts` MATERIAL_TONE · MODULE_TONE)을 넘긴다. */
export type AreaTint = Tint

export type AreaStat = { label: string; value: string }

export function AreaHero({
  kicker,
  title,
  sub,
  stats,
  tile,
  tint = 'lavender',
  children,
}: {
  kicker: string
  title: React.ReactNode
  sub: React.ReactNode
  stats?: AreaStat[]
  /**
   * `/illustrations/tines/<tile>.webp` — 1328² 진한 면 타일(바탕이 그림의 일부).
   * 참조 히어로 그림은 오른쪽(43%) · 중앙 457×319 · 대부분 진한 단색 정사각 타일이다(tines-mapping §13-2).
   */
  tile: string
  /** 수치 알약의 면 — 구역의 범주 색 */
  tint?: AreaTint
  /** 수치 아래 자리(알약 CTA 등) */
  children?: React.ReactNode
}) {
  return (
    <header className="grid items-center gap-6 md:grid-cols-[1fr_auto] md:gap-10">
      <div className="flex flex-col justify-center py-2">
        <p className="font-display text-[14px] font-[700] tracking-[0.04em] text-[var(--ju)]">{kicker}</p>
        <h1 className="mt-4 break-keep font-display text-[40px] font-[400] leading-[1.04] tracking-[-0.03em] text-[var(--t1)] md:text-[56px]">
          {title}
        </h1>
        <p className="mt-4 max-w-[36ch] break-keep font-serif text-[18px] leading-[1.45] text-[var(--t2)] md:text-[21px]">{sub}</p>
        {stats && stats.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-2">
            {stats.map((s) => (
              <div key={s.label} className={`flex items-baseline gap-2 rounded-[50px] px-4 py-2 ${TINT_CLASS[tint]}`}>
                <dt className="font-display text-[13px] font-[600] text-[var(--t2)]">{s.label}</dt>
                <dd className="font-mono text-[15px] font-[700] tabular-nums text-[var(--t1)]">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
      <Image
        src={`/illustrations/tines/${tile}.webp`}
        alt=""
        width={1328}
        height={1328}
        priority
        sizes="(min-width: 768px) 300px, 60vw"
        className="w-[60%] max-w-[300px] select-none justify-self-end rounded-[var(--r-2xl)] md:w-[260px] lg:w-[300px]"
      />
    </header>
  )
}
