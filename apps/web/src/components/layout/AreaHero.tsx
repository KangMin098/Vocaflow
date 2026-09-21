// apps/web/src/components/layout/AreaHero.tsx
//
// 앱 구역 머리(DD-68 · tines-mapping §8 서가 · 만화 · 수능 · 교사) — 참조 도서관 · 솔루션 페이지의 2열 머리를
// 앱 안 크기로 줄였다: 왼쪽 눈썹 · 큰 제목 · 세리프 부제 · 수치 알약, 오른쪽 **틴트 면 위 장면 삽화**.
// 마케팅 `Hero2Col` 과 달리 앱 셸 안(사이드바 옆 폭)에 들어가므로 제목 56px 상한 · 면 높이 고정.
// 서버 컴포넌트 — 삽화는 장식(alt="")이고, 제목·수치는 서버 HTML 에 남는다.

import Image from 'next/image'

export type AreaTint = 'lavender' | 'green' | 'peach' | 'yellow' | 'pink' | 'teal'

// 글자 그대로 적는다(Tailwind 는 조립한 클래스를 만들지 않는다).
const TINT_BG: Record<AreaTint, string> = {
  lavender: 'bg-[var(--tint-lavender)]',
  green: 'bg-[var(--tint-green)]',
  peach: 'bg-[var(--tint-peach)]',
  yellow: 'bg-[var(--tint-yellow)]',
  pink: 'bg-[var(--tint-pink)]',
  teal: 'bg-[var(--tint-teal)]',
}

export type AreaStat = { label: string; value: string }

export function AreaHero({
  kicker,
  title,
  sub,
  stats,
  scene,
  tint = 'lavender',
  fit = 'contain',
  children,
}: {
  kicker: string
  title: React.ReactNode
  sub: React.ReactNode
  stats?: AreaStat[]
  /** `/illustrations/tines/<scene>.webp` — 1664×928 장면 */
  scene: string
  tint?: AreaTint
  /**
   * contain — 배경을 걷어 낸 장면(서가 · 만화): 면 아래에 얹는다.
   * cover — 가장자리까지 그린 액자형 장면(교실): 면을 채운다. 걷어 낼 배경이 없어 contain 이면 위가 빈다.
   */
  fit?: 'contain' | 'cover'
  /** 수치 아래 자리(알약 CTA 등) */
  children?: React.ReactNode
}) {
  return (
    <header className="grid items-stretch gap-6 md:grid-cols-[1.1fr_1fr] md:gap-8">
      <div className="flex flex-col justify-center py-2">
        <p className="font-display text-[14px] font-[700] tracking-[0.04em] text-[var(--ju)]">{kicker}</p>
        <h1 className="mt-4 break-keep font-display text-[40px] font-[400] leading-[1.04] tracking-[-0.03em] text-[var(--t1)] md:text-[56px]">
          {title}
        </h1>
        <p className="mt-4 max-w-[36ch] break-keep font-serif text-[18px] leading-[1.45] text-[var(--t2)] md:text-[21px]">{sub}</p>
        {stats && stats.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-2">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2 rounded-[50px] bg-[var(--tint-lavender)] px-4 py-2">
                <dt className="font-display text-[13px] font-[600] text-[var(--t2)]">{s.label}</dt>
                <dd className="font-mono text-[15px] font-[700] tabular-nums text-[var(--t1)]">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
      <div className={`relative flex min-h-[200px] items-end justify-center overflow-hidden rounded-[var(--r-2xl)] ${TINT_BG[tint]} md:min-h-[300px]`}>
        {fit === 'cover' ? (
          <Image
            src={`/illustrations/tines/${scene}.webp`}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 520px, 100vw"
            className="select-none object-cover"
          />
        ) : (
          <Image
            src={`/illustrations/tines/${scene}.webp`}
            alt=""
            width={1664}
            height={928}
            priority
            sizes="(min-width: 768px) 520px, 100vw"
            className="h-auto w-[112%] max-w-none select-none"
          />
        )}
      </div>
    </header>
  )
}
