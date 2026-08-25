// apps/web/src/components/ui/ios/StatPill.tsx
//
// iOS Health Categories 스타일 통계 셀.
// 라벨 + 큰 숫자 + 단위. 그리드 안에 일렬로 배치하여 한 화면에 KPI 요약.

import { cn } from '@/lib/utils/cn'

export interface StatPillProps {
  label: string
  value: string | number
  unit?: string
  /** 큰 숫자 색상. default t1, 옵션으로 iOS 컬러 사용 */
  accent?: 'neutral' | 'brand' | 'green' | 'orange' | 'red' | 'purple' | 'blue'
  /** dot indicator (왼쪽). 빠지면 미표시 */
  dotColor?: string
  /** 보조 비율 텍스트 (값 옆 작게) */
  ratio?: string
  className?: string
}

const ACCENT_COLORS: Record<NonNullable<StatPillProps['accent']>, string> = {
  // 값(숫자)은 --bg3 위에 얹히는 **글자**다 — iOS 원색은 여기서 1.7~2.0:1 로 AA 미달이었다
  //   (2026-08-09 axe 실측: green 1.78 · orange 1.76). 점(dotColor)은 원색, 숫자는 잉크.
  neutral: 'var(--t1)',
  brand: 'var(--on-p-tint)',
  green: 'var(--ios-green-ink)',
  orange: 'var(--ios-orange-ink)',
  red: 'var(--ios-red-ink)',
  purple: 'var(--ios-purple-ink)',
  blue: 'var(--ios-blue-ink)',
}

export function StatPill({
  label,
  value,
  unit,
  accent = 'neutral',
  dotColor,
  ratio,
  className,
}: StatPillProps) {
  const valueColor = ACCENT_COLORS[accent]

  return (
    <div
      className={cn(
        // 다크 정합 — 카드 내부 칩 배경 = --bg3 (tertiarySystemFill)
        'flex flex-col gap-2 rounded-ios-xl bg-[var(--bg3)] p-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {dotColor && (
          <span
            aria-hidden
            className="h-[8px] w-[8px] shrink-0 rounded-full"
            style={{
              backgroundColor: dotColor,
              boxShadow: `0 0 0 3px ${dotColor}22`,
            }}
          />
        )}
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t2)]">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-display text-[22px] font-[800] leading-none tracking-[-0.025em] tabular-nums"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[11px] text-[var(--t2)]">{unit}</span>
        )}
        {ratio && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
            {ratio}
          </span>
        )}
      </div>
    </div>
  )
}
