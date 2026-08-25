// apps/web/src/components/ui/ios/SegmentControl.tsx
//
// iOS Segment Control — 캡슐 세그먼트 (UISegmentedControl).
// 활성 세그먼트: 흰 캡슐 + soft shadow (iOS 13+ rounded style).
// 컨테이너: bg-bg2 또는 bg-ios-gray-6.

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export interface SegmentItem<TKey extends string = string> {
  key: TKey
  label: string
  /** 선택형 lucide 아이콘 (왼쪽) */
  icon?: LucideIcon
  /** 카운트 배지 (오른쪽) */
  count?: number
  /** Link 모드일 때 사용. 빠지면 button 모드 */
  href?: string
}

export interface SegmentControlProps<TKey extends string = string> {
  items: ReadonlyArray<SegmentItem<TKey>>
  /** 활성 segment key. controlled */
  active: TKey
  /** button 모드 — items[i].href 없을 때 사용 */
  onChange?: (key: TKey) => void
  /** aria-label */
  ariaLabel?: string
  /** 컨테이너 가로 폭 채우기 */
  block?: boolean
  /** 컨테이너 bg. default bg2 */
  containerBg?: 'bg2' | 'bg3' | 'ios-gray-6'
  className?: string
}

export function SegmentControl<TKey extends string>({
  items,
  active,
  onChange,
  ariaLabel,
  block = false,
  containerBg = 'bg2',
  className,
}: SegmentControlProps<TKey>) {
  const bgClass =
    containerBg === 'bg2'
      ? 'bg-[var(--bg2)]'
      : containerBg === 'bg3'
        ? 'bg-[var(--bg3)]'
        : 'bg-ios-gray-6'

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-ios-pill p-[3px]',
        block && 'flex w-full',
        bgClass,
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active
        const Icon = item.icon
        const innerClass = cn(
          'flex items-center justify-center gap-2 rounded-ios-pill font-display text-[13px] font-[600] no-underline',
          'transition-all duration-[var(--dur-ios-fast)] ease-ios-standard',
          // ⚠️ `py-[6px]` 이라 실측 31px 이었다(기준 44px). 공용 컴포넌트라
          //    `/wordvault`·`/my/words` 등 이 막대를 쓰는 화면이 전부 걸린다.
          //    **프로덕션 빌드로 재기 전까지는 안 보였다** — dev 에서는 이 목록이 덜 렌더됐다
          //    (실측 2026-08-23: 같은 스윕이 dev 53건/6화면 → prod 83건/9화면).
          //    알약의 시각 높이는 iOS 세그먼트의 정체성이라 그대로 두고,
          //    **누르는 높이만** 44px 로 올린다(세로 가운데 정렬이라 알약은 그대로 보인다).
          // ⚠️ 세로만 44 로 맞추면 안 된다 — 짧은 라벨('허브'·'학습'·'복습')은 **폭이 43px**
          //    이었다(실측 2026-08-25). 기준은 44×44 다.
          'min-h-11 min-w-11 px-3.5 py-[6px]',
          block && 'flex-1',
          isActive
            ? 'bg-[var(--bg)] text-[var(--t1)] shadow-ios-button'
            : 'text-[var(--t2)] hover:text-[var(--t2)]',
        )
        const inner = (
          <>
            {Icon && <Icon size={14} className="opacity-80" aria-hidden />}
            <span>{item.label}</span>
            {item.count != null && (
              <span
                className={cn(
                  'rounded-ios-pill px-2 py-px font-mono text-[10px] tabular-nums',
                  isActive ? 'bg-[var(--bg2)] text-[var(--t2)]' : 'text-[var(--t2)]',
                )}
              >
                {item.count}
              </span>
            )}
          </>
        )

        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={innerClass}
            >
              {inner}
            </Link>
          )
        }
        return (
          <button
            key={item.key}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange?.(item.key)}
            className={innerClass}
          >
            {inner}
          </button>
        )
      })}
    </nav>
  )
}
