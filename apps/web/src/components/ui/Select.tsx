// apps/web/src/components/ui/Select.tsx
// Vocaflow Select — Parts Kit v06 §Form Fields 기준
// CLAUDE.md §📝 Form Fields 완전 구현
// ───────────────────────────────────────────────────
// 네이티브 <select> 기반 (모바일에서 시스템 picker 자동 사용)
// 5상태: default · focus · error · success · disabled
// 고급 dropdown(검색·다중선택)은 §Dropdowns에서 Radix UI 도입 시 별도 구현

"use client";

import {
  forwardRef,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "prefix"> {
  state?: "default" | "error" | "success";
  size?: "sm" | "md" | "lg";
  options: SelectOption[];
  /** 빈 옵션 라벨 (placeholder 역할) */
  placeholder?: string;
  /** 좌측 아이콘 — HTML 의 `prefix` 속성(RDFa)과 이름이 같지만 우리 prop 으로 덮어씀 */
  prefix?: ReactNode;
}

// ══════════════════════════════════════════════════════════════
// Select
// ══════════════════════════════════════════════════════════════
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      state = "default",
      size = "md",
      options,
      placeholder,
      prefix,
      disabled,
      className,
      ...rest
    },
    ref,
  ) => {
    const sizeStyles = {
      sm: "px-s-3 py-s-2 text-sm min-h-[36px]",
      md: "px-s-4 py-s-3 text-base min-h-[44px]",
      lg: "px-s-5 py-s-4 text-lg min-h-[52px]",
    }[size];

    return (
      <div className="relative w-full">
        {prefix && (
          <span
            className={cn(
              "absolute left-s-3 top-1/2 -translate-y-1/2",
              "flex items-center justify-center pointer-events-none",
              disabled ? "text-t4" : "text-t3",
            )}
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}

        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            // Base
            "w-full font-body text-t1",
            "bg-bg border rounded-md appearance-none cursor-pointer",
            "transition-all duration-normal",

            // Size
            sizeStyles,

            // Padding
            prefix && "pl-s-10",
            "pr-s-10", // ChevronDown 공간

            // 상태별 색상
            state === "default" && "border-bd",
            state === "error" && "border-bde",
            state === "success" && "border-success",

            // Focus
            "focus:outline-none",
            state === "default" &&
              "focus:border-bdf focus:ring-2 focus:ring-p/20",
            state === "error" && "focus:ring-2 focus:ring-error/20",
            state === "success" && "focus:ring-2 focus:ring-success/20",

            // Disabled
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg3",

            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Chevron 아이콘 */}
        <ChevronDown
          size={18}
          className={cn(
            "absolute right-s-3 top-1/2 -translate-y-1/2 pointer-events-none",
            disabled ? "text-t4" : "text-t2",
          )}
          aria-hidden="true"
        />
      </div>
    );
  },
);

Select.displayName = "Select";
