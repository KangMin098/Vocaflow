// apps/web/src/components/ui/LoadingOverlay.tsx
// Vocaflow LoadingOverlay — Parts Kit v06 §Loading Overlay 기준
// CLAUDE.md §🆕 추가 컴포넌트 §Loading Overlay 완전 구현
// ───────────────────────────────────────────────────
// 전체 화면 로딩 (AI 분석 등 비동기 작업 중)
// 배경: rgba(15,23,42,0.5) + backdrop-blur(4px)

"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

export interface LoadingOverlayProps {
  isOpen: boolean;
  /** 메인 메시지 */
  message?: ReactNode;
  /** 보조 설명 */
  description?: ReactNode;
  /** 진행률 (0~100, 제공 시 진행바 표시) */
  progress?: number;
  /** 인라인 모드 (전체 화면 대신 부모 기준 절대 위치) */
  inline?: boolean;
}

export function LoadingOverlay({
  isOpen,
  message = "처리 중입니다...",
  description,
  progress,
  inline = false,
}: LoadingOverlayProps) {
  if (!isOpen) return null;
  if (typeof window === "undefined") return null;

  const overlay = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        inline ? "absolute" : "fixed",
        "inset-0 z-[200]",
        "flex items-center justify-center",
        "bg-[rgba(15,23,42,0.5)] backdrop-blur-[4px]",
        "animate-[fadeIn_200ms_ease-out]",
      )}
    >
      <div
        className={cn(
          "bg-bg rounded-xl px-s-12 py-s-10",
          "shadow-[0_12px_40px_rgba(0,0,0,0.12)]",
          "flex flex-col items-center gap-s-4",
          "max-w-sm mx-s-4",
        )}
      >
        {/* 스피너 */}
        <div
          className={cn(
            "w-10 h-10 rounded-full",
            "border-[3px] border-bg3",
            "border-t-p",
            "animate-spin",
          )}
          aria-hidden="true"
        />

        {/* 메시지 */}
        {message && (
          <p className="font-display font-semibold text-base text-t1 text-center">
            {message}
          </p>
        )}

        {description && (
          <p className="font-body text-sm text-t2 text-center">{description}</p>
        )}

        {/* 진행률 (선택) */}
        {typeof progress === "number" && (
          <div className="w-full mt-s-2">
            <div className="w-full h-1.5 bg-bg3 rounded-full overflow-hidden">
              <div
                className="h-full bg-p rounded-full transition-[width] duration-slow ease-out"
                style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
              />
            </div>
            <p className="font-mono text-xs text-t3 text-center mt-s-1">
              {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );

  return inline ? overlay : createPortal(overlay, document.body);
}
