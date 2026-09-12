// apps/web/src/components/ui/Input.tsx
// Vocaflow Input — Parts Kit v06 §Form Fields 기준
// CLAUDE.md §📝 Form Fields 완전 구현
// ───────────────────────────────────────────────────
// 5상태: default · focus · error · success · disabled
// 기능: prefix · suffix · clearable · password toggle
// type: text · email · password · search · number · tel · url

"use client";

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  /** 5가지 상태 */
  state?: "default" | "error" | "success";
  /** 크기 */
  size?: "sm" | "md" | "lg";
  /** 좌측 아이콘/텍스트 */
  prefix?: ReactNode;
  /** 우측 아이콘/텍스트 */
  suffix?: ReactNode;
  /** X 버튼으로 비우기 가능 */
  clearable?: boolean;
  /** 값 비우기 콜백 (clearable일 때 필수) */
  onClear?: () => void;
  /** password type일 때 표시/숨기기 토글 활성화 */
  showPasswordToggle?: boolean;
}

// ══════════════════════════════════════════════════════════════
// Input
// ══════════════════════════════════════════════════════════════
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      state = "default",
      size = "md",
      prefix,
      suffix,
      clearable = false,
      onClear,
      showPasswordToggle = false,
      type = "text",
      disabled,
      className,
      value,
      ...rest
    },
    ref,
  ) => {
    // password toggle 상태
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const actualType = isPassword && showPassword ? "text" : type;

    // 사이즈별 패딩 + 글자 크기 (CLAUDE.md §Form Fields: px-4 py-3 기본)
    const sizeStyles = {
      sm: "px-s-3 py-s-2 text-sm min-h-[36px]",
      md: "px-s-4 py-s-3 text-base min-h-[44px]", // WCAG AA
      lg: "px-s-5 py-s-4 text-lg min-h-[52px]",
    }[size];

    // 좌우 아이콘이 있을 때 패딩 조정
    const hasLeft = !!prefix;
    const hasRight =
      !!suffix ||
      (clearable && !!value) ||
      (isPassword && showPasswordToggle);

    return (
      <div className="relative w-full">
        {/* 좌측 아이콘/텍스트 */}
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

        {/* 입력 필드 */}
        <input
          ref={ref}
          type={actualType}
          disabled={disabled}
          value={value}
          className={cn(
            // Base
            "w-full font-body text-t1",
            "bg-bg border rounded-md",
            "transition-all duration-normal",
            "placeholder:text-t3",

            // Size
            sizeStyles,

            // Padding 조정
            hasLeft && "pl-s-10",
            hasRight && "pr-s-10",

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
        />

        {/* 우측 영역: clearable + password toggle + suffix */}
        {hasRight && (
          <div className="absolute right-s-3 top-1/2 -translate-y-1/2 flex items-center gap-s-1">
            {/* Clear 버튼 */}
            {clearable && !!value && !disabled && (
              <button
                type="button"
                onClick={onClear}
                aria-label="입력 비우기"
                className={cn(
                  "w-5 h-5 rounded-full",
                  "flex items-center justify-center",
                  "bg-bg3 text-t2 hover:bg-bd",
                  "transition-colors duration-normal",
                )}
              >
                <X size={12} strokeWidth={3} />
              </button>
            )}

            {/* Password Toggle */}
            {isPassword && showPasswordToggle && (
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                className={cn(
                  // 28×28 이었다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 아이콘 전용이라 가로도 확보해야 한다.
                  "w-11 h-11 rounded-md",
                  "flex items-center justify-center",
                  "text-t3 hover:text-t1 hover:bg-bg3",
                  "transition-colors duration-normal",
                )}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}

            {/* Suffix */}
            {suffix && (
              <span
                className={cn(
                  "flex items-center justify-center",
                  disabled ? "text-t4" : "text-t3",
                  "pointer-events-none",
                )}
                aria-hidden="true"
              >
                {suffix}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
