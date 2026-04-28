// apps/web/src/components/ui/FormField.tsx
// Vocaflow FormField — 라벨 + helper + error 통합 래퍼
// CLAUDE.md v06.2 §Form Fields 보강
// ───────────────────────────────────────────────────
// 모든 폼 입력(Input, Textarea, Select)을 감싸 라벨/도움말/에러를 표준화

"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils/cn";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface FormFieldProps {
  /** 필드 라벨 */
  label?: ReactNode;
  /** 필수 표시 (*) */
  required?: boolean;
  /** 도움말 텍스트 (라벨 옆 작은 회색) */
  hint?: ReactNode;
  /** 입력 아래 도움말 */
  helper?: ReactNode;
  /** 에러 메시지 (제공 시 helper 대신 표시) */
  error?: ReactNode;
  /** 성공 메시지 */
  success?: ReactNode;
  /** 자식 — Input/Textarea/Select 등 */
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
  /** 추가 className (래퍼) */
  className?: string;
}

// ══════════════════════════════════════════════════════════════
// FormField
// ══════════════════════════════════════════════════════════════
export function FormField({
  label,
  required,
  hint,
  helper,
  error,
  success,
  children,
  className,
}: FormFieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const successId = `${id}-success`;

  const describedBy =
    [
      helper && helperId,
      error && errorId,
      success && successId,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-s-2 w-full", className)}>
      {/* 라벨 영역 */}
      {(label || hint) && (
        <div className="flex items-baseline justify-between gap-s-2">
          {label && (
            <label
              htmlFor={id}
              className="font-display text-sm font-semibold text-t1"
            >
              {label}
              {required && (
                <span className="text-error ml-s-1" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          )}
          {hint && (
            <span className="font-body text-xs text-t3">{hint}</span>
          )}
        </div>
      )}

      {/* 입력 컴포넌트 (children에 props 주입) */}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {/* 메시지 영역 (우선순위: error > success > helper) */}
      {error && (
        <p id={errorId} className="font-body text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!error && success && (
        <p id={successId} className="font-body text-sm text-success">
          {success}
        </p>
      )}
      {!error && !success && helper && (
        <p id={helperId} className="font-body text-sm text-t2">
          {helper}
        </p>
      )}
    </div>
  );
}
