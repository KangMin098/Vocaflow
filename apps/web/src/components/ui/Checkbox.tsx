// apps/web/src/components/ui/Checkbox.tsx
// Vocaflow Checkbox — Parts Kit v06 §Selectors 기준
// CLAUDE.md §☑️ Selectors 완전 구현
// ───────────────────────────────────────────────────
// 상태: unselected · selected · indeterminate · disabled
// 크기: 22×22px (CLAUDE.md 명시) · 터치 타겟 44×44px 보장 (래퍼 padding)
// 애니메이션: 체크 시 bounce (--ease-spring · --dur-slow)
// 접근성: 네이티브 input 사용 (스크린리더 + 키보드 자동 지원)

"use client";

import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** 라벨 텍스트 (선택) */
  label?: ReactNode;
  /** 설명 텍스트 (라벨 아래 작은 글씨) */
  description?: ReactNode;
  /** 부분 선택 상태 (CheckboxGroup 부모용) */
  indeterminate?: boolean;
  /** 에러 상태 (테두리 빨간색) */
  error?: boolean;
}

// ══════════════════════════════════════════════════════════════
// Single Checkbox
// ══════════════════════════════════════════════════════════════
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      indeterminate = false,
      error = false,
      disabled,
      checked,
      className,
      id,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLInputElement>(null);
    // useId — SSR/CSR 동일 id 보장 (Math.random 은 hydration mismatch 경고 유발)
    const generatedId = useId();
    const inputId = id ?? `cb-${generatedId}`;

    // ref 병합 (forwardRef + 내부 ref)
    useEffect(() => {
      if (typeof ref === "function") ref(innerRef.current);
      else if (ref) ref.current = innerRef.current;
    }, [ref]);

    // indeterminate는 prop으로 직접 설정 불가 — DOM 속성으로 설정
    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const isChecked = checked || indeterminate;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-start gap-s-3 cursor-pointer select-none",
          // 터치 타겟 — **라벨 전체가 탭 대상**이다(입력은 sr-only).
          // `p-s-1` 만으로는 30px 이었다(주석이 그렇게 적고 있었다). 44px 미만은
          // CLAUDE.md 절대 금지이고, 가입 화면의 **필수 동의 3개**가 여기에 걸려 있었다
          // (실측 2026-08-26 · 390px). 잘못 누르면 가입이 막히는 자리다.
          "p-s-1 min-h-[44px]",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {/* 시각적 박스 영역 */}
        <span className="relative flex items-center justify-center pt-[4px]">
          {/* 네이티브 input — 시각적으로 숨김, 접근성용 */}
          <input
            ref={innerRef}
            id={inputId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            aria-invalid={error || undefined}
            className="peer sr-only"
            {...rest}
          />

          {/* 커스텀 박스 */}
          <span
            aria-hidden="true"
            className={cn(
              "w-[22px] h-[22px] rounded-[4px] border-2",
              "flex items-center justify-center",
              "transition-all duration-normal",

              // ── unselected ──
              !isChecked && !error && "border-bd bg-bg",
              !isChecked && error && "border-bde bg-bg",

              // ── selected / indeterminate ──
              isChecked && !error && "border-p bg-p",
              isChecked && error && "border-bde bg-bde",

              // ── focus ring ──
              "peer-focus-visible:ring-2 peer-focus-visible:ring-bdf peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
            )}
          >
            {/* 체크 아이콘 (bounce 애니메이션) */}
            {checked && !indeterminate && (
              <Check
                size={14}
                strokeWidth={3}
                className="text-ti animate-[checkPop_300ms_cubic-bezier(.34,1.56,.64,1)]"
              />
            )}
            {/* indeterminate 가로줄 */}
            {indeterminate && (
              <Minus
                size={14}
                strokeWidth={3}
                className="text-ti"
              />
            )}
          </span>
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

        {/* 체크 애니메이션 keyframes (Tailwind에 없는 커스텀) */}
        <style jsx>{`
          @keyframes checkPop {
            0% {
              transform: scale(0);
              opacity: 0;
            }
            60% {
              transform: scale(1.15);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";

// ══════════════════════════════════════════════════════════════
// Checkbox Group — 여러 옵션 + 부모 indeterminate
// ══════════════════════════════════════════════════════════════
export interface CheckboxGroupProps {
  /** 그룹 라벨 */
  label?: ReactNode;
  /** 옵션 배열 [{ value, label, description? }] */
  options: Array<{
    value: string;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
  }>;
  /** 선택된 value 배열 */
  value: string[];
  /** 선택 변경 콜백 */
  onChange: (value: string[]) => void;
  /** 가로/세로 정렬 */
  orientation?: "horizontal" | "vertical";
  /** 비활성화 (전체) */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 추가 className */
  className?: string;
}

export function CheckboxGroup({
  label,
  options,
  value,
  onChange,
  orientation = "vertical",
  disabled = false,
  error = false,
  className,
}: CheckboxGroupProps) {
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <fieldset
      className={cn("border-0 p-0 m-0", className)}
      disabled={disabled}
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
          <Checkbox
            key={opt.value}
            label={opt.label}
            description={opt.description}
            checked={value.includes(opt.value)}
            onChange={() => handleToggle(opt.value)}
            disabled={disabled || opt.disabled}
            error={error}
          />
        ))}
      </div>
    </fieldset>
  );
}
