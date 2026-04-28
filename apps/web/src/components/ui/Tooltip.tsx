// apps/web/src/components/ui/Tooltip.tsx
// Vocaflow Tooltip — Parts Kit v06 §Tooltips 기준
// CLAUDE.md §💬 Tooltips 완전 구현
// ───────────────────────────────────────────────────
// 4방향: top · bottom · left · right (caret 포함)
// 4색상: default(dark) · info · warning · error
// 트리거: hover + focus (키보드 접근성)

"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export type TooltipPosition = "top" | "bottom" | "left" | "right";
export type TooltipColor = "default" | "info" | "warning" | "error";

export interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  color?: TooltipColor;
  /** 표시 지연 (ms) */
  delay?: number;
  /** disabled 시 비활성 */
  disabled?: boolean;
  children: ReactElement;
}

// ══════════════════════════════════════════════════════════════
// Color Variants
// ══════════════════════════════════════════════════════════════
const colorStyles: Record<TooltipColor, string> = {
  default: "bg-t1 text-ti",
  info: "bg-info text-ti",
  warning: "bg-warning text-ti",
  error: "bg-error text-ti",
};

const caretColorStyles: Record<TooltipColor, string> = {
  default: "border-t1",
  info: "border-info",
  warning: "border-warning",
  error: "border-error",
};

// ══════════════════════════════════════════════════════════════
// Position Styles
// ══════════════════════════════════════════════════════════════
const positionStyles: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-s-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-s-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-s-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-s-2",
};

// Caret 위치 (각 위치별 화살표)
const caretStyles: Record<TooltipPosition, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-[6px] border-x-[6px]",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-[6px] border-x-[6px]",
  left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-[6px] border-y-[6px]",
  right:
    "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-[6px] border-y-[6px]",
};

// ══════════════════════════════════════════════════════════════
// Tooltip
// ══════════════════════════════════════════════════════════════
export function Tooltip({
  content,
  position = "top",
  color = "default",
  delay = 200,
  disabled = false,
  children,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const show = () => {
    if (disabled) return;
    timer = setTimeout(() => setIsOpen(true), delay);
  };

  const hide = () => {
    if (timer) clearTimeout(timer);
    setIsOpen(false);
  };

  // children에 ARIA 속성 주입
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-describedby": isOpen ? tooltipId : undefined,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })
    : children;

  return (
    <span className="relative inline-flex">
      {trigger}
      {isOpen && !disabled && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "absolute z-50 pointer-events-none",
            "px-s-3 py-s-2 rounded-md shadow-md",
            "font-body text-sm font-medium whitespace-nowrap",
            "animate-[tooltipFadeIn_200ms_ease-out]",
            colorStyles[color],
            positionStyles[position],
          )}
        >
          {content}
          {/* Caret 화살표 */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute w-0 h-0 border-solid",
              caretColorStyles[color],
              caretStyles[position],
            )}
          />
        </span>
      )}

      <style jsx>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(2px) translateX(var(--tw-translate-x, 0));
          }
          to {
            opacity: 1;
            transform: translateY(0) translateX(var(--tw-translate-x, 0));
          }
        }
      `}</style>
    </span>
  );
}
