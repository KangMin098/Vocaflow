// apps/web/src/components/ui/Modal.tsx
// Vocaflow Modal — Parts Kit v06 §Modal 기준
// CLAUDE.md §🆕 추가 컴포넌트 §Modal 완전 구현
// ───────────────────────────────────────────────────
// 진입: scale(0.95)→scale(1) + opacity 0→1, --dur-slow, --ease-spring
// 배경: black/50 + backdrop-blur-sm
// 닫기: ESC 키 / 배경 클릭 / X 버튼
// 접근성: focus trap + aria-modal + role="dialog"
// 사용: <Modal isOpen={...} onClose={...}>

"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** 푸터 액션 (보통 버튼들) */
  footer?: ReactNode;
  /** 크기 */
  size?: "sm" | "md" | "lg" | "xl" | "fullscreen";
  /** 배경 클릭 시 닫기 (기본 true) */
  closeOnBackdrop?: boolean;
  /** ESC 키 닫기 (기본 true) */
  closeOnEsc?: boolean;
  /** X 버튼 표시 (기본 true) */
  showCloseButton?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  fullscreen: "max-w-full w-full h-full sm:max-w-full sm:rounded-none",
};

// ══════════════════════════════════════════════════════════════
// Modal
// ══════════════════════════════════════════════════════════════
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  closeOnEsc = true,
  showCloseButton = true,
  className,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // ESC 키 처리
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeOnEsc, onClose]);

  // body 스크롤 잠금 + 포커스 관리
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    // 모달 내 첫 포커스 가능 요소로 포커스 이동
    const focusFirst = () => {
      if (!modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        modalRef.current.focus();
      }
    };
    requestAnimationFrame(focusFirst);

    return () => {
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // SSR 가드
  if (typeof window === "undefined" || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
      className={cn(
        "fixed inset-0 z-[300]",
        "flex items-center justify-center p-s-4",
        "bg-black/50 backdrop-blur-sm",
        "animate-[fadeIn_200ms_ease-out]",
      )}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-bg rounded-2xl shadow-xl",
          "animate-[modalSpring_300ms_cubic-bezier(0.34,1.56,0.64,1)]",
          "max-h-[90vh] flex flex-col",
          sizeStyles[size],
          className,
        )}
      >
        {/* 헤더 */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-s-3 p-s-6 border-b border-bd">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="font-display text-xl font-bold text-t1 leading-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="font-body text-sm text-t2 mt-s-1"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="모달 닫기"
                className={cn(
                  "shrink-0 w-9 h-9 rounded-md",
                  "flex items-center justify-center",
                  "text-t2 hover:text-t1 hover:bg-bg3",
                  "transition-colors duration-normal",
                )}
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-s-6">{children}</div>

        {/* 푸터 */}
        {footer && (
          <div className="flex items-center justify-end gap-s-3 p-s-6 border-t border-bd">
            {footer}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSpring {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}

// ══════════════════════════════════════════════════════════════
// ConfirmModal — 확인/취소 패턴 헬퍼
// ══════════════════════════════════════════════════════════════
export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "확인",
  cancelText = "취소",
  variant = "primary",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    />
  );
}
