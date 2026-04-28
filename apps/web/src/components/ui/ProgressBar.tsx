// apps/web/src/components/ui/ProgressBar.tsx
// Vocaflow ProgressBar — Parts Kit v06 §Progress Bar 기준
// CLAUDE.md §🆕 추가 컴포넌트 §Progress Bar 완전 구현
// ───────────────────────────────────────────────────
// 선형 진행바 + 색상 변형 + 텍스트 표시
// 사용처: 학습 진행률, 게임 점수, 업로드 진행 등

"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export type ProgressColor = "primary" | "success" | "error" | "warning";
export type ProgressSize = "xs" | "sm" | "md" | "lg";

export interface ProgressBarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  /** 0 ~ max (기본 100) */
  value: number;
  max?: number;
  color?: ProgressColor;
  size?: ProgressSize;
  /** 상단에 "{current} / {total}" 표시 */
  showLabel?: boolean;
  /** 라벨 좌측 텍스트 */
  label?: string;
  /** "x / y" 대신 퍼센트 표시 */
  showPercent?: boolean;
  /** 줄무늬 애니메이션 (진행 중) */
  animated?: boolean;
}

// ══════════════════════════════════════════════════════════════
// Variants
// ══════════════════════════════════════════════════════════════
const colorStyles: Record<ProgressColor, string> = {
  primary: "bg-p",
  success: "bg-success",
  error: "bg-error",
  warning: "bg-warning",
};

const sizeStyles: Record<ProgressSize, string> = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

// ══════════════════════════════════════════════════════════════
// ProgressBar
// ══════════════════════════════════════════════════════════════
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      max = 100,
      color = "primary",
      size = "sm",
      showLabel = false,
      label,
      showPercent = false,
      animated = false,
      className,
      ...rest
    },
    ref,
  ) => {
    const clamped = Math.max(0, Math.min(value, max));
    const percent = max > 0 ? (clamped / max) * 100 : 0;

    return (
      <div ref={ref} className={cn("w-full", className)} {...rest}>
        {/* 라벨 영역 */}
        {showLabel && (
          <div className="flex items-baseline justify-between mb-s-2">
            <span className="font-body text-sm text-t2">
              {label ?? "진행률"}
            </span>
            <span className="font-mono text-sm text-t1 font-semibold">
              {showPercent
                ? `${Math.round(percent)}%`
                : `${clamped} / ${max}`}
            </span>
          </div>
        )}

        {/* 트랙 */}
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ?? "진행률"}
          className={cn(
            "w-full bg-bg3 rounded-full overflow-hidden",
            sizeStyles[size],
          )}
        >
          {/* 채워진 부분 */}
          <div
            className={cn(
              "h-full rounded-full",
              "transition-[width] duration-slow ease-out",
              colorStyles[color],
              animated && "animate-pulse",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  },
);

ProgressBar.displayName = "ProgressBar";
