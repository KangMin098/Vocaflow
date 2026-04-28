// apps/web/src/components/ui/Badge.tsx
// Vocaflow Badge — Parts Kit v06 §Badge 기준
// CLAUDE.md §🆕 추가 컴포넌트 §Badge 완전 구현
// ───────────────────────────────────────────────────
// 색상 변형: blue (기본) · green · gray · yellow · red · purple
// 크기: sm · md · lg
// 아이콘 슬롯 지원

import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export type BadgeVariant =
  | "blue"
  | "green"
  | "gray"
  | "yellow"
  | "red"
  | "purple";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

// ══════════════════════════════════════════════════════════════
// Variants — CLAUDE.md §Badge
// ══════════════════════════════════════════════════════════════
const variantStyles: Record<BadgeVariant, string> = {
  blue: "bg-p-light text-p",
  green: "bg-success-light text-success",
  gray: "bg-bg3 text-t2",
  yellow: "bg-warning-light text-warning",
  red: "bg-error-light text-error",
  purple: "bg-[var(--combo)]/15 text-[var(--combo)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[10px] px-s-2 py-[2px] gap-s-1",
  md: "text-[11px] px-s-3 py-[2px] gap-s-1",
  lg: "text-xs px-s-3 py-s-1 gap-s-2",
};

// ══════════════════════════════════════════════════════════════
// Badge
// ══════════════════════════════════════════════════════════════
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = "blue",
      size = "md",
      leftIcon,
      rightIcon,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-body font-semibold",
          "rounded-full whitespace-nowrap",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...rest}
      >
        {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </span>
    );
  },
);

Badge.displayName = "Badge";
