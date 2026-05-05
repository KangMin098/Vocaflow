// apps/web/src/components/ui/MemoryBadge.tsx
//
// Memory Decay 4색 배지 — CLAUDE.md §17.2 [2] 상태 축
//
// 색 토큰: globals.css 68~71 (--memory-stable / --memory-shaky / --memory-risk / --memory-new)
// 상태 유도: srs ? getMemoryState(srs) : 'new'  — DB 미연동/신규 단어는 'new'로 안전 분기
// 라벨: 격려형만 사용 — 정확도/실패 카운트 노출 금지 (§17 안티패턴 5)
// FSRS 변수(D/S/R) 직접 노출 금지 (§17 안티패턴 2)

'use client';

import { getMemoryState } from '@/lib/srs';
import type { MemoryState, SrsCard } from '@/lib/srs';
import { cn } from '@/lib/utils/cn';

export interface MemoryBadgeProps {
  /** SRS 카드 — undefined이면 'new' 처리 */
  srs?: SrsCard;
  /** 배지 크기 (default: 'sm') */
  size?: 'xs' | 'sm' | 'md';
  /** title 툴팁 표시 여부 (default: true) */
  showTooltip?: boolean;
  className?: string;
}

const STATE_CONFIG: Record<MemoryState, { cssVar: string; label: string }> = {
  stable: { cssVar: 'var(--memory-stable)', label: '잘 알고 있어요' },
  shaky: { cssVar: 'var(--memory-shaky)', label: '익숙해지는 중' },
  risk: { cssVar: 'var(--memory-risk)', label: '다시 만나봐요' },
  new: { cssVar: 'var(--memory-new)', label: '처음 만나는 단어' },
};

const SIZE_CLASS: Record<NonNullable<MemoryBadgeProps['size']>, string> = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
};

export function MemoryBadge({
  srs,
  size = 'sm',
  showTooltip = true,
  className,
}: MemoryBadgeProps) {
  const state: MemoryState = srs ? getMemoryState(srs) : 'new';
  const config = STATE_CONFIG[state];

  return (
    <span
      className={cn(
        'inline-block rounded-full flex-shrink-0',
        SIZE_CLASS[size],
        className,
      )}
      style={{ backgroundColor: config.cssVar }}
      title={showTooltip ? config.label : undefined}
      aria-label={config.label}
      role="img"
    />
  );
}

/** 색 점 + 격려형 텍스트 — WordRow 상세 펼침 등 폼 안내용 */
export function MemoryLabel({ srs, className }: { srs?: SrsCard; className?: string }) {
  const state: MemoryState = srs ? getMemoryState(srs) : 'new';
  const config = STATE_CONFIG[state];

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs', className)}
      style={{ color: config.cssVar }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: config.cssVar }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
