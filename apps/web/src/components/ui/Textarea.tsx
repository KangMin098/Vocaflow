// apps/web/src/components/ui/Textarea.tsx
// Vocaflow Textarea — Parts Kit v06 §Form Fields 기준
// CLAUDE.md §📝 Form Fields 완전 구현
// ───────────────────────────────────────────────────
// 5상태: default · focus · error · success · disabled
// 기능: auto-resize · character count · maxLength
// 주 사용처: TextViewer (영어 스크립트 입력)

"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  state?: "default" | "error" | "success";
  /** 자동 높이 조절 */
  autoResize?: boolean;
  /** 글자 수 카운터 표시 (maxLength와 함께 표시) */
  showCount?: boolean;
  /** 최소 줄 수 (autoResize 시) */
  minRows?: number;
  /** 최대 줄 수 (autoResize 시) */
  maxRows?: number;
}

// ══════════════════════════════════════════════════════════════
// Textarea
// ══════════════════════════════════════════════════════════════
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      state = "default",
      autoResize = false,
      showCount = false,
      minRows = 3,
      maxRows = 12,
      maxLength,
      disabled,
      className,
      value,
      onChange,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);

    // ref 병합
    useEffect(() => {
      if (typeof ref === "function") ref(innerRef.current);
      else if (ref) ref.current = innerRef.current;
    }, [ref]);

    // Auto-resize 로직
    useEffect(() => {
      if (!autoResize || !innerRef.current) return;
      const el = innerRef.current;

      const adjust = () => {
        el.style.height = "auto";
        const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 24;
        const minHeight = lineHeight * minRows;
        const maxHeight = lineHeight * maxRows;
        const newHeight = Math.min(
          Math.max(el.scrollHeight, minHeight),
          maxHeight,
        );
        el.style.height = `${newHeight}px`;
        el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
      };

      adjust();
    }, [value, autoResize, minRows, maxRows]);

    const currentLength =
      typeof value === "string" ? value.length : 0;

    return (
      <div className="relative w-full">
        <textarea
          ref={innerRef}
          rows={minRows}
          maxLength={maxLength}
          disabled={disabled}
          value={value}
          onChange={onChange}
          className={cn(
            // Base (CLAUDE.md §Form Fields)
            "w-full font-body text-base text-t1",
            "px-s-4 py-s-3",
            "bg-bg border rounded-md",
            "transition-all duration-normal resize-none",
            "placeholder:text-t3",
            "leading-[1.5]",

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

            // 글자 수 표시 시 하단 패딩 추가
            showCount && "pb-s-8",

            className,
          )}
          {...rest}
        />

        {/* 글자 수 카운터 */}
        {showCount && (
          <div
            className={cn(
              "absolute bottom-s-2 right-s-3 pointer-events-none",
              "font-mono text-xs",
              maxLength && currentLength > maxLength * 0.9
                ? "text-warning"
                : "text-t3",
              maxLength && currentLength >= maxLength && "text-error",
            )}
            aria-live="polite"
          >
            {currentLength}
            {maxLength && ` / ${maxLength}`}
          </div>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
