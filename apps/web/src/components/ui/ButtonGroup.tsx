// apps/web/src/components/ui/ButtonGroup.tsx
// Vocaflow ButtonGroup — Parts Kit v06 §ButtonGroup 기준
// CLAUDE.md §🆕 추가 컴포넌트 §ButtonGroup 완전 구현
// ───────────────────────────────────────────────────
// 분할 버튼 — 정렬 옵션, 보기 모드 전환, 필터 등
// 단일 선택 모드 (Radio Group의 시각 변형)

"use client";

import { type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface ButtonGroupOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ButtonGroupProps {
  /** 그룹 좌측 라벨 (선택) */
  label?: string;
  options: ButtonGroupOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  /** 접근성용 그룹 이름 */
  ariaLabel?: string;
}

// ══════════════════════════════════════════════════════════════
// ButtonGroup
// ══════════════════════════════════════════════════════════════
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  (
    {
      label,
      options,
      value,
      onChange,
      size = "md",
      disabled = false,
      className,
      ariaLabel,
    },
    ref,
  ) => {
    const buttonSizeStyles = {
      sm: "px-s-3 py-s-2 text-xs min-h-[32px]",
      md: "px-s-4 py-s-2 text-sm min-h-[36px]",
      lg: "px-s-5 py-s-3 text-base min-h-[44px]",
    }[size];

    const labelSizeStyles = {
      sm: "px-s-3 text-[10px]",
      md: "px-s-3 text-[11px]",
      lg: "px-s-4 text-xs",
    }[size];

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label={ariaLabel ?? label}
        className={cn(
          "inline-flex items-center",
          "border border-bd rounded-md overflow-hidden",
          "bg-bg",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        {/* 좌측 라벨 */}
        {label && (
          <span
            className={cn(
              "font-body font-semibold text-t3",
              "uppercase tracking-wider",
              "border-r border-bd",
              "flex items-center self-stretch",
              labelSizeStyles,
            )}
          >
            {label}
          </span>
        )}

        {/* 옵션 버튼들 */}
        {options.map((opt, idx) => {
          const isActive = value === opt.value;
          const isDisabled = disabled || opt.disabled;
          const isLast = idx === options.length - 1;

          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(opt.value)}
              className={cn(
                "font-body font-semibold",
                "transition-colors duration-normal",
                "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-bdf",
                "disabled:cursor-not-allowed",
                buttonSizeStyles,
                !isLast && "border-r border-bd",

                // 상태별
                isActive
                  ? "bg-p text-ti"
                  : "bg-bg text-t1 hover:bg-bg2 disabled:hover:bg-bg",

                // 아이콘 정렬
                "inline-flex items-center justify-center gap-s-2",
              )}
            >
              {opt.icon && <span className="inline-flex shrink-0">{opt.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  },
);

ButtonGroup.displayName = "ButtonGroup";
