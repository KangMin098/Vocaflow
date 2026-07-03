// apps/web/src/components/ui/Radio.tsx
// Vocaflow Radio — Parts Kit v06 §Selectors 기준
// CLAUDE.md §☑️ Selectors 완전 구현
// ───────────────────────────────────────────────────
// 상태: unselected · selected · disabled · error
// 크기: 22×22px 원형 · 터치 타겟 44×44px 보장
// 접근성: 화살표 키로 그룹 내 이동 (네이티브 input 동작)
// 사용: 단일 <Radio /> + <RadioGroup options={...} />

"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Single Radio
// ══════════════════════════════════════════════════════════════
export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  description?: ReactNode;
  error?: boolean;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      description,
      error = false,
      disabled,
      checked,
      className,
      id,
      ...rest
    },
    ref,
  ) => {
    const inputId = id ?? `r-${rest.name ?? "radio"}-${rest.value ?? Math.random().toString(36).slice(2, 7)}`;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-start gap-s-3 cursor-pointer select-none",
          "p-s-1",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <span className="relative flex items-center justify-center pt-[2px]">
          {/* 네이티브 input — 시각적 숨김 */}
          <input
            ref={ref}
            id={inputId}
            type="radio"
            checked={checked}
            disabled={disabled}
            className="peer sr-only"
            {...rest}
          />

          {/* 커스텀 원형 박스 */}
          <span
            aria-hidden="true"
            className={cn(
              "w-[22px] h-[22px] rounded-full border-2",
              "flex items-center justify-center",
              "transition-all duration-normal",

              // ── unselected ──
              !checked && !error && "border-bd bg-bg",
              !checked && error && "border-bde bg-bg",

              // ── selected ──
              checked && !error && "border-p bg-bg",
              checked && error && "border-bde bg-bg",

              // ── focus ring ──
              "peer-focus-visible:ring-2 peer-focus-visible:ring-bdf peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
            )}
          >
            {/* 내부 점 (selected 시) */}
            {checked && (
              <span
                className={cn(
                  "w-[10px] h-[10px] rounded-full",
                  error ? "bg-bde" : "bg-p",
                  "animate-[radioFadeIn_200ms_ease-out]",
                )}
              />
            )}
          </span>
        </span>

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

        <style jsx>{`
          @keyframes radioFadeIn {
            from {
              transform: scale(0);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </label>
    );
  },
);

Radio.displayName = "Radio";

// ══════════════════════════════════════════════════════════════
// Radio Group
// ══════════════════════════════════════════════════════════════
export interface RadioGroupProps {
  label?: ReactNode;
  /** 그룹 이름 — 모든 라디오에 동일하게 적용 (필수) */
  name: string;
  options: Array<{
    value: string;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
  }>;
  value: string;
  onChange: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  orientation = "vertical",
  disabled = false,
  error = false,
  className,
}: RadioGroupProps) {
  return (
    <fieldset
      className={cn("border-0 p-0 m-0", className)}
      disabled={disabled}
      role="radiogroup"
      aria-invalid={error || undefined}
    >
      {label && (
        <legend className="font-display text-sm font-semibold text-t1 mb-s-3 uppercase tracking-wider">
          {label}
        </legend>
      )}
      <div
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-s-2" : "flex-row flex-wrap gap-s-4",
        )}
      >
        {options.map((opt) => (
          <Radio
            key={opt.value}
            name={name}
            value={opt.value}
            label={opt.label}
            description={opt.description}
            checked={value === opt.value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || opt.disabled}
            error={error}
          />
        ))}
      </div>
    </fieldset>
  );
}
