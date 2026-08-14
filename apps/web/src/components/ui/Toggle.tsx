// apps/web/src/components/ui/Toggle.tsx
// Vocaflow Toggle (Switch) — Parts Kit v06 §Selectors 기준
// CLAUDE.md §☑️ Selectors 완전 구현
// ───────────────────────────────────────────────────
// 상태: off · on · disabled
// 크기: 44×24px (CLAUDE.md w-11 h-6) · 터치 타겟은 래퍼 label 이 44px 하한을 **강제**한다.
//   ⚠️ 2026-08-15 이전에는 이 줄이 "44×44px 래퍼로 보장" 이라고 적혀 있었지만 사실이 아니었다 —
//      래퍼는 `p-s-1`(4px) 뿐이라 실측 **52×32px** 였다(a11y 스윕 17회차 · 높이 12px 미달).
//      주석이 규칙을 지킨다고 말하는 동안 코드는 안 지키고 있었으므로 `min-h-[44px]` 를 명시한다.
// 애니메이션: spring (--ease-spring · --dur-normal)
// 접근성: role="switch" + aria-checked

"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
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
    // useId — Math.random() 은 서버/클라가 다른 값을 내 hydration mismatch 를 만든다
    // (2026-08-09 실측: /settings 콘솔 `Prop id did not match. Server: tg-xxx Client: tg-yyy`).
    // id 가 어긋나면 label htmlFor ↔ input 연결이 깨져 라벨 클릭·스크린리더 연결도 함께 흔들린다.
    const autoId = useId();
    const inputId = id ?? `tg-${autoId}`;

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
          "min-h-[44px] min-w-[44px]", // 44px 하한(프로젝트 절대 규칙) — 트랙은 24px 라 래퍼가 채운다
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
