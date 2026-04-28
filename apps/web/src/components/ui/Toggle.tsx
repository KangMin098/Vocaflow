// apps/web/src/components/ui/Toggle.tsx
// Vocaflow Toggle (Switch) — Parts Kit v06 §Selectors 기준
// CLAUDE.md §☑️ Selectors 완전 구현
// ───────────────────────────────────────────────────
// 상태: off · on · disabled
// 크기: 44×24px (CLAUDE.md w-11 h-6) · 터치 타겟 44×44px 래퍼로 보장
// 애니메이션: spring (--ease-spring · --dur-normal)
// 접근성: role="switch" + aria-checked

"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface ToggleProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  description?: ReactNode;
  /** 라벨 위치 — 기본 right (라벨이 토글 오른쪽) */
  labelPosition?: "left" | "right";
  /** 토글 크기 */
  size?: "sm" | "md";
}

// ══════════════════════════════════════════════════════════════
// Toggle
// ══════════════════════════════════════════════════════════════
export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      label,
      description,
      labelPosition = "right",
      size = "md",
      disabled,
      checked,
      className,
      id,
      ...rest
    },
    ref,
  ) => {
    const inputId = id ?? `tg-${Math.random().toString(36).slice(2, 9)}`;

    // 크기별 치수
    const dimensions = {
      sm: { track: "w-9 h-5", thumb: "w-4 h-4", translate: "translate-x-4" },
      md: { track: "w-11 h-6", thumb: "w-5 h-5", translate: "translate-x-5" },
    }[size];

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-center gap-s-3 cursor-pointer select-none",
          "p-s-1", // 터치 타겟 hit area 확장
          labelPosition === "left" && "flex-row-reverse",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {/* 네이티브 input — 숨김 */}
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-checked={checked}
          className="peer sr-only"
          {...rest}
        />

        {/* 트랙 + 썸 */}
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex items-center shrink-0",
            "rounded-full transition-colors duration-normal",
            dimensions.track,

            // 트랙 색상
            checked ? "bg-p" : "bg-bd",

            // 포커스 링
            "peer-focus-visible:ring-2 peer-focus-visible:ring-bdf peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
          )}
        >
          {/* 썸 (이동하는 흰 원) */}
          <span
            className={cn(
              "absolute left-[2px] top-1/2 -translate-y-1/2",
              "rounded-full bg-bg",
              "shadow-sm",
              "transition-transform duration-normal ease-spring",
              dimensions.thumb,
              checked && dimensions.translate,
            )}
          />
        </span>

        {/* 라벨 영역 */}
        {(label || description) && (
          <span className="flex-1 min-w-0">
            {label && (
              <span className="block font-body text-base text-t1 leading-[1.4]">
                {label}
              </span>
            )}
            {description && (
              <span className="block font-body text-sm text-t2 leading-[1.4] mt-s-1">
                {description}
              </span>
            )}
          </span>
        )}
      </label>
    );
  },
);

Toggle.displayName = "Toggle";
