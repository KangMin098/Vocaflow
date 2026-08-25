// apps/web/src/components/ui/ios/Frame.tsx
//
// Card + iOS section header pattern.
// HIG: Title (large, font-display, tight tracking) + 선택 meta (캡션) + "More →" 링크.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

import { Card } from './Card'
import type { CardProps } from './Card'

export interface FrameProps extends Omit<CardProps, 'children'> {
  title: string
  /** 작은 보조 텍스트 (캡션). 카운트, 기준 등 */
  meta?: string
  /** 우측 More 링크 (iOS Section header 패턴) */
  moreHref?: string
  moreLabel?: string
  /** 헤더 우측에 임의 노드 (배지 등). moreHref와 동시 사용 가능 */
  headerRight?: ReactNode
  children?: ReactNode
}

export function Frame({
  title,
  meta,
  moreHref,
  moreLabel = '더보기',
  headerRight,
  size = 'lg',
  elevation = 2,
  className,
  children,
  ...rest
}: FrameProps) {
  return (
    // ⚠️ **이름 없는 `<section>` 은 랜드마크가 아니다.** `Card` 는 기본으로 `<section>` 을
    //    그리는데 이름이 없으면 스크린리더가 그것을 영역으로 노출하지 않아, Frame 으로 만든
    //    화면 전체가 "구획 없는 한 덩어리" 로 읽힌다. 제목이 이미 있으므로 그것을 이름으로 쓴다.
    //
    //    같은 컴포넌트가 같은 `title` prop 을 두 곳에 쓰는 것이라 **문구가 갈릴 수 없다**
    //    (이 리포가 경계하는 "이름을 화면마다 각자 정하기" 와는 다른 경우다).
    //    호출부가 직접 `aria-label` 을 줬으면 그것을 우선한다.
    //
    //    부수 효과: 캡처 하네스의 지면 배분 계측(`blocks`)이 `section[aria-label]` 을 세므로,
    //    Frame 으로 만든 화면이 그제서야 측정 대상이 된다 — `/wordvault` 는 본문의 13% 만
    //    이름이 있어 **배분을 잴 수 없었다**(실측 2026-08-17).
    <Card
      size={size}
      elevation={elevation}
      className={className}
      aria-label={title}
      {...rest}
    >
      {/* Section Header v06.40 — 22px font-[600] (Linear/Things 3 정밀) + 호흡 강화 */}
      <header className="mb-6 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-[22px] font-[600] tracking-[-0.022em] leading-[1.1] text-[var(--t1)]">
            {title}
          </h2>
          {meta && (
            <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
              {meta}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerRight}
          {moreHref && (
            <Link
              href={moreHref}
              className={cn(
                // 실측 2026-08-25: '더보기' 가 58×21 이었다. 이 링크는 Frame 을 쓰는
                // 모든 화면 헤더에 뜬다 — 한 곳을 고치면 전부 따라온다.
                'inline-flex min-h-11 min-w-11 items-center justify-end gap-0.5 font-display text-[14px] font-[600] text-[var(--p)]',
                'transition-colors duration-[var(--dur-ios-fast)] hover:text-[var(--p-hover)]',
              )}
            >
              {moreLabel}
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      </header>
      {children}
    </Card>
  )
}
