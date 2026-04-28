// apps/web/src/components/ui/Skeleton.tsx
// Vocaflow Skeleton — 로딩 플레이스홀더
// CLAUDE.md v06.2 토큰 기반 (§15 개선사항: Skeleton/Spinner/Progress)
// ───────────────────────────────────────────────────
// 데이터 로딩 중 콘텐츠 자리 차지하는 회색 박스
// 사용처: 단어장 로딩, 대시보드 로딩 등

"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "rect" | "circle" | "text";
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant = "rect", className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          "bg-bg3 animate-pulse",
          variant === "rect" && "rounded-md",
          variant === "circle" && "rounded-full",
          variant === "text" && "rounded h-4",
          className,
        )}
        {...rest}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";

// ══════════════════════════════════════════════════════════════
// 미리 만들어진 패턴 (자주 쓰는 조합)
// ══════════════════════════════════════════════════════════════

/** 카드 형태 스켈레톤 */
export function SkeletonCard() {
  return (
    <div className="bg-bg2 border border-bd rounded-lg p-s-6 space-y-s-3">
      <Skeleton variant="text" className="w-1/3" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
  );
}

/** 행 형태 (아바타 + 텍스트 2줄) */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-s-3 p-s-3">
      <Skeleton variant="circle" className="w-10 h-10 shrink-0" />
      <div className="flex-1 space-y-s-2">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="text" className="w-2/3" />
      </div>
    </div>
  );
}

/** 단어 리스트 (WordVault 로딩용) */
export function SkeletonWordList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-s-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[44px_1fr_auto_1fr_44px] items-center gap-s-3 p-s-3 bg-bg2 rounded-md"
        >
          <Skeleton variant="circle" className="w-6 h-6 mx-auto" />
          <Skeleton variant="text" className="h-5" />
          <Skeleton className="h-5 w-12" />
          <Skeleton variant="text" className="h-4" />
          <Skeleton variant="circle" className="w-8 h-8 mx-auto" />
        </div>
      ))}
    </div>
  );
}
