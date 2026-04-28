// apps/web/src/components/ui/EmptyState.tsx
// Vocaflow EmptyState — 빈 상태 UI
// 보너스 컴포넌트 (CLAUDE.md 명시 없음 → 상업 서비스 표준 패턴)
// ───────────────────────────────────────────────────
// 사용처: 단어장 비어있을 때, 검색 결과 없을 때, 학습 기록 없을 때

"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  /** 큰 아이콘 또는 일러스트 (Lucide icon 권장 size 48~64) */
  icon?: ReactNode;
  /** 메인 타이틀 */
  title: ReactNode;
  /** 설명 문구 */
  description?: ReactNode;
  /** 액션 버튼/링크 */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "px-s-6 py-s-12",
        "min-h-[280px]",
        className,
      )}
    >
      {/* 아이콘 영역 */}
      {icon && (
        <div
          className={cn(
            "w-16 h-16 rounded-full mb-s-4",
            "bg-bg3 text-t3",
            "flex items-center justify-center",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {/* 타이틀 */}
      <h3 className="font-display text-lg font-bold text-t1 mb-s-2">
        {title}
      </h3>

      {/* 설명 */}
      {description && (
        <p className="font-body text-sm text-t2 max-w-sm mb-s-6">
          {description}
        </p>
      )}

      {/* 액션 */}
      {action && <div className="flex items-center gap-s-3">{action}</div>}
    </div>
  );
}
