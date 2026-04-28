// apps/web/src/components/ui/Button.tsx
// Vocaflow Button — Parts Kit v06 §Buttons 기준
// CLAUDE.md §🔘 Buttons (8종 × 3크기) 완전 구현
// ───────────────────────────────────────────────────
// 8 variants: primary · secondary · danger · ghost · icon · link · social · text-link
// 3 sizes:    sm · md (default) · lg
// 추가 props: loading · disabled · leftIcon · rightIcon · fullWidth
// 접근성:     WCAG AA · 최소 터치 타겟 44×44px · :focus-visible
// 다크모드:   data-theme="dark" 자동 대응 (CSS Variables 기반)

"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "icon"
  | "link"
  | "social"
  | "text-link";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** 'icon' variant에서 시각적으로 보이지 않는 라벨 (스크린리더용) */
  ariaLabel?: string;
}

// ══════════════════════════════════════════════════════════════
// Variant Styles — CLAUDE.md §Buttons 기준
// ══════════════════════════════════════════════════════════════
const variantStyles: Record<ButtonVariant, string> = {
  // ── Primary: 메인 액션 ──
  primary: cn(
    "bg-p text-ti font-display font-semibold",
    "hover:bg-p-hover active:scale-[0.97]",
    "shadow-sm hover:shadow-md",
  ),

  // ── Secondary: 보조 액션 (테두리) ──
  secondary: cn(
    "bg-transparent text-p font-display font-semibold",
    "border-2 border-p",
    "hover:bg-p-light active:scale-[0.97]",
  ),

  // ── Danger: 삭제·되돌릴 수 없는 액션 ──
  danger: cn(
    "bg-error text-ti font-display font-semibold",
    "hover:opacity-90 active:scale-[0.97]",
    "shadow-sm hover:shadow-md",
  ),

  // ── Ghost: 약한 배경 ──
  ghost: cn(
    "bg-bg3 text-t1 font-display font-semibold",
    "hover:bg-bd active:scale-[0.97]",
  ),

  // ── Icon: 원형 아이콘 버튼 (44×44 터치 타겟) ──
  icon: cn(
    "bg-p-light text-p rounded-full",
    "hover:bg-p hover:text-ti active:scale-[0.95]",
    "flex items-center justify-center",
  ),

  // ── Link: CAPS 스타일 링크 버튼 ──
  link: cn(
    "bg-transparent text-p font-display font-semibold",
    "uppercase tracking-wider text-sm",
    "hover:underline",
  ),

  // ── Social: Google 등 소셜 로그인 ──
  social: cn(
    "bg-bg text-t1 font-display font-medium",
    "border border-bd",
    "hover:bg-bg3 active:scale-[0.99]",
    "flex items-center justify-center gap-3",
  ),

  // ── Text Link: 본문 속 인라인 링크 ──
  "text-link": cn(
    "bg-transparent text-p font-medium",
    "underline hover:text-p-dark",
    "p-0", // padding 제거
  ),
};

// ══════════════════════════════════════════════════════════════
// Size Styles
// ══════════════════════════════════════════════════════════════
const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-s-4 py-s-2 text-sm rounded-sm min-h-[36px]",
  md: "px-s-6 py-s-3 text-base rounded-md min-h-[44px]", // 기본 (WCAG AA)
  lg: "px-s-8 py-s-4 text-lg rounded-lg min-h-[52px]",
};

// 'icon' variant 전용 사이즈 (정사각형)
const iconSizeStyles: Record<ButtonSize, string> = {
  sm: "w-9 h-9 min-w-[36px] min-h-[36px]",       // 36×36
  md: "w-11 h-11 min-w-[44px] min-h-[44px]",     // 44×44 (WCAG AA)
  lg: "w-12 h-12 min-w-[48px] min-h-[48px]",     // 48×48
};

// 'link' / 'text-link'은 padding/min-height 무시
const flatVariants: ButtonVariant[] = ["link", "text-link"];

// ══════════════════════════════════════════════════════════════
// Loader Size by Button Size
// ══════════════════════════════════════════════════════════════
const loaderSize: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 20,
};

// ══════════════════════════════════════════════════════════════
// Button Component
// ══════════════════════════════════════════════════════════════
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      ariaLabel,
      disabled,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) => {
    const isIconVariant = variant === "icon";
    const isFlat = flatVariants.includes(variant);
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        className={cn(
          // Base
          "inline-flex items-center justify-center gap-s-2",
          "transition-all duration-normal",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-bdf",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          "select-none whitespace-nowrap",

          // Variant
          variantStyles[variant],

          // Size (icon은 정사각형, link류는 사이즈 미적용)
          isIconVariant
            ? iconSizeStyles[size]
            : !isFlat && sizeStyles[size],

          // Full Width
          fullWidth && !isIconVariant && "w-full",

          // 사용자 추가 className
          className,
        )}
        {...rest}
      >
        {/* 로딩 상태: children/icons 숨기고 스피너만 */}
        {loading ? (
          <Loader2
            size={loaderSize[size]}
            className="animate-spin"
            aria-hidden="true"
          />
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            {!isIconVariant && children}
            {isIconVariant && children}
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
