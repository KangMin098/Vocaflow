// apps/web/src/components/ui/Card.tsx
// Vocaflow Card — Parts Kit v06 표준 컨테이너
// CLAUDE.md v06.2 §Surface + §Shadow 토큰 기반
// ───────────────────────────────────────────────────
// 가장 많이 쓰일 기본 컨테이너 — 학습 콘텐츠/통계/모듈 카드 등
// 변형: default · bordered · elevated · interactive
// 합성: Card · CardHeader · CardTitle · CardDescription · CardContent · CardFooter

"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export type CardVariant = "default" | "bordered" | "elevated" | "interactive";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** 패딩 크기 */
  padding?: "none" | "sm" | "md" | "lg";
}

// ══════════════════════════════════════════════════════════════
// Variants
// ══════════════════════════════════════════════════════════════
const variantStyles: Record<CardVariant, string> = {
  default: "bg-bg2 border border-bd",
  bordered: "bg-bg border-2 border-bd",
  elevated: "bg-bg shadow-md border border-bd",
  interactive:
    "bg-bg2 border border-bd cursor-pointer transition-all duration-normal hover:shadow-md hover:border-p hover:-translate-y-[2px]",
};

const paddingStyles = {
  none: "",
  sm: "p-s-4",
  md: "p-s-6",
  lg: "p-s-8",
};

// ══════════════════════════════════════════════════════════════
// Card
// ══════════════════════════════════════════════════════════════
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg",
          variantStyles[variant],
          paddingStyles[padding],
          className,
        )}
        {...rest}
      />
    );
  },
);
Card.displayName = "Card";

// ══════════════════════════════════════════════════════════════
// Card Sub-components
// ══════════════════════════════════════════════════════════════
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-s-1 mb-s-4", className)}
      {...rest}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...rest }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "font-display text-lg font-bold text-t1 leading-tight",
        className,
      )}
      {...rest}
    />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...rest }, ref) => (
    <p
      ref={ref}
      className={cn("font-body text-sm text-t2", className)}
      {...rest}
    />
  ),
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div ref={ref} className={cn("font-body text-base text-t1", className)} {...rest} />
  ),
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-s-3 mt-s-4 pt-s-4 border-t border-bd",
        className,
      )}
      {...rest}
    />
  ),
);
CardFooter.displayName = "CardFooter";
